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
                    'pv.sale_price',
                    'pv.cost_price',
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

                $targetStock = max(
                    $threshold * 4,
                    (int) $item->safety_stock + $threshold,
                    $soldQty * 2
                );

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
                    'store_id' => (int) $store->id,
                    'store_name' => $store->name,
                    'warehouse_id' => (int) $item->warehouse_id,
                    'warehouse_name' => $item->warehouse_name,
                    'product_id' => (int) $item->product_id,
                    'product_variant_id' => (int) $item->product_variant_id,
                    'product_name' => $item->product_name,
                    'available' => $available,
                    'threshold' => $threshold,
                    'reorder_days' => $reorderDays,
                    'sold_qty_window' => $soldQty,
                    'suggested_qty' => $suggestedQty,
                    'supplier_id' => $item->default_supplier_id,
                    'unit_cost' => (float) ($item->cost_price ?? 0),
                ];
            }
        }

        return [
            'generated_at' => now()->toDateTimeString(),
            'alerts' => $alerts,
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

        foreach ($alerts as $alert) {
            $body .= "- {$alert['product_name']} — Qtà suggerita: {$alert['suggested_qty']} — Costo un.: €" . number_format($alert['unit_cost'], 2, ',', '.') . "\n";
        }

        $body .= "\nGrazie per la collaborazione.\n{$tenantName}";

        try {
            Mail::raw($body, function ($message) use ($supplier, $tenantName) {
                $message->to($supplier->email)
                    ->subject("Richiesta Riordino — {$tenantName}");
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
