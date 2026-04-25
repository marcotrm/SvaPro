<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SmartReorderService
{
    public function previewForTenant(int $tenantId): array
    {
        // ── UNICA QUERY SQL — tutto il calcolo avviene in PostgreSQL, 0 loop N+1 ──
        $cutoff30  = now()->subDays(30)->toDateTimeString();
        $cutoff60  = now()->subDays(60)->toDateTimeString();

        $rows = DB::select("
            SELECT
                si.id,
                si.warehouse_id,
                si.product_variant_id,
                si.on_hand,
                si.reserved,
                COALESCE(si.reorder_point, 0)                              AS reorder_point,
                COALESCE(si.safety_stock, 0)                               AS safety_stock,
                w.name                                                     AS warehouse_name,
                s.id                                                       AS store_id,
                s.name                                                     AS store_name,
                COALESCE(s.smart_reorder_threshold, 0)                     AS smart_reorder_threshold,
                COALESCE(s.smart_reorder_max_qty, 0)                       AS smart_reorder_max_qty,
                p.id                                                       AS product_id,
                p.name                                                     AS product_name,
                p.default_supplier_id,
                COALESCE(p.auto_reorder_enabled, false)                    AS auto_reorder_enabled,
                COALESCE(p.reorder_days, 30)                               AS reorder_days,
                COALESCE(p.min_stock_qty, 0)                               AS min_stock_qty,
                COALESCE(p.scorta_sicurezza, 0)                            AS scorta_sicurezza,
                pv.cost_price,
                COALESCE(sup.lead_time_medio, 7)                           AS lead_time_medio,
                sup.name                                                   AS supplier_name,

                -- Vendite 30gg (per filtro iniziale)
                COALESCE(sales30.qty, 0)                                   AS sold_30d,
                -- Vendite 60gg e 7gg (per formula ponderata)
                COALESCE(sales60.qty, 0)                                   AS sold_60d,
                COALESCE(sales7.qty, 0)                                    AS sold_7d

            FROM stock_items si
            JOIN warehouses w        ON w.id = si.warehouse_id
            JOIN stores s            ON s.id = w.store_id
            JOIN product_variants pv ON pv.id = si.product_variant_id
            JOIN products p          ON p.id = pv.product_id
            LEFT JOIN suppliers sup  ON sup.id = p.default_supplier_id

            -- Vendite aggregare 30gg
            LEFT JOIN (
                SELECT sol.product_variant_id, so.store_id, SUM(sol.qty) AS qty
                FROM sales_order_lines sol
                JOIN sales_orders so ON so.id = sol.sales_order_id
                WHERE so.tenant_id = :tid1
                  AND so.status = 'paid'
                  AND so.paid_at >= :c30
                GROUP BY sol.product_variant_id, so.store_id
            ) sales30 ON sales30.product_variant_id = si.product_variant_id
                      AND sales30.store_id = s.id

            -- Vendite aggregare 60gg
            LEFT JOIN (
                SELECT sol.product_variant_id, so.store_id, SUM(sol.qty) AS qty
                FROM sales_order_lines sol
                JOIN sales_orders so ON so.id = sol.sales_order_id
                WHERE so.tenant_id = :tid2
                  AND so.status = 'paid'
                  AND so.paid_at >= :c60
                GROUP BY sol.product_variant_id, so.store_id
            ) sales60 ON sales60.product_variant_id = si.product_variant_id
                      AND sales60.store_id = s.id

            -- Vendite aggregare 7gg
            LEFT JOIN (
                SELECT sol.product_variant_id, so.store_id, SUM(sol.qty) AS qty
                FROM sales_order_lines sol
                JOIN sales_orders so ON so.id = sol.sales_order_id
                WHERE so.tenant_id = :tid3
                  AND so.status = 'paid'
                  AND so.paid_at >= :c7
                GROUP BY sol.product_variant_id, so.store_id
            ) sales7 ON sales7.product_variant_id = si.product_variant_id
                     AND sales7.store_id = s.id

            WHERE si.tenant_id = :tid4
              AND s.tenant_id  = :tid5
        ", [
            'tid1' => $tenantId, 'c30'  => $cutoff30,
            'tid2' => $tenantId, 'c60'  => $cutoff60,
            'tid3' => $tenantId, 'c7'   => now()->subDays(7)->toDateTimeString(),
            'tid4' => $tenantId,
            'tid5' => $tenantId,
        ]);

        $alerts = [];

        foreach ($rows as $r) {
            $available = (int) $r->on_hand - (int) $r->reserved;
            $threshold = max((int) $r->smart_reorder_threshold, (int) $r->reorder_point, (int) $r->min_stock_qty);

            if ($r->sold_30d <= 0 || $available > $threshold) {
                continue;
            }

            // Formula ponderata: 70% peso ultimi 7gg, 30% ultimi 60gg
            $avg60 = max((float) $r->sold_60d / 60, 0);
            $avg7  = max((float) $r->sold_7d  /  7, 0);
            $wAvg  = ($avg7 * 0.7) + ($avg60 * 0.3);
            if ($wAvg <= 0) $wAvg = $avg60 > 0 ? $avg60 : 0.1;

            $leadTime        = max(1, (int) $r->lead_time_medio);
            $scortaSicurezza = max(0, (int) $r->scorta_sicurezza);
            $reorderPoint    = (int) ceil($wAvg * $leadTime);
            $targetStock     = (int) ceil($wAvg * 21) + $scortaSicurezza;

            if ($available > $reorderPoint) {
                continue;
            }

            $suggestedQty = max(0, $targetStock - $available);
            if ($suggestedQty === 0) continue;

            $maxQty = (int) $r->smart_reorder_max_qty;
            if ($maxQty > 0) $suggestedQty = min($suggestedQty, $maxQty);

            $alerts[] = [
                'store_id'           => (int) $r->store_id,
                'store_name'         => $r->store_name,
                'warehouse_id'       => (int) $r->warehouse_id,
                'warehouse_name'     => $r->warehouse_name,
                'product_id'         => (int) $r->product_id,
                'product_variant_id' => (int) $r->product_variant_id,
                'product_name'       => $r->product_name,
                'available'          => $available,
                'threshold'          => $threshold,
                'reorder_days'       => (int) $r->reorder_days,
                'sold_qty_window'    => (int) $r->sold_30d,
                'suggested_qty'      => $suggestedQty,
                'supplier_id'        => $r->default_supplier_id,
                'supplier_name'      => $r->supplier_name ?? 'Nessun Fornitore',
                'unit_cost'          => (float) ($r->cost_price ?? 0),
                'ai_motivation'      => 'Calcolo previsionale standard',
            ];
        }


        // Separiamo ordini suggeriti per compatibilità con il controller esistente
        $suggestedOrders = array_map(function ($a) {
            return [
                'store_name' => $a['store_name'],
                'supplier_name' => $a['supplier_name'],
                'product_name' => $a['product_name'],
                'suggested_qty' => $a['suggested_qty'],
                'unit_cost' => $a['unit_cost'],
                'ai_motivation' => $a['ai_motivation'],
            ];
        }, $alerts);

        return [
            'generated_at' => now()->toDateTimeString(),
            'alerts' => $alerts,
            'suggested_orders' => $suggestedOrders,
        ];
    }

    public function runForTenant(int $tenantId, bool $forceCentralSupplier = false): array
    {
        $preview = $this->previewForTenant($tenantId);
        $alerts = collect($preview['alerts']);

        if ($alerts->isEmpty()) {
            return [
                'generated_at' => $preview['generated_at'],
                'created_orders' => [],
                'alerts' => [],
            ];
        }

        $createdOrders = DB::transaction(function () use ($tenantId, $alerts, $forceCentralSupplier): array {
            $orders = [];
            $centralSupplierId = $this->centralSupplierId();

            $grouped = $alerts->groupBy(function (array $alert) use ($forceCentralSupplier) {
                return implode(':', [
                    $alert['store_id'],
                    $forceCentralSupplier ? 'central' : ($alert['supplier_id'] ?? 0),
                ]);
            });

            foreach ($grouped as $groupAlerts) {
                $first = $groupAlerts->first();
                $supplierId = $forceCentralSupplier
                    ? $centralSupplierId
                    : (int) ($first['supplier_id'] ?? 0);

                if ($supplierId === 0) {
                    continue;
                }

                $purchaseOrderId = DB::table('purchase_orders')->insertGetId([
                    'tenant_id' => $tenantId,
                    'store_id' => $first['store_id'],
                    'supplier_id' => $supplierId,
                    'status' => 'draft',
                    'source' => 'auto_reorder',
                    'expected_at' => now()->addDays(2),
                    'auto_generated_at' => now(),
                    'auto_generated_by' => 'smart_reorder',
                    'total_net' => 0,
                    'notes' => $forceCentralSupplier
                        ? 'Ordine generato automaticamente verso magazzino centrale'
                        : 'Ordine generato automaticamente dal magazzino intelligente',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $totalNet = 0.0;
                foreach ($groupAlerts as $alert) {
                    DB::table('purchase_order_lines')->insert([
                        'purchase_order_id' => $purchaseOrderId,
                        'product_variant_id' => $alert['product_variant_id'],
                        'qty' => $alert['suggested_qty'],
                        'unit_cost' => $alert['unit_cost'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    $totalNet += $alert['suggested_qty'] * $alert['unit_cost'];
                }

                DB::table('purchase_orders')->where('id', $purchaseOrderId)->update([
                    'total_net' => round($totalNet, 2),
                    'updated_at' => now(),
                ]);

                $orders[] = [
                    'purchase_order_id' => $purchaseOrderId,
                    'store_id' => $first['store_id'],
                    'supplier_id' => $supplierId,
                    'lines' => $groupAlerts->count(),
                    'total_net' => round($totalNet, 2),
                ];
            }

            return $orders;
        });

        return [
            'generated_at' => $preview['generated_at'],
            'created_orders' => $createdOrders,
            'alerts' => $alerts->values()->all(),
        ];
    }

    public function runAutoToCentralForTenant(int $tenantId): array
    {
        return $this->runForTenant($tenantId, true);
    }

    private function soldQuantityForVariant(int $tenantId, int $storeId, int $variantId, int $days): int
    {
        $qty = DB::table('sales_order_lines as sol')
            ->join('sales_orders as so', 'so.id', '=', 'sol.sales_order_id')
            ->where('so.tenant_id', $tenantId)
            ->where('so.store_id', $storeId)
            ->where('so.status', 'paid')
            ->where('so.paid_at', '>=', now()->subDays($days))
            ->where('sol.product_variant_id', $variantId)
            ->sum('sol.qty');

        return (int) $qty;
    }

    private function calculateOptimalStock(int $tenantId, int $storeId, int $variantId, int $leadTimeMedio, int $scortaSicurezza): array
    {
        // Ultimi 60 giorni
        $sales60 = DB::table('sales_order_lines as sol')
            ->join('sales_orders as so', 'so.id', '=', 'sol.sales_order_id')
            ->where('so.tenant_id', $tenantId)
            ->where('so.store_id', $storeId)
            ->where('so.status', 'paid')
            ->where('so.paid_at', '>=', now()->subDays(60))
            ->where('sol.product_variant_id', $variantId)
            ->selectRaw('DATE(so.paid_at) as date, SUM(sol.qty) as qty')
            ->groupBy('date')
            ->get();

        $total60 = $sales60->sum('qty');
        $avg60 = $total60 / 60;

        $sales7 = $sales60->filter(function($s) {
            return $s->date >= now()->subDays(7)->format('Y-m-d');
        })->sum('qty');
        $avg7 = $sales7 / 7;

        // Media mobile ponderata (70% per gli ultimi 7gg, 30% per i 60gg)
        $weightedAvg = ($avg7 * 0.7) + ($avg60 * 0.3);

        // Se non ci sono vendite recenti ma ci sono 60gg, usa quello. Se zero, metti 0.1 di default per non azzerare.
        if ($weightedAvg == 0 && $total60 > 0) {
            $weightedAvg = $avg60;
        } elseif ($weightedAvg == 0) {
            $weightedAvg = 0.1;
        }

        $reorderPoint = (int) ceil($weightedAvg * $leadTimeMedio);
        $qtyFor21Days = (int) ceil($weightedAvg * 21);

        return [
            'reorder_point' => $reorderPoint,
            'qty_21_days' => $qtyFor21Days,
        ];
    }

    private function centralSupplierId(): int
    {
        return (int) config('services.smart_inventory.central_supplier_id', 0);
    }

    /**
     * Esporta le suggerimenti di riordino come CSV.
     */
    public function exportCsv(int $tenantId): string
    {
        $preview = $this->previewForTenant($tenantId);
        $alerts = $preview['alerts'];

        $csv = "Negozio;Magazzino;Prodotto;Variante ID;Disponibile;Soglia;Suggerito;Fornitore;Costo Un.\n";

        foreach ($alerts as $alert) {
            $csv .= implode(';', [
                $alert['store_name'],
                $alert['warehouse_name'],
                $alert['product_name'],
                $alert['product_variant_id'],
                $alert['available'],
                $alert['threshold'],
                $alert['suggested_qty'],
                $alert['supplier_id'] ?? '',
                number_format($alert['unit_cost'], 2, ',', ''),
            ]) . "\n";
        }

        return $csv;
    }

    /**
     * Esporta le suggerimenti come PDF.
     */
    public function exportPdf(int $tenantId): string
    {
        $preview = $this->previewForTenant($tenantId);
        $alerts = $preview['alerts'];
        $tenant = DB::table('tenants')->where('id', $tenantId)->first();
        $tenantName = htmlspecialchars($tenant->name ?? 'SvaPro', ENT_QUOTES, 'UTF-8');
        $date = now()->format('d/m/Y H:i');

        $rowsHtml = '';
        foreach ($alerts as $a) {
            $rowsHtml .= '<tr>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;">' . htmlspecialchars($a['store_name'], ENT_QUOTES, 'UTF-8') . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;">' . htmlspecialchars($a['product_name'], ENT_QUOTES, 'UTF-8') . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;">' . $a['available'] . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;">' . $a['threshold'] . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;font-weight:bold;">' . $a['suggested_qty'] . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;">€ ' . number_format($a['unit_cost'], 2, ',', '.') . '</td>'
                . '</tr>';
        }

        $html = <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Smart Reorder</title></head>
<body style="font-family:DejaVu Sans,sans-serif;font-size:11px;margin:25px;">
<h2>{$tenantName} — Report Riordino Intelligente</h2>
<p style="color:#666;font-size:10px;">Generato il {$date} — {$this->count($alerts)} prodotti sotto soglia</p>
<table style="width:100%;border-collapse:collapse;margin-top:15px;">
<thead><tr style="background:#f0f0f0;">
<th style="padding:5px 6px;text-align:left;border-bottom:2px solid #333;">Negozio</th>
<th style="padding:5px 6px;text-align:left;border-bottom:2px solid #333;">Prodotto</th>
<th style="padding:5px 6px;text-align:right;border-bottom:2px solid #333;">Disp.</th>
<th style="padding:5px 6px;text-align:right;border-bottom:2px solid #333;">Soglia</th>
<th style="padding:5px 6px;text-align:right;border-bottom:2px solid #333;">Suggerito</th>
<th style="padding:5px 6px;text-align:right;border-bottom:2px solid #333;">Costo</th>
</tr></thead>
<tbody>{$rowsHtml}</tbody>
</table></body></html>
HTML;

        return Pdf::loadHTML($html)->setPaper('A4', 'landscape')->output();
    }

    /**
     * Invia email al fornitore con il riepilogo degli articoli da riordinare.
     */
    public function emailSupplier(int $tenantId, int $supplierId, array $alerts): bool
    {
        $supplier = DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->first();

        if (! $supplier || empty($supplier->email)) {
            return false;
        }

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();
        $tenantName = $tenant->name ?? 'SvaPro';

        $body = "Gentile {$supplier->name},\n\n";
        $body .= "Di seguito l'elenco dei prodotti da riordinare per {$tenantName}:\n\n";

        $rowsHtml = '';
        foreach ($alerts as $alert) {
            $body .= "- {$alert['product_name']} — Qtà suggerita: {$alert['suggested_qty']} — Costo un.: €" . number_format($alert['unit_cost'], 2, ',', '.') . "\n";
            $rowsHtml .= '<tr>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;">' . htmlspecialchars($alert['store_name'], ENT_QUOTES, 'UTF-8') . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;">' . htmlspecialchars($alert['product_name'], ENT_QUOTES, 'UTF-8') . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;">' . $alert['suggested_qty'] . '</td>'
                . '<td style="padding:3px 6px;border-bottom:1px solid #ddd;text-align:right;">€ ' . number_format($alert['unit_cost'], 2, ',', '.') . '</td>'
                . '</tr>';
        }

        $body .= "\nSi veda il file PDF allegato per maggiori dettagli.\n\nGrazie per la collaborazione.\n{$tenantName}";

        $date = now()->format('d/m/Y H:i');
        $htmlCount = $this->count($alerts);
        $html = <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ordine Fornitore</title></head>
<body style="font-family:DejaVu Sans,sans-serif;font-size:12px;margin:25px;">
<h2>{$tenantName} — Richiesta Riordino a {$supplier->name}</h2>
<p style="color:#666;font-size:11px;">Generato il {$date} — {$htmlCount} prodotti totali</p>
<table style="width:100%;border-collapse:collapse;margin-top:15px;">
<thead><tr style="background:#f0f0f0;">
<th style="padding:5px 6px;text-align:left;border-bottom:2px solid #333;">Negozio</th>
<th style="padding:5px 6px;text-align:left;border-bottom:2px solid #333;">Prodotto</th>
<th style="padding:5px 6px;text-align:right;border-bottom:2px solid #333;">Qtà Richiesta</th>
<th style="padding:5px 6px;text-align:right;border-bottom:2px solid #333;">Costo Un.</th>
</tr></thead>
<tbody>{$rowsHtml}</tbody>
</table></body></html>
HTML;

        $pdfData = Pdf::loadHTML($html)->setPaper('A4', 'portrait')->output();

        try {
            Mail::raw($body, function ($message) use ($supplier, $tenantName, $pdfData) {
                $message->to($supplier->email)
                    ->subject("Richiesta Riordino — {$tenantName}")
                    ->attachData($pdfData, 'ordine_riordino.pdf', [
                        'mime' => 'application/pdf',
                    ]);
            });
            return true;
        } catch (\Throwable $e) {
            Log::warning('Smart reorder email to supplier failed', [
                'supplier_id' => $supplierId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    private function count(array $arr): int
    {
        return count($arr);
    }
}
