<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class ForecastingService
{
    /**
     * Calcola la velocità di vendita e i giorni rimanenti per tutte le varianti di un tenant.
     */
    public function getForecastForTenant(int $tenantId): array
    {
        $lookbackDays = 30;
        $now = now();
        $startDate = now()->subDays($lookbackDays);

        // 1. Calcola vendite totali per variante negli ultimi 30 giorni
        $sales = DB::table('sales_order_lines as sol')
            ->join('sales_orders as so', 'so.id', '=', 'sol.sales_order_id')
            ->where('so.tenant_id', $tenantId)
            ->where('so.status', 'paid')
            ->where('so.created_at', '>=', $startDate)
            ->select('sol.product_variant_id', DB::raw('SUM(sol.qty) as total_sold'))
            ->groupBy('sol.product_variant_id')
            ->get()
            ->keyBy('product_variant_id');

        // 2. Recupera stock attuale e info prodotto
        $variants = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pv.tenant_id', $tenantId)
            ->select([
                'pv.id as variant_id',
                'p.name as product_name',
                'pv.flavor',
                'p.sku',
                'p.reorder_days',
                'p.min_stock_qty'
            ])
            ->get();

        $stock = DB::table('stock_items')
            ->where('tenant_id', $tenantId)
            ->select('product_variant_id', DB::raw('SUM(on_hand) as total_on_hand'))
            ->groupBy('product_variant_id')
            ->get()
            ->keyBy('product_variant_id');

        $forecasts = [];

        foreach ($variants as $variant) {
            $sold = $sales->get($variant->variant_id)->total_sold ?? 0;
            $onHand = $stock->get($variant->variant_id)->total_on_hand ?? 0;
            
            $dailyRunRate = $sold / $lookbackDays;
            $daysLeft = $dailyRunRate > 0 ? floor($onHand / $dailyRunRate) : 999;
            
            // Suggerimento di riordino per coprire i prossimi 30 giorni se siamo vicini al lead time
            $isCritical = $daysLeft <= ($variant->reorder_days ?: 7);
            $suggestedQty = 0;
            
            if ($isCritical) {
                // Formula: (Daily Rate * 30 giorni desiderati) - Stock attuale
                $desiredStock = ceil($dailyRunRate * 30);
                $suggestedQty = max(0, $desiredStock - $onHand);
                
                // Se la velocità è zero ma siamo sotto il min_stock_qty, suggeriamo comunque il minimo
                if ($onHand < $variant->min_stock_qty && $suggestedQty == 0) {
                    $suggestedQty = $variant->min_stock_qty - $onHand;
                }
            }

            $forecasts[] = [
                'variant_id'    => $variant->variant_id,
                'sku'           => $variant->sku,
                'name'          => "{$variant->product_name} " . ($variant->flavor ? "({$variant->flavor})" : ""),
                'on_hand'       => (int) $onHand,
                'daily_rate'    => round($dailyRunRate, 2),
                'days_left'     => $daysLeft,
                'is_critical'   => $isCritical,
                'suggested_qty' => (int) $suggestedQty,
                'reorder_days'  => $variant->reorder_days
            ];
        }

        return $forecasts;
    }
}
