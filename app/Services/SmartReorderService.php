<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

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
            $topSellers = $this->topSellerQuantities($tenantId, (int) $store->id);

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
                    'pv.sale_price',
                    'pv.cost_price',
                ])
                ->get();

            foreach ($items as $item) {
                $soldQty = (int) ($topSellers[$item->product_variant_id] ?? 0);
                $available = (int) $item->on_hand - (int) $item->reserved;
                $threshold = max((int) $store->smart_reorder_threshold, (int) $item->reorder_point);

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
                    'sold_qty_30d' => $soldQty,
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

    public function runForTenant(int $tenantId): array
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

        $createdOrders = DB::transaction(function () use ($tenantId, $alerts): array {
            $orders = [];

            $grouped = $alerts->groupBy(function (array $alert) {
                return implode(':', [
                    $alert['store_id'],
                    $alert['supplier_id'] ?? 0,
                ]);
            });

            foreach ($grouped as $groupAlerts) {
                $first = $groupAlerts->first();
                $supplierId = (int) ($first['supplier_id'] ?? 0);
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
                    'total_net' => 0,
                    'notes' => 'Ordine generato automaticamente dal magazzino intelligente',
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

    private function topSellerQuantities(int $tenantId, int $storeId): array
    {
        return DB::table('sales_order_lines as sol')
            ->join('sales_orders as so', 'so.id', '=', 'sol.sales_order_id')
            ->where('so.tenant_id', $tenantId)
            ->where('so.store_id', $storeId)
            ->where('so.status', 'paid')
            ->where('so.paid_at', '>=', now()->subDays(30))
            ->groupBy('sol.product_variant_id')
            ->selectRaw('sol.product_variant_id, SUM(sol.qty) as sold_qty')
            ->orderByDesc('sold_qty')
            ->pluck('sold_qty', 'product_variant_id')
            ->map(fn ($value) => (int) $value)
            ->all();
    }
}
