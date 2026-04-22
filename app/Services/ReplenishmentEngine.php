<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * ReplenishmentEngine — Motore DRP + MRP
 *
 * DRP  (Distribution Requirements Planning):
 *      Genera Transfer Order (stock_transfers) dai negozi verso il magazzino centrale.
 *
 * MRP  (Material Requirements Planning):
 *      Genera Proposte di Ordine d'Acquisto (purchase_orders) dal magazzino centrale verso i fornitori.
 *
 * Il ciclo completo è: run() → runDrp() → runMrp().
 * I due step sono eseguiti in transazioni separate; il DRP aggiorna il campo `reserved`
 * del magazzino centrale così il MRP legge già i dati aggiornati.
 */
class ReplenishmentEngine
{
    // Giorni di preparazione interni prima della spedizione (magazzino centrale → negozio)
    private const PREPARATION_DAYS = 1;
    // Giorni di transito (magazzino centrale → negozio)
    private const TRANSIT_DAYS = 1;

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Esegue il ciclo completo DRP → MRP per un tenant.
     *
     * @param  bool $dryRun  Se true simula senza scrivere nulla nel DB.
     */
    public function run(int $tenantId, bool $dryRun = false): array
    {
        Log::info("[ReplenishmentEngine] Avvio ciclo completo", [
            'tenant_id' => $tenantId,
            'dry_run'   => $dryRun,
        ]);

        $drpResult = $this->runDrp($tenantId, $dryRun);
        $mrpResult = $this->runMrp($tenantId, $dryRun);

        return [
            'generated_at' => now()->toDateTimeString(),
            'dry_run'      => $dryRun,
            'drp'          => $drpResult,
            'mrp'          => $mrpResult,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DRP — Distribution Requirements Planning
    // Negozi ← Magazzino Centrale
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Per ogni negozio con auto_reorder_enabled, controlla le giacenze.
     * Se una variante è sotto il punto di riordino e i trasferimenti in_transit
     * non coprono il fabbisogno, genera un stock_transfer (draft).
     * Aggiorna anche il `reserved` del magazzino centrale per impegnare la merce.
     */
    public function runDrp(int $tenantId, bool $dryRun = false): array
    {
        $centralWarehouse = $this->centralWarehouse($tenantId);
        if (! $centralWarehouse) {
            Log::warning("[ReplenishmentEngine DRP] Nessun magazzino centrale trovato", [
                'tenant_id' => $tenantId,
            ]);
            return ['transfers_created' => [], 'skipped' => [], 'error' => 'Nessun magazzino centrale'];
        }

        // Carica le giacenze di tutti i negozi sotto threshold
        $storeItems = $this->storeItemsBelowThreshold($tenantId);

        $transfersCreated = [];
        $skipped          = [];

        foreach ($storeItems as $item) {
            $available = (int) $item->on_hand - (int) $item->reserved;
            $deficit   = max(0, (int) $item->reorder_point - $available);

            if ($deficit <= 0) {
                continue;
            }

            // Merce già in arrivo (trasferimenti in_transit verso questo negozio)
            $inTransit = $this->inTransitQtyForStore(
                $tenantId,
                (int) $item->product_variant_id,
                (int) $item->to_warehouse_id
            );

            if ($inTransit >= $deficit) {
                $skipped[] = [
                    'reason'             => 'in_transit_sufficiente',
                    'product_variant_id' => $item->product_variant_id,
                    'store_name'         => $item->store_name,
                    'deficit'            => $deficit,
                    'in_transit'         => $inTransit,
                ];
                continue;
            }

            // Verifica che il magazzino centrale abbia stock sufficiente
            $centralItem = $this->centralStockItem($tenantId, $centralWarehouse->id, (int) $item->product_variant_id);
            $centralAvailable = $centralItem
                ? ((int) $centralItem->on_hand - (int) $centralItem->reserved)
                : 0;

            $orderQty = (int) ($item->reorder_qty ?? 1);

            if ($centralAvailable < $orderQty) {
                $skipped[] = [
                    'reason'             => 'magazzino_centrale_insufficiente',
                    'product_variant_id' => $item->product_variant_id,
                    'store_name'         => $item->store_name,
                    'central_available'  => $centralAvailable,
                    'order_qty'          => $orderQty,
                ];
                continue;
            }

            $expectedDate = now()
                ->addDays(self::PREPARATION_DAYS + self::TRANSIT_DAYS)
                ->toDateString();

            if (! $dryRun) {
                $transferId = DB::transaction(function () use (
                    $tenantId, $item, $centralWarehouse, $orderQty, $expectedDate
                ): int {
                    // Crea il trasferimento
                    $ddtNumber = $this->generateDdtNumber($tenantId);
                    $transferId = DB::table('stock_transfers')->insertGetId([
                        'tenant_id'          => $tenantId,
                        'ddt_number'         => $ddtNumber,
                        'from_store_id'      => $centralWarehouse->store_id,
                        'to_store_id'        => $item->store_id,
                        'from_warehouse_id'  => $centralWarehouse->id,
                        'to_warehouse_id'    => $item->to_warehouse_id,
                        'status'             => 'draft',
                        'notes'              => "Generato automaticamente da ReplenishmentEngine (DRP) — consegna prevista {$expectedDate}",
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);

                    // Riga del trasferimento
                    DB::table('stock_transfer_items')->insert([
                        'transfer_id'        => $transferId,
                        'product_variant_id' => $item->product_variant_id,
                        'quantity_sent'      => $orderQty,
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);

                    // Impegna la merce nel magazzino centrale
                    DB::table('stock_items')
                        ->where('warehouse_id', $centralWarehouse->id)
                        ->where('product_variant_id', $item->product_variant_id)
                        ->increment('reserved', $orderQty);

                    return $transferId;
                });

                $transfersCreated[] = [
                    'transfer_id'        => $transferId,
                    'ddt_number'         => DB::table('stock_transfers')->where('id', $transferId)->value('ddt_number'),
                    'product_variant_id' => $item->product_variant_id,
                    'product_name'       => $item->product_name,
                    'store_name'         => $item->store_name,
                    'order_qty'          => $orderQty,
                    'expected_date'      => $expectedDate,
                ];
            } else {
                // dry-run: simula senza scrivere
                $transfersCreated[] = [
                    'transfer_id'        => '[dry-run]',
                    'product_variant_id' => $item->product_variant_id,
                    'product_name'       => $item->product_name,
                    'store_name'         => $item->store_name,
                    'order_qty'          => $orderQty,
                    'expected_date'      => $expectedDate,
                ];
            }
        }

        Log::info("[ReplenishmentEngine DRP] Completato", [
            'tenant_id'          => $tenantId,
            'transfers_created'  => count($transfersCreated),
            'skipped'            => count($skipped),
            'dry_run'            => $dryRun,
        ]);

        return [
            'transfers_created' => $transfersCreated,
            'skipped'           => $skipped,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MRP — Material Requirements Planning
    // Magazzino Centrale ← Fornitore
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Controlla le giacenze del magazzino centrale (già aggiornate dal DRP).
     * Se una variante è sotto soglia e i PO già in corso non coprono il fabbisogno,
     * genera una proposta di ordine d'acquisto (purchase_order, source='auto_mrp').
     */
    public function runMrp(int $tenantId, bool $dryRun = false): array
    {
        $centralWarehouse = $this->centralWarehouse($tenantId);
        if (! $centralWarehouse) {
            return ['orders_created' => [], 'skipped' => [], 'error' => 'Nessun magazzino centrale'];
        }

        $centralItems = $this->centralItemsBelowThreshold($tenantId, $centralWarehouse->id);

        $ordersCreated = [];
        $skipped       = [];

        // Raggruppa per fornitore (un PO per fornitore)
        $bySupplier = [];
        foreach ($centralItems as $item) {
            $available = (int) $item->on_hand - (int) $item->reserved;
            $deficit   = max(0, (int) $item->reorder_point - $available);

            if ($deficit <= 0) {
                continue;
            }

            $inOrderQty = $this->inOrderQtyFromSupplier($tenantId, (int) $item->product_variant_id);
            if ($inOrderQty >= $deficit) {
                $skipped[] = [
                    'reason'             => 'po_in_corso_sufficiente',
                    'product_variant_id' => $item->product_variant_id,
                    'product_name'       => $item->product_name,
                    'deficit'            => $deficit,
                    'in_order'           => $inOrderQty,
                ];
                continue;
            }

            $supplierId = (int) ($item->default_supplier_id ?? 0);
            if ($supplierId === 0) {
                $skipped[] = [
                    'reason'             => 'nessun_fornitore',
                    'product_variant_id' => $item->product_variant_id,
                    'product_name'       => $item->product_name,
                ];
                continue;
            }

            $bySupplier[$supplierId][] = $item;
        }

        foreach ($bySupplier as $supplierId => $items) {
            $leadTimeDays = $this->supplierLeadTime($tenantId, $supplierId);
            $expectedAt   = now()->addDays($leadTimeDays)->toDateString();

            if (! $dryRun) {
                $poId = DB::transaction(function () use (
                    $tenantId, $supplierId, $expectedAt, $items
                ): int {
                    $poId = DB::table('purchase_orders')->insertGetId([
                        'tenant_id'           => $tenantId,
                        'supplier_id'         => $supplierId,
                        'status'              => 'draft',
                        'fulfillment_status'  => 'none',
                        'source'              => 'auto_mrp',
                        'expected_at'         => $expectedAt,
                        'auto_generated_at'   => now(),
                        'auto_generated_by'   => 'replenishment_engine',
                        'total_net'           => 0,
                        'notes'               => "Proposta ordine generata automaticamente da ReplenishmentEngine (MRP) — consegna prevista {$expectedAt}",
                        'created_at'          => now(),
                        'updated_at'          => now(),
                    ]);

                    $totalNet = 0.0;
                    foreach ($items as $item) {
                        $qty = (int) ($item->reorder_qty ?? 1);
                        DB::table('purchase_order_lines')->insert([
                            'purchase_order_id'  => $poId,
                            'product_variant_id' => $item->product_variant_id,
                            'qty'                => $qty,
                            'unit_cost'          => (float) ($item->cost_price ?? 0),
                            'created_at'         => now(),
                            'updated_at'         => now(),
                        ]);
                        $totalNet += $qty * (float) ($item->cost_price ?? 0);
                    }

                    DB::table('purchase_orders')
                        ->where('id', $poId)
                        ->update(['total_net' => round($totalNet, 2), 'updated_at' => now()]);

                    return $poId;
                });

                $ordersCreated[] = [
                    'purchase_order_id' => $poId,
                    'supplier_id'       => $supplierId,
                    'lines'             => count($items),
                    'expected_at'       => $expectedAt,
                    'lead_time_days'    => $leadTimeDays,
                ];
            } else {
                $ordersCreated[] = [
                    'purchase_order_id' => '[dry-run]',
                    'supplier_id'       => $supplierId,
                    'lines'             => count($items),
                    'expected_at'       => $expectedAt,
                    'lead_time_days'    => $leadTimeDays,
                ];
            }
        }

        Log::info("[ReplenishmentEngine MRP] Completato", [
            'tenant_id'     => $tenantId,
            'orders_created' => count($ordersCreated),
            'skipped'       => count($skipped),
            'dry_run'       => $dryRun,
        ]);

        return [
            'orders_created' => $ordersCreated,
            'skipped'        => $skipped,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // QUERY HELPERS (privati)
    // ──────────────────────────────────────────────────────────────────────────

    private function centralWarehouse(int $tenantId): ?object
    {
        // Prima cerca un warehouse esplicito con type='central'
        $central = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('type', 'central')
            ->first();

        if ($central) {
            return $central;
        }

        // Fallback: magazzino del negozio principale (is_main = true)
        return DB::table('warehouses as w')
            ->join('stores as s', 's.id', '=', 'w.store_id')
            ->where('w.tenant_id', $tenantId)
            ->where('s.is_main', true)
            ->select('w.*')
            ->first();
    }

    /**
     * Giacenze dei negozi (tipo = 'store') con disponibile <= reorder_point
     * e auto_reorder_enabled = true sia sul negozio che sul prodotto.
     */
    private function storeItemsBelowThreshold(int $tenantId): \Illuminate\Support\Collection
    {
        return DB::table('stock_items as si')
            ->join('warehouses as w', 'w.id', '=', 'si.warehouse_id')
            ->join('stores as s', 's.id', '=', 'w.store_id')
            ->join('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('si.tenant_id', $tenantId)
            ->where('w.type', 'store')
            ->where('s.auto_reorder_enabled', true)
            ->where('p.auto_reorder_enabled', true)
            ->whereRaw('(si.on_hand - si.reserved) <= si.reorder_point')
            ->select([
                'si.id',
                'si.product_variant_id',
                'si.on_hand',
                'si.reserved',
                'si.reorder_point',
                'si.reorder_qty',
                'w.id as to_warehouse_id',
                's.id as store_id',
                's.name as store_name',
                'p.id as product_id',
                'p.name as product_name',
                'p.default_supplier_id',
                'pv.cost_price',
            ])
            ->get();
    }

    /**
     * Giacenze del magazzino centrale sotto il punto di riordino.
     */
    private function centralItemsBelowThreshold(int $tenantId, int $centralWarehouseId): \Illuminate\Support\Collection
    {
        return DB::table('stock_items as si')
            ->join('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('si.tenant_id', $tenantId)
            ->where('si.warehouse_id', $centralWarehouseId)
            ->where('p.auto_reorder_enabled', true)
            ->whereRaw('(si.on_hand - si.reserved) <= si.reorder_point')
            ->select([
                'si.id',
                'si.product_variant_id',
                'si.on_hand',
                'si.reserved',
                'si.reorder_point',
                'si.reorder_qty',
                'p.id as product_id',
                'p.name as product_name',
                'p.default_supplier_id',
                'pv.cost_price',
            ])
            ->get();
    }

    /** Ritorna la giacenza centrale di una variante specifica. */
    private function centralStockItem(int $tenantId, int $centralWarehouseId, int $variantId): ?object
    {
        return DB::table('stock_items')
            ->where('tenant_id', $tenantId)
            ->where('warehouse_id', $centralWarehouseId)
            ->where('product_variant_id', $variantId)
            ->first();
    }

    /**
     * Quantità già in transito (stock_transfers in_transit o draft) verso un magazzino negozio
     * per una variante specifica.
     */
    private function inTransitQtyForStore(int $tenantId, int $variantId, int $toWarehouseId): int
    {
        $qty = DB::table('stock_transfer_items as sti')
            ->join('stock_transfers as st', 'st.id', '=', 'sti.transfer_id')
            ->where('st.tenant_id', $tenantId)
            ->whereIn('st.status', ['draft', 'in_transit'])
            ->where('st.to_warehouse_id', $toWarehouseId)
            ->where('sti.product_variant_id', $variantId)
            ->sum('sti.quantity_sent');

        return (int) $qty;
    }

    /**
     * Quantità già in ordine presso fornitori (PO aperti) per una variante specifica
     * del magazzino centrale.
     */
    private function inOrderQtyFromSupplier(int $tenantId, int $variantId): int
    {
        $qty = DB::table('purchase_order_lines as pol')
            ->join('purchase_orders as po', 'po.id', '=', 'pol.purchase_order_id')
            ->where('po.tenant_id', $tenantId)
            ->whereIn('po.status', ['draft', 'sent', 'confirmed'])
            ->where('pol.product_variant_id', $variantId)
            ->sum('pol.qty');

        return (int) $qty;
    }

    /** Lead time in giorni del fornitore (default 7 se non impostato). */
    private function supplierLeadTime(int $tenantId, int $supplierId): int
    {
        $days = DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->value('lead_time_days');

        return max(1, (int) ($days ?? 7));
    }

    /** Genera un numero DDT progressivo univoco per il tenant. */
    private function generateDdtNumber(int $tenantId): string
    {
        $year  = now()->year;
        $count = DB::table('stock_transfers')
            ->where('tenant_id', $tenantId)
            ->whereYear('created_at', $year)
            ->count();

        return sprintf('DDT-%d-%04d', $year, $count + 1);
    }
}
