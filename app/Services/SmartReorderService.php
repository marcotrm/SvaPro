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
        $alerts = [];

        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->where('auto_reorder_enabled', true)
            ->get();

        foreach ($stores as $store) {
            $items = DB::table('stock_items as si')
                ->join('warehouses as w', 'w.id', '=', 'si.warehouse_id')
                ->join('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->leftJoin('suppliers as sup', 'sup.id', '=', 'p.default_supplier_id')
                ->where('si.tenant_id', $tenantId)
                ->where('w.store_id', $store->id)
                ->select([
                    'si.id',
                    'si.warehouse_id',
                    'si.product_variant_id',
                    'si.on_hand',
                    'si.reserved',
                    'si.reorder_point',
                    'si.safety_stock',
                    'w.name as warehouse_name',
                    'p.id as product_id',
                    'p.name as product_name',
                    'p.default_supplier_id',
                    'p.auto_reorder_enabled',
                    'p.reorder_days',
                    'p.min_stock_qty',
                    'p.scorta_sicurezza',
                    'pv.sale_price',
                    'pv.cost_price',
                    'sup.lead_time_medio',
                    'sup.name as supplier_name',
                ])
                ->get();

            foreach ($items as $item) {
                if (! $item->auto_reorder_enabled) {
                    continue;
                }

                $reorderDays = max(1, (int) ($item->reorder_days ?? 30));
                $soldQty = $this->soldQuantityForVariant(
                    $tenantId,
                    (int) $store->id,
                    (int) $item->product_variant_id,
                    $reorderDays
                );

                $available = (int) $item->on_hand - (int) $item->reserved;
                $threshold = max(
                    (int) $store->smart_reorder_threshold,
                    (int) $item->reorder_point,
                    (int) ($item->min_stock_qty ?? 0)
                );

                if ($soldQty <= 0 || $available > $threshold) {
                    continue;
                }

                $leadTime = max(1, (int) ($item->lead_time_medio ?? 7));
                $scortaSicurezza = max(0, (int) ($item->scorta_sicurezza ?? 0));

                $ottimizzazione = $this->calculateOptimalStock($tenantId, (int) $store->id, (int) $item->product_variant_id, $leadTime, $scortaSicurezza);
                
                $reorderPointDinamico = $ottimizzazione['reorder_point'];
                $targetStock = $ottimizzazione['qty_21_days'] + $scortaSicurezza; // Per coprire 21 giorni

                if ($available > $reorderPointDinamico) {
                    continue;
                }

                $suggestedQty = max(0, $targetStock - $available);
                if ($suggestedQty === 0) {
                    continue;
                }

                // Cap massimo configurabile per negozio o prodotto
                $maxQty = (int) ($store->smart_reorder_max_qty ?? 0);
                if ($maxQty > 0) {
                    $suggestedQty = min($suggestedQty, $maxQty);
                }

                $alerts[] = [
                    'store_id'           => (int) $store->id,
                    'store_name'         => $store->name,
                    'warehouse_id'       => (int) $item->warehouse_id,
                    'warehouse_name'     => $item->warehouse_name,
                    'product_id'         => (int) $item->product_id,
                    'product_variant_id' => (int) $item->product_variant_id,
                    'product_name'       => $item->product_name,
                    'available'          => $available,
                    'threshold'          => $threshold,
                    'reorder_days'       => $reorderDays,
                    'sold_qty_window'    => $soldQty,
                    'suggested_qty'      => $suggestedQty,
                    'supplier_id'        => $item->default_supplier_id,
                    'supplier_name'      => $item->supplier_name ?? 'Nessun Fornitore',
                    'unit_cost'          => (float) ($item->cost_price ?? 0),
                    'ai_motivation'      => 'Calcolo previsionale standard',
                ];
            }
        }

        // AI motivations disabilitate nel preview per evitare timeout (30s Railway)
        // Vengono usate solo nell'export PDF/email dove il tempo non è vincolato.

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
