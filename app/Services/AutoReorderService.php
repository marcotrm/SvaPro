<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * AutoReorderService — Agente Backend
 *
 * Formula applicata per ogni variante/store:
 *   fabbisogno_lordo = (vendite_30gg / 30) * lead_time + safety_stock
 *                      - (stock_negozio + stock_centrale + in_transito)
 *
 * Arrotondamento al lotto:
 *   qty_finale = ceil(fabbisogno_lordo / lot_size) * lot_size
 *   qty_finale = max(qty_finale, moq)   ← rispetta il minimo d'ordine
 *
 * REGOLE BACKEND:
 *  - Tutta la matematica qui, zero logica nel frontend
 *  - Tutte le scritture in transazione ACID
 *  - Soft-delete: purchase_orders usa status = 'cancelled', mai DELETE
 */
class AutoReorderService
{
    /**
     * Calcola il fabbisogno e genera (o simula) le bozze ordine.
     *
     * @param  int        $tenantId
     * @param  array|null $supplierIds  Filtra per fornitori specifici (null = tutti)
     * @param  bool       $dryRun       true = calcola ma NON scrive nel DB
     * @return array
     */
    public function generate(int $tenantId, ?array $supplierIds = null, bool $dryRun = false): array
    {
        // ── 1. Recupera negozi abilitati al riordino automatico ─────────────
        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->where('auto_reorder_enabled', true)
            ->get(['id', 'name']);

        if ($stores->isEmpty()) {
            return $this->emptyResult('Nessun negozio con auto_reorder_enabled=true');
        }

        $storeIds      = $stores->pluck('id')->all();
        $storeNamesMap = $stores->pluck('name', 'id');

        // ── 2. Costruisce la query principale: varianti sotto soglia ─────────
        //    Una query singola per performance: calcola vendite 30gg,
        //    stock negozio, stock centrale e in-transito in SQL.
        $rows = $this->fetchCandidateVariants($tenantId, $storeIds, $supplierIds);

        if ($rows->isEmpty()) {
            return $this->emptyResult('Nessuna variante richiede riordino');
        }

        // ── 3. Calcolo matematico per ogni riga ─────────────────────────────
        $lines    = [];
        $skipped  = 0;

        foreach ($rows as $row) {
            // Guard: lead_time = 0 → usa 1 giorno (evita calcolo nullo)
            $leadTime = max(1, (int) ($row->lead_time_giorni ?? $row->lead_time_medio ?? 7));

            // Vendite giornaliere medie (30 giorni)
            $sales30d = (float) ($row->sales_30d ?? 0);
            $dailyAvg = $sales30d / 30.0;

            // Safety stock: prende il valore più alto tra prodotto e stock_items
            $safetyStock = max(
                (int) ($row->safety_stock_qty ?? 0),
                (int) ($row->scorta_sicurezza ?? 0),
                (int) ($row->safety_stock ?? 0)
            );

            // In-transito: null-safe (ordini in stato sent/confirmed non ancora received)
            $inTransito = max(0, (int) ($row->in_transito ?? 0));

            // Stock disponibile totale
            $stockNegozi   = max(0, (int) ($row->stock_negozi ?? 0));
            $stockCentrale = max(0, (int) ($row->stock_centrale ?? 0));
            $stockTotale   = $stockNegozi + $stockCentrale + $inTransito;

            // Formula principale
            $fabbisognoLordo = ($dailyAvg * $leadTime) + $safetyStock - $stockTotale;

            // Se non serve nulla → salta
            if ($fabbisognoLordo <= 0) {
                $skipped++;
                continue;
            }

            // MOQ e lot_size: override prodotto ha priorità su quello fornitore
            $moq     = max(1, (int) ($row->moq_override ?? $row->moq ?? 1));
            $lotSize = max(1, (int) ($row->lot_size_override ?? $row->lot_size ?? 1));

            // Arrotondamento al lotto superiore
            $qtyLotto  = (int) ceil($fabbisognoLordo / $lotSize) * $lotSize;
            // Rispetta MOQ
            $qtyFinale = max($qtyLotto, $moq);

            $unitCost  = (float) ($row->cost_price ?? 0);
            $lineTotal = round($qtyFinale * $unitCost, 2);

            $lines[] = [
                'store_id'           => (int) $row->store_id,
                'store_name'         => $storeNamesMap[(int) $row->store_id] ?? '',
                'supplier_id'        => (int) $row->supplier_id,
                'supplier_name'      => $row->supplier_name ?? 'N/D',
                'product_variant_id' => (int) $row->product_variant_id,
                'product_name'       => $row->product_name,
                'sales_30d'          => (int) $sales30d,
                'daily_avg'          => round($dailyAvg, 4),
                'lead_time_giorni'   => $leadTime,
                'safety_stock'       => $safetyStock,
                'stock_negozi'       => $stockNegozi,
                'stock_centrale'     => $stockCentrale,
                'in_transito'        => $inTransito,
                'fabbisogno_lordo'   => round($fabbisognoLordo, 2),
                'qty_arrotondata_lotto' => $qtyLotto,
                'moq_applicato'      => $moq,
                'qty_finale'         => $qtyFinale,
                'unit_cost'          => $unitCost,
                'line_total'         => $lineTotal,
            ];
        }

        if (empty($lines)) {
            return $this->emptyResult('Calcolo completato: nessun fabbisogno netto positivo');
        }

        // ── 4. Scrittura in DB (solo se non dry_run) ─────────────────────────
        $createdOrders = [];
        if (!$dryRun) {
            $createdOrders = DB::transaction(function () use ($tenantId, $lines): array {
                return $this->persistDrafts($tenantId, $lines);
            });
        }

        return [
            'generated_at'         => now()->toIso8601String(),
            'dry_run'              => $dryRun,
            'drafts_created'       => count($createdOrders),
            'skipped_no_need'      => $skipped,
            'lines'                => $dryRun ? $this->groupLinesBySupplierStore($lines) : $createdOrders,
        ];
    }

    // ────────────────────────────────────────────────────────────────────────
    // Query principale: una sola query aggregata per performance
    // ────────────────────────────────────────────────────────────────────────
    private function fetchCandidateVariants(int $tenantId, array $storeIds, ?array $supplierIds): \Illuminate\Support\Collection
    {
        $query = DB::table('stock_items as si')
            ->join('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('warehouses as w', 'w.id', '=', 'si.warehouse_id')
            ->join('suppliers as sup', 'sup.id', '=', 'p.default_supplier_id')
            ->where('si.tenant_id', $tenantId)
            ->whereIn('w.store_id', $storeIds)
            ->where('p.auto_reorder_enabled', true)
            ->whereNotNull('p.default_supplier_id')
            // Sotto-query: vendite degli ultimi 30 giorni per variante/negozio
            ->selectRaw("
                si.product_variant_id,
                w.store_id,
                p.id                  AS product_id,
                p.name                AS product_name,
                p.default_supplier_id AS supplier_id,
                p.scorta_sicurezza,
                p.safety_stock_qty,
                p.moq_override,
                p.lot_size_override,
                sup.name              AS supplier_name,
                sup.moq,
                sup.lot_size,
                COALESCE(NULLIF(sup.lead_time_giorni, 0), NULLIF(sup.lead_time_medio, 0), 7) AS lead_time_giorni,
                pv.cost_price,
                -- Stock nel negozio corrente
                COALESCE(si.on_hand, 0) - COALESCE(si.reserved, 0) AS stock_negozi,
                -- Scorta di sicurezza da stock_items (reorder_point usato come fallback)
                COALESCE(si.safety_stock, si.reorder_point, 0) AS safety_stock,
                -- Vendite ultimi 30gg
                COALESCE((
                    SELECT SUM(sol.qty)
                    FROM sales_order_lines sol
                    JOIN sales_orders so ON so.id = sol.sales_order_id
                    WHERE so.tenant_id = si.tenant_id
                      AND so.store_id  = w.store_id
                      AND so.status    = 'paid'
                      AND so.paid_at  >= NOW() - INTERVAL '30 days'
                      AND sol.product_variant_id = si.product_variant_id
                ), 0) AS sales_30d,
                -- Stock magazzino centrale (warehouse non legato a negozio)
                COALESCE((
                    SELECT SUM(si2.on_hand - COALESCE(si2.reserved, 0))
                    FROM stock_items si2
                    JOIN warehouses w2 ON w2.id = si2.warehouse_id
                    WHERE si2.tenant_id = si.tenant_id
                      AND si2.product_variant_id = si.product_variant_id
                      AND w2.store_id IS NULL
                ), 0) AS stock_centrale,
                -- Ordini in transito: purchase_order_lines già ordinate non ancora ricevute
                COALESCE((
                    SELECT SUM(pol.qty)
                    FROM purchase_order_lines pol
                    JOIN purchase_orders po ON po.id = pol.purchase_order_id
                    WHERE po.tenant_id   = si.tenant_id
                      AND po.store_id   = w.store_id
                      AND po.status     IN ('confirmed', 'sent')
                      AND pol.product_variant_id = si.product_variant_id
                ), 0) AS in_transito
            ");

        if (!empty($supplierIds)) {
            $query->whereIn('p.default_supplier_id', $supplierIds);
        }

        return $query->get();
    }

    // ────────────────────────────────────────────────────────────────────────
    // Scrittura transazionale: raggruppa per store + fornitore → 1 PO per gruppo
    // ────────────────────────────────────────────────────────────────────────
    private function persistDrafts(int $tenantId, array $lines): array
    {
        $orders = [];
        $now    = now();

        // Raggruppa per (store_id, supplier_id)
        $groups = [];
        foreach ($lines as $line) {
            $key = "{$line['store_id']}:{$line['supplier_id']}";
            $groups[$key][] = $line;
        }

        foreach ($groups as $groupLines) {
            $first    = $groupLines[0];
            $totalNet = array_sum(array_column($groupLines, 'line_total'));

            $poId = DB::table('purchase_orders')->insertGetId([
                'tenant_id'          => $tenantId,
                'store_id'           => $first['store_id'],
                'supplier_id'        => $first['supplier_id'],
                'status'             => 'draft',
                'source'             => 'auto_reorder',
                'total_net'          => round($totalNet, 2),
                'expected_at'        => $now->copy()->addDays(
                    max(1, (int) ($first['lead_time_giorni'] ?? 7))
                ),
                'auto_generated_at'  => $now,
                'auto_generated_by'  => 'AutoReorderService',
                'notes'              => 'Bozza generata automaticamente — in attesa di approvazione',
                'created_at'         => $now,
                'updated_at'         => $now,
            ]);

            foreach ($groupLines as $line) {
                DB::table('purchase_order_lines')->insert([
                    'purchase_order_id'  => $poId,
                    'product_variant_id' => $line['product_variant_id'],
                    'qty'                => $line['qty_finale'],
                    'unit_cost'          => $line['unit_cost'],
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ]);
            }

            $orders[] = [
                'purchase_order_id' => $poId,
                'store_id'          => $first['store_id'],
                'store_name'        => $first['store_name'],
                'supplier_id'       => $first['supplier_id'],
                'supplier_name'     => $first['supplier_name'],
                'status'            => 'draft',
                'total_net'         => round($totalNet, 2),
                'lines_count'       => count($groupLines),
                'items'             => $groupLines,
            ];
        }

        return $orders;
    }

    private function groupLinesBySupplierStore(array $lines): array
    {
        $groups = [];
        foreach ($lines as $line) {
            $key = "{$line['store_id']}:{$line['supplier_id']}";
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'store_id'     => $line['store_id'],
                    'store_name'   => $line['store_name'],
                    'supplier_id'  => $line['supplier_id'],
                    'supplier_name'=> $line['supplier_name'],
                    'total_net'    => 0,
                    'lines_count'  => 0,
                    'items'        => [],
                ];
            }
            $groups[$key]['items'][]   = $line;
            $groups[$key]['total_net'] += $line['line_total'];
            $groups[$key]['lines_count']++;
        }
        return array_values($groups);
    }

    private function emptyResult(string $reason): array
    {
        return [
            'generated_at'   => now()->toIso8601String(),
            'dry_run'        => false,
            'drafts_created' => 0,
            'skipped_no_need'=> 0,
            'reason'         => $reason,
            'lines'          => [],
        ];
    }
}
