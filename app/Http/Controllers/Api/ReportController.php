<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Revenue trend grouped by day/week/month.
     */
    public function revenueTrend(Request $request)
    {
        $tenantId  = $request->attributes->get('tenant_id');
        $storeId   = $request->input('store_id');
        $period    = $request->input('period', 'daily'); // daily|weekly|monthly
        $days      = (int) $request->input('days', 30);
        $days      = min($days, 365);
        $dateFrom  = $request->input('date_from'); // es. 2026-04-10
        $dateTo    = $request->input('date_to');   // es. 2026-04-10

        $dateExpr = match ($period) {
            'weekly'  => DB::raw("to_char(date_trunc('week', sales_orders.created_at AT TIME ZONE 'Europe/Rome'), 'YYYY-MM-DD') as period"),
            'monthly' => DB::raw("to_char(date_trunc('month', sales_orders.created_at AT TIME ZONE 'Europe/Rome'), 'YYYY-MM') as period"),
            default   => DB::raw("to_char((sales_orders.created_at AT TIME ZONE 'Europe/Rome')::date, 'YYYY-MM-DD') as period"),
        };

        $query = DB::table('sales_orders')
            ->where('sales_orders.tenant_id', $tenantId)
            ->where('sales_orders.status', 'paid')
            ->select(
                $dateExpr,
                DB::raw('count(*) as order_count'),
                DB::raw('sum(grand_total) as revenue'),
                DB::raw('sum(tax_total) as tax'),
                DB::raw('sum(discount_total) as discounts')
            )
            ->groupBy(DB::raw('1'))
            ->orderBy(DB::raw('1'));

        // Usa date esatte se fornite, altrimenti fallback su subDays
        if ($dateFrom && $dateTo) {
            $query->whereRaw("(sales_orders.created_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom])
                  ->whereRaw("(sales_orders.created_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]);
        } else {
            $query->where('sales_orders.created_at', '>=', now()->subDays($days));
        }

        if ($storeId) {
            $query->where('sales_orders.store_id', $storeId);
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Top selling products by quantity or revenue.
     */
    public function topProducts(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storeId  = $request->input('store_id');
        $sortBy   = $request->input('sort', 'revenue'); // revenue|qty
        $limit    = min((int) ($request->input('limit', 20) ?: 20), 100);
        $days     = min((int) ($request->input('days', 30) ?: 30), 365);

        $query = DB::table('sales_order_lines')
            ->join('sales_orders', 'sales_order_lines.sales_order_id', '=', 'sales_orders.id')
            ->join('product_variants', 'sales_order_lines.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('sales_orders.tenant_id', $tenantId)
            ->where('sales_orders.status', 'paid')
            ->where('sales_orders.created_at', '>=', now()->subDays($days))
            ->select(
                'products.id as product_id',
                'products.name as product_name',
                'product_variants.sku',
                DB::raw('sum(sales_order_lines.qty) as total_qty'),
                DB::raw('sum(sales_order_lines.line_total) as total_revenue')
            )
            ->groupBy('products.id', 'products.name', 'product_variants.sku');

        if ($storeId) {
            $query->where('sales_orders.store_id', $storeId);
        }

        $query->orderByDesc($sortBy === 'qty' ? 'total_qty' : 'total_revenue');

        return response()->json(['data' => $query->limit($limit)->get()]);
    }

    /**
     * Customer acquisition: new customers per period.
     */
    public function customerAcquisition(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $period   = $request->input('period', 'monthly');
        $days     = min((int) ($request->input('days', 180) ?: 180), 365);

        $dateExpr = match ($period) {
            'weekly'  => DB::raw("to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as period"),
            'monthly' => DB::raw("to_char(date_trunc('month', created_at), 'YYYY-MM') as period"),
            default   => DB::raw("to_char(created_at::date, 'YYYY-MM-DD') as period"),
        };

        $rows = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDays($days))
            ->select($dateExpr, DB::raw('count(*) as new_customers'))
            ->groupBy(DB::raw('1'))
            ->orderBy(DB::raw('1'))
            ->get();

        return response()->json(['data' => $rows]);
    }

    /**
     * General summary with KPIs.
     */
    public function summary(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storeId  = $request->input('store_id');
        $days     = min((int) ($request->input('days', 30) ?: 30), 365);
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        $orderBase = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid');

        // Usa date esatte se fornite dalla dashboard
        if ($dateFrom && $dateTo) {
            $orderBase->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom])
                      ->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]);
        } else {
            $orderBase->where('created_at', '>=', now()->subDays($days));
        }

        if ($storeId) {
            $orderBase->where('store_id', $storeId);
        }

        $current = (clone $orderBase)->select(
            DB::raw('count(*) as orders'),
            DB::raw('coalesce(sum(grand_total), 0) as revenue'),
            DB::raw('coalesce(avg(grand_total), 0) as avg_order')
        )->first();

        // Previous period for comparison
        $prevBase = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->where('created_at', '>=', now()->subDays($days * 2))
            ->where('created_at', '<', now()->subDays($days));

        if ($storeId) {
            $prevBase->where('store_id', $storeId);
        }

        $previous = $prevBase->select(
            DB::raw('count(*) as orders'),
            DB::raw('coalesce(sum(grand_total), 0) as revenue')
        )->first();

        $customerCount = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->count();
        $newCustomers = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDays($days))
            ->count();

        $lowStock = DB::table('stock_items')
            ->where('tenant_id', $tenantId)
            ->whereColumn('on_hand', '<', 'reorder_point')
            ->count();

        $deltaRevenue = $previous->revenue > 0
            ? round(($current->revenue - $previous->revenue) / $previous->revenue * 100, 1)
            : null;
        $deltaOrders = $previous->orders > 0
            ? round(($current->orders - $previous->orders) / $previous->orders * 100, 1)
            : null;

        return response()->json(['data' => [
            'revenue'         => round($current->revenue, 2),
            'orders'          => $current->orders,
            'avg_order'       => round($current->avg_order, 2),
            'delta_revenue'   => $deltaRevenue,
            'delta_orders'    => $deltaOrders,
            'total_customers' => $customerCount,
            'new_customers'   => $newCustomers,
            'low_stock'       => $lowStock,
        ]]);
    }
}
