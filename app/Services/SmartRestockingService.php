<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * SmartRestockingService
 *
 * FLUSSO A (Distribuzione — Deposito → Negozi):
 *   - Per ogni negozio fisico, trova varianti con disponibilità < scorta_minima
 *   - Raggruppa per negozio e genera bozze DDT (stock_transfers)
 *   - Se il deposito centrale ha stock insufficiente, aggiunge warning alla riga
 *
 * FLUSSO B (Acquisti — Fornitori → Deposito):
 *   - Analizza SOLO il deposito centrale
 *   - Trova varianti con disponibilità < scorta_minima
 *   - Mappa brand_id → fornitore primario (brand_suppliers)
 *   - Raggruppa per fornitore e genera bozze PO (purchase_orders)
 */
class SmartRestockingService
{
    /**
     * Esegui l'intero calcolo fabbisogno per un tenant.
     * Restituisce un summary dell'esecuzione.
     */
    public function calculate(int $tenantId, string $triggeredBy = 'manual'): array
    {
        $ddtResults = $this->flowA_NetworkNeeds($tenantId);
        $poResults  = $this->flowB_DepotNeeds($tenantId);

        $runId = DB::table('smart_restocking_runs')->insertGetId([
            'tenant_id'          => $tenantId,
            'triggered_by'       => $triggeredBy,
            'ddt_drafts_created' => $ddtResults['drafts_created'],
            'po_drafts_created'  => $poResults['drafts_created'],
            'warnings_count'     => $ddtResults['warnings_count'],
            'summary'            => json_encode([
                'ddt' => $ddtResults,
                'po'  => $poResults,
            ]),
            'calculated_at' => now(),
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return [
            'run_id'        => $runId,
            'triggered_by'  => $triggeredBy,
            'calculated_at' => now()->toDateTimeString(),
            'ddt'           => $ddtResults,
            'po'            => $poResults,
        ];
    }

    /* ─────────────────────────────────────────────────────────────────── */
    /* FLUSSO A: Fabbisogno Rete (Deposito → Negozi)                      */
    /* ─────────────────────────────────────────────────────────────────── */

    public function getNetworkNeeds(int $tenantId): array
    {
        // Magazzini dei negozi fisici (type = 'store')
        $storeWarehouses = DB::table('warehouses as w')
            ->join('stores as s', 's.id', '=', 'w.store_id')
            ->where('w.tenant_id', $tenantId)
            ->where('w.type', 'store')
            ->select('w.id as warehouse_id', 'w.name as warehouse_name', 's.id as store_id', 's.name as store_name')
            ->get();

        // Deposito centrale (type = 'central' oppure il primo non-store)
        $centralWarehouse = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('type', 'central')
                  ->orWhere('type', 'depot');
            })
            ->first()
            ?? DB::table('warehouses')
                ->where('tenant_id', $tenantId)
                ->orderBy('id')
                ->first();

        $centralStockMap = [];
        if ($centralWarehouse) {
            $centralItems = DB::table('stock_items')
                ->where('warehouse_id', $centralWarehouse->id)
                ->get(['product_variant_id', 'on_hand', 'reserved']);
            foreach ($centralItems as $ci) {
                $centralStockMap[$ci->product_variant_id] = max(0, $ci->on_hand - $ci->reserved);
            }
        }

        $deficitsByStore = [];

        foreach ($storeWarehouses as $wh) {
            $deficits = DB::table('stock_items as si')
                ->join('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('si.warehouse_id', $wh->warehouse_id)
                ->where('si.scorta_minima', '>', 0)
                ->whereRaw('(si.on_hand - si.reserved) < si.scorta_minima')
                ->select([
                    'si.id as stock_item_id',
                    'si.product_variant_id',
                    'si.on_hand',
                    'si.reserved',
                    'si.scorta_minima',
                    'si.quantita_riordino_target',
                    'p.id as product_id',
                    'p.name as product_name',
                    'p.sku',
                    'pv.flavor',
                ])
                ->get();

            if ($deficits->isEmpty()) continue;

            $lines = [];
            foreach ($deficits as $d) {
                $available       = max(0, $d->on_hand - $d->reserved);
                $needed          = max(0, ($d->quantita_riordino_target > 0 ? $d->quantita_riordino_target : $d->scorta_minima) - $available);
                $centralHas      = $centralStockMap[$d->product_variant_id] ?? 0;
                $hasWarning      = $centralHas < $needed;

                $lines[] = [
                    'product_variant_id' => $d->product_variant_id,
                    'product_name'       => $d->product_name . ($d->flavor ? " ({$d->flavor})" : ''),
                    'sku'                => $d->sku,
                    'available'          => $available,
                    'scorta_minima'      => (int) $d->scorta_minima,
                    'needed_qty'         => $needed,
                    'central_available'  => $centralHas,
                    'warning'            => $hasWarning
                        ? "Deposito centrale ha solo {$centralHas} pz (richiesti {$needed})"
                        : null,
                ];
            }

            if (!empty($lines)) {
                $deficitsByStore[] = [
                    'warehouse_id'   => $wh->warehouse_id,
                    'warehouse_name' => $wh->warehouse_name,
                    'store_id'       => $wh->store_id,
                    'store_name'     => $wh->store_name,
                    'lines'          => $lines,
                    'total_lines'    => count($lines),
                    'has_warnings'   => collect($lines)->contains(fn($l) => $l['warning'] !== null),
                    // Eventuale DDT bozza esistente per questo magazzino
                    'draft_transfer_id' => $this->getExistingDraftDdt($tenantId, $wh->store_id),
                ];
            }
        }

        return [
            'stores'          => $deficitsByStore,
            'total_stores'    => count($deficitsByStore),
            'central_warehouse' => $centralWarehouse ? [
                'id'   => $centralWarehouse->id,
                'name' => $centralWarehouse->name,
            ] : null,
        ];
    }

    /**
     * FLUSSO A: Genera bozze DDT (stock_transfers) per ogni negozio in deficit.
     */
    public function flowA_NetworkNeeds(int $tenantId): array
    {
        $networkNeeds = $this->getNetworkNeeds($tenantId);
        $draftsCreated = 0;
        $warnings      = 0;

        $centralWh = $networkNeeds['central_warehouse'];
        if (!$centralWh) {
            return ['drafts_created' => 0, 'warnings_count' => 0, 'error' => 'Nessun deposito centrale trovato'];
        }

        foreach ($networkNeeds['stores'] as $storeData) {
            if (empty($storeData['lines'])) continue;

            // Salta se esiste già un DDT bozza per questo negozio
            if ($storeData['draft_transfer_id']) continue;

            $ddtNumber = 'DDT-AUTO-' . now()->format('ymd') . '-' . $storeData['store_id'];

            DB::transaction(function () use ($tenantId, $centralWh, $storeData, $ddtNumber, &$draftsCreated, &$warnings) {
                $transferId = DB::table('stock_transfers')->insertGetId([
                    'tenant_id'        => $tenantId,
                    'ddt_number'       => $ddtNumber . '-' . uniqid(),
                    'from_store_id'    => DB::table('warehouses')->where('id', $centralWh['id'])->value('store_id')
                                         ?? DB::table('stores')->where('tenant_id', $tenantId)->orderBy('id')->value('id'),
                    'to_store_id'      => $storeData['store_id'],
                    'status'           => 'draft',
                    'notes'            => 'Generato automaticamente da Smart Restocking',
                    'is_ai_generated'  => true,
                    'created_at'       => now(),
                    'updated_at'       => now(),
                ]);

                foreach ($storeData['lines'] as $line) {
                    if ($line['needed_qty'] <= 0) continue;

                    DB::table('stock_transfer_items')->insert([
                        'transfer_id'        => $transferId,
                        'product_variant_id' => $line['product_variant_id'],
                        'quantity_sent'      => $line['needed_qty'],
                        'notes'              => $line['warning'] ?? null,
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);

                    if ($line['warning']) $warnings++;
                }

                $draftsCreated++;
            });
        }

        return [
            'drafts_created' => $draftsCreated,
            'warnings_count' => $warnings,
            'stores_analyzed'=> count($networkNeeds['stores']),
        ];
    }

    /* ─────────────────────────────────────────────────────────────────── */
    /* FLUSSO B: Fabbisogno Deposito (Fornitori → Deposito Centrale)       */
    /* ─────────────────────────────────────────────────────────────────── */

    public function getDepotNeeds(int $tenantId): array
    {
        // Deposito centrale
        $centralWarehouse = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('type', 'central')
                  ->orWhere('type', 'depot');
            })
            ->first()
            ?? DB::table('warehouses')
                ->where('tenant_id', $tenantId)
                ->orderBy('id')
                ->first();

        if (!$centralWarehouse) {
            return ['suppliers' => [], 'total_suppliers' => 0, 'error' => 'Nessun deposito centrale'];
        }
        // Magazzino Centrale usa una logica dinamica basata sui giorni di scorta:
        // Considera lo stock totale della rete e le vendite degli ultimi 30 giorni.
        $cutoff30 = now()->subDays(30)->toDateTimeString();

        $rows = DB::select("
            WITH network_stock AS (
                SELECT product_variant_id, SUM(on_hand - reserved) as total_available
                FROM stock_items
                WHERE tenant_id = :tid1
                GROUP BY product_variant_id
            ),
            sales_30d AS (
                SELECT sol.product_variant_id, SUM(sol.qty) as sold_qty
                FROM sales_order_lines sol
                JOIN sales_orders so ON so.id = sol.sales_order_id
                WHERE so.tenant_id = :tid2
                  AND so.status = 'paid'
                  AND so.paid_at >= :c30
                GROUP BY sol.product_variant_id
            )
            SELECT
                pv.id as product_variant_id,
                COALESCE(ns.total_available, 0) as total_available,
                p.id as product_id,
                p.name as product_name,
                p.sku,
                p.brand_id,
                b.name as brand_name,
                pv.flavor,
                pv.cost_price,
                COALESCE(sup.lead_time_medio, 7) as lead_time_medio,
                COALESCE(s30.sold_qty, 0) as sold_30d
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            LEFT JOIN brands b ON b.id = p.brand_id
            LEFT JOIN network_stock ns ON ns.product_variant_id = pv.id
            LEFT JOIN sales_30d s30 ON s30.product_variant_id = pv.id
            LEFT JOIN suppliers sup ON sup.id = p.default_supplier_id
            WHERE pv.tenant_id = :tid3
        ", [
            'tid1' => $tenantId,
            'tid2' => $tenantId,
            'c30'  => $cutoff30,
            'tid3' => $tenantId
        ]);

        $deficits = collect();
        foreach ($rows as $r) {
            $sold30d = (int) $r->sold_30d;
            $dailyBurn = $sold30d / 30.0;
            
            // Se non ci sono vendite, non facciamo riordini automatici per il deposito centrale.
            if ($dailyBurn <= 0) continue; 

            $leadTime = max(1, (int) $r->lead_time_medio);
            $minDays = 20; // Giorni minimi di copertura
            $maxDays = 30; // Giorni massimi target da ripristinare

            $reorderPoint = (int) ceil(($leadTime + $minDays) * $dailyBurn);
            $targetStock  = (int) ceil(($leadTime + $maxDays) * $dailyBurn);

            $available = (int) $r->total_available; // Scorta totale rete

            if ($available < $reorderPoint) {
                $neededQty = max(0, $targetStock - $available);
                if ($neededQty > 0) {
                    // Mappiamo le property per renderle compatibili col resto del codice
                    $r->on_hand = $available;
                    $r->reserved = 0;
                    $r->scorta_minima = $reorderPoint;
                    $r->quantita_riordino_target = $targetStock;
                    $deficits->push($r);
                }
            }
        }

        if ($deficits->isEmpty()) {
            return ['suppliers' => [], 'total_suppliers' => 0, 'warehouse' => [
                'id'   => $centralWarehouse->id,
                'name' => $centralWarehouse->name,
            ]];
        }

        // Mappa brand_id → supplier_id primario
        $brandIds = $deficits->pluck('brand_id')->filter()->unique()->all();
        $brandSupplierMap = [];

        if (!empty($brandIds)) {
            $mappings = DB::table('brand_suppliers as bs')
                ->join('suppliers as s', 's.id', '=', 'bs.supplier_id')
                ->where('bs.tenant_id', $tenantId)
                ->whereIn('bs.brand_id', $brandIds)
                ->where('bs.is_primario', true)
                ->select('bs.brand_id', 'bs.supplier_id', 's.name as supplier_name', 's.email as supplier_email')
                ->get();

            foreach ($mappings as $m) {
                $brandSupplierMap[$m->brand_id] = [
                    'supplier_id'    => $m->supplier_id,
                    'supplier_name'  => $m->supplier_name,
                    'supplier_email' => $m->supplier_email,
                ];
            }
        }

        // Fallback: prodotti con default_supplier_id
        $defaultSupplierIds = DB::table('products as p')
            ->whereIn('p.id', $deficits->pluck('product_id')->unique()->all())
            ->whereNotNull('p.default_supplier_id')
            ->join('suppliers as s', 's.id', '=', 'p.default_supplier_id')
            ->select('p.brand_id', 'p.default_supplier_id as supplier_id', 's.name as supplier_name', 's.email as supplier_email')
            ->get();

        // Raggruppa per fornitore
        $bySupplier = [];

        foreach ($deficits as $d) {
            $available = max(0, $d->on_hand - $d->reserved);
            $neededQty = max(0, ($d->quantita_riordino_target > 0 ? $d->quantita_riordino_target : $d->scorta_minima) - $available);
            if ($neededQty <= 0) continue;

            // Cerca fornitore: brand_suppliers → default_supplier
            $sup = $brandSupplierMap[$d->brand_id] ?? null;
            if (!$sup) {
                $fallback = $defaultSupplierIds->firstWhere('brand_id', $d->brand_id);
                $sup = $fallback ? [
                    'supplier_id'    => $fallback->supplier_id,
                    'supplier_name'  => $fallback->supplier_name,
                    'supplier_email' => $fallback->supplier_email,
                ] : [
                    'supplier_id'    => null,
                    'supplier_name'  => 'Fornitore non mappato',
                    'supplier_email' => null,
                ];
            }

            $key = $sup['supplier_id'] ?? 'unmapped';
            if (!isset($bySupplier[$key])) {
                $bySupplier[$key] = [
                    'supplier_id'    => $sup['supplier_id'],
                    'supplier_name'  => $sup['supplier_name'],
                    'supplier_email' => $sup['supplier_email'] ?? null,
                    'lines'          => [],
                    'total_value'    => 0.0,
                    // Eventuale PO bozza esistente per questo fornitore
                    'draft_po_id'    => $sup['supplier_id']
                        ? $this->getExistingDraftPo($tenantId, (int) $sup['supplier_id'])
                        : null,
                ];
            }

            $lineValue = round((float) $d->cost_price * $neededQty, 2);

            $bySupplier[$key]['lines'][] = [
                'product_variant_id' => $d->product_variant_id,
                'product_name'       => $d->product_name . ($d->flavor ? " ({$d->flavor})" : ''),
                'sku'                => $d->sku,
                'brand_name'         => $d->brand_name,
                'available'          => $available,
                'scorta_minima'      => (int) $d->scorta_minima,
                'needed_qty'         => $neededQty,
                'cost_price'         => (float) $d->cost_price,
                'line_value'         => $lineValue,
            ];

            $bySupplier[$key]['total_value'] += $lineValue;
        }

        // Ordina: unmapped alla fine
        uasort($bySupplier, fn($a, $b) => is_null($a['supplier_id']) <=> is_null($b['supplier_id']));

        return [
            'warehouse'       => ['id' => $centralWarehouse->id, 'name' => $centralWarehouse->name],
            'suppliers'       => array_values($bySupplier),
            'total_suppliers' => count($bySupplier),
        ];
    }

    /**
     * FLUSSO B: Genera bozze PO per i fornitori in fabbisogno.
     */
    public function flowB_DepotNeeds(int $tenantId): array
    {
        $depotNeeds    = $this->getDepotNeeds($tenantId);
        $draftsCreated = 0;

        foreach ($depotNeeds['suppliers'] as $supData) {
            if (!$supData['supplier_id'] || empty($supData['lines'])) continue;
            if ($supData['draft_po_id']) continue; // già esiste bozza

            DB::transaction(function () use ($tenantId, $supData, &$draftsCreated) {
                $totalNet = collect($supData['lines'])->sum('line_value');

                $poId = DB::table('purchase_orders')->insertGetId([
                    'tenant_id'         => $tenantId,
                    'supplier_id'       => $supData['supplier_id'],
                    'status'            => 'draft',
                    'total_net'         => $totalNet,
                    'auto_generated_at' => now(),
                    'auto_generated_by' => 'smart_restocking',
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ]);

                foreach ($supData['lines'] as $line) {
                    if ($line['needed_qty'] <= 0) continue;

                    DB::table('purchase_order_lines')->insert([
                        'purchase_order_id'  => $poId,
                        'product_variant_id' => $line['product_variant_id'],
                        'qty'                => $line['needed_qty'],
                        'unit_cost'          => $line['cost_price'],
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }

                $draftsCreated++;
            });
        }

        return [
            'drafts_created'    => $draftsCreated,
            'suppliers_analyzed'=> count($depotNeeds['suppliers']),
        ];
    }

    /* ─────────────────────────────────────────────────────────────────── */
    /* GESTIONE MATRICE APPROVVIGIONAMENTO (brand → fornitore)             */
    /* ─────────────────────────────────────────────────────────────────── */

    public function getBrandSupplierMatrix(int $tenantId): array
    {
        $brands = DB::table('brands')
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name']);

        $mappings = DB::table('brand_suppliers as bs')
            ->join('suppliers as s', 's.id', '=', 'bs.supplier_id')
            ->where('bs.tenant_id', $tenantId)
            ->get(['bs.brand_id', 'bs.supplier_id', 'bs.is_primario', 's.name as supplier_name']);

        $matrix = [];
        foreach ($brands as $brand) {
            $brandMappings = $mappings->where('brand_id', $brand->id)->values();
            $matrix[] = [
                'brand_id'   => $brand->id,
                'brand_name' => $brand->name,
                'suppliers'  => $brandMappings->map(fn($m) => [
                    'supplier_id'   => $m->supplier_id,
                    'supplier_name' => $m->supplier_name,
                    'is_primario'   => (bool) $m->is_primario,
                ])->all(),
            ];
        }

        return $matrix;
    }

    public function upsertBrandSupplier(int $tenantId, int $brandId, int $supplierId, bool $isPrimario): void
    {
        // Se diventa primario, azzera gli altri
        if ($isPrimario) {
            DB::table('brand_suppliers')
                ->where('tenant_id', $tenantId)
                ->where('brand_id', $brandId)
                ->where('supplier_id', '!=', $supplierId)
                ->update(['is_primario' => false, 'updated_at' => now()]);
        }

        DB::table('brand_suppliers')->upsert(
            [
                'tenant_id'   => $tenantId,
                'brand_id'    => $brandId,
                'supplier_id' => $supplierId,
                'is_primario' => $isPrimario,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            ['tenant_id', 'brand_id', 'supplier_id'],
            ['is_primario', 'updated_at']
        );
    }

    public function removeBrandSupplier(int $tenantId, int $brandId, int $supplierId): void
    {
        DB::table('brand_suppliers')
            ->where('tenant_id', $tenantId)
            ->where('brand_id', $brandId)
            ->where('supplier_id', $supplierId)
            ->delete();
    }

    /* ─────────────────────────────────────────────────────────────────── */
    /* HELPERS                                                             */
    /* ─────────────────────────────────────────────────────────────────── */

    private function getExistingDraftDdt(int $tenantId, int $toStoreId): ?int
    {
        return DB::table('stock_transfers')
            ->where('tenant_id', $tenantId)
            ->where('to_store_id', $toStoreId)
            ->where('status', 'draft')
            ->where('is_ai_generated', true)
            ->value('id');
    }

    private function getExistingDraftPo(int $tenantId, int $supplierId): ?int
    {
        return DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('supplier_id', $supplierId)
            ->where('status', 'draft')
            ->where('auto_generated_by', 'smart_restocking')
            ->value('id');
    }

    public function getLastRun(int $tenantId): ?object
    {
        return DB::table('smart_restocking_runs')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('calculated_at')
            ->first();
    }
}
