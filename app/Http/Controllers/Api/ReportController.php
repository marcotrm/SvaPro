<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Enforce store_id for employees to prevent them from seeing all stores.
     */
    private function getSecureStoreId(Request $request)
    {
        $user = $request->user();
        if (!$user) return $request->input('store_id');

        $isDipendente = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->where('roles.code', 'dipendente')
            ->exists();

        if ($isDipendente) {
            $employeeStoreId = DB::table('employees')
                ->where('user_id', $user->id)
                ->value('store_id');
            if ($employeeStoreId) {
                return $employeeStoreId;
            }
        }

        return $request->input('store_id');
    }

    /**
     * Revenue trend grouped by day/week/month.
     */
    public function revenueTrend(Request $request)
    {
        $tenantId  = $request->attributes->get('tenant_id');
        $storeId   = $this->getSecureStoreId($request);
        $period    = $request->input('period', 'daily');
        $days      = min((int) ($request->input('days', 30) ?: 30), 365);
        $dateFrom  = $request->input('date_from');
        $dateTo    = $request->input('date_to');

        // SQLite-compatible date grouping
        $dateExpr = match ($period) {
            'weekly'  => DB::raw("strftime('%Y-%W', created_at) as period"),
            'monthly' => DB::raw("strftime('%Y-%m', created_at) as period"),
            default   => DB::raw("strftime('%Y-%m-%d', created_at) as period"),
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

        if ($dateFrom && $dateTo) {
            $query->whereRaw("strftime('%Y-%m-%d', created_at) >= ?", [$dateFrom])
                  ->whereRaw("strftime('%Y-%m-%d', created_at) <= ?", [$dateTo]);
        } else {
            $query->where('created_at', '>=', now()->subDays($days));
        }

        if ($storeId) {
            $query->where('store_id', $storeId);
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Top selling products by quantity or revenue.
     */
    public function topProducts(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storeId  = $this->getSecureStoreId($request);
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
            'weekly'  => DB::raw("strftime('%Y-%W', created_at) as period"),
            'monthly' => DB::raw("strftime('%Y-%m', created_at) as period"),
            default   => DB::raw("strftime('%Y-%m-%d', created_at) as period"),
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
        $storeId  = $this->getSecureStoreId($request);
        $days     = min((int) ($request->input('days', 30) ?: 30), 365);
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        try {
            $orderBase = DB::table('sales_orders')
                ->where('tenant_id', $tenantId)
                ->where('status', 'paid');

            // SQLite-compatible date filtering
            if ($dateFrom && $dateTo) {
                $orderBase->whereRaw("strftime('%Y-%m-%d', created_at) >= ?", [$dateFrom])
                          ->whereRaw("strftime('%Y-%m-%d', created_at) <= ?", [$dateTo]);
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

            $lowStock = 0;
            try {
                $lowStock = DB::table('stock_items')
                    ->where('tenant_id', $tenantId)
                    ->whereColumn('on_hand', '<', 'reorder_point')
                    ->count();
            } catch (\Throwable $e) {}

            $deltaRevenue = $previous->revenue > 0
                ? round(($current->revenue - $previous->revenue) / $previous->revenue * 100, 1)
                : null;
            $deltaOrders = $previous->orders > 0
                ? round(($current->orders - $previous->orders) / $previous->orders * 100, 1)
                : null;

            // Breakdown per metodo di pagamento
            // Usa gli stessi ordini del revenue (whereIn evita problemi di alias JOIN in SQLite)
            $cashTotal = 0; $cardTotal = 0; $otherTotal = 0;
            try {
                $matchingIds = (clone $orderBase)->pluck('id');
                if ($matchingIds->isNotEmpty()) {
                    $cashTotal  = DB::table('payments')
                        ->whereIn('sales_order_id', $matchingIds)
                        ->whereIn('method', ['cash', 'contanti'])
                        ->sum('amount');
                    $cardTotal  = DB::table('payments')
                        ->whereIn('sales_order_id', $matchingIds)
                        ->whereIn('method', ['card', 'carta', 'pos'])
                        ->sum('amount');
                    $otherTotal = DB::table('payments')
                        ->whereIn('sales_order_id', $matchingIds)
                        ->whereNotIn('method', ['cash', 'contanti', 'card', 'carta', 'pos'])
                        ->sum('amount');
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('ReportController::summary payments query failed: ' . $e->getMessage());
            }

            // Items sold
            $itemsSold = 0;
            try {
                $itemsSoldQuery = DB::table('sales_order_lines as sol')
                    ->join('sales_orders as so', 'so.id', '=', 'sol.sales_order_id')
                    ->where('so.tenant_id', $tenantId)
                    ->where('so.status', 'paid')
                    ->when($storeId, fn($q) => $q->where('so.store_id', $storeId));

                if ($dateFrom && $dateTo) {
                    $itemsSoldQuery->whereRaw("strftime('%Y-%m-%d', so.created_at) >= ?", [$dateFrom])
                                   ->whereRaw("strftime('%Y-%m-%d', so.created_at) <= ?", [$dateTo]);
                } else {
                    $itemsSoldQuery->where('so.created_at', '>=', now()->subDays($days));
                }

                $itemsSold = $itemsSoldQuery->sum('sol.qty');
            } catch (\Throwable $e) {}

            $upt = $current->orders > 0 ? round($itemsSold / $current->orders, 2) : 0;

            return response()->json(['data' => [
                'revenue'          => round($current->revenue, 2),
                'total_revenue'    => round($current->revenue, 2),
                'orders'           => $current->orders,
                'total_orders'     => $current->orders,
                'avg_order'        => round($current->avg_order, 2),
                'avg_ticket'       => round($current->avg_order, 2),
                'delta_revenue'    => $deltaRevenue,
                'delta_orders'     => $deltaOrders,
                'total_customers'  => $customerCount,
                'unique_customers' => $customerCount,
                'new_customers'    => $newCustomers,
                'low_stock'        => $lowStock,
                'cash_total'       => round((float) $cashTotal, 2),
                'card_total'       => round((float) $cardTotal, 2),
                'other_total'      => round((float) $otherTotal, 2),
                'items_sold'       => (int) $itemsSold,
                'upt'              => $upt,
            ]]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ReportController::summary error: ' . $e->getMessage());
            return response()->json(['message' => 'Errore nel calcolo del riepilogo.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * QScare Dashboard: returns QScare orders and summary.
     */
    public function qscareDashboard(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storeId  = $this->getSecureStoreId($request);
        $employeeId = $request->input('employee_id');
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        $query = DB::table('sales_order_lines')
            ->join('sales_orders', 'sales_order_lines.sales_order_id', '=', 'sales_orders.id')
            ->leftJoin('employees', 'sales_orders.sold_by_employee_id', '=', 'employees.id')
            ->leftJoin('stores', 'sales_orders.store_id', '=', 'stores.id')
            ->where('sales_orders.tenant_id', $tenantId)
            ->where('sales_orders.status', 'paid')
            // Le righe QScare: product_variant_id = NULL e tax_snapshot_json contiene product_type=service
            ->whereNull('sales_order_lines.product_variant_id')
            ->whereRaw(
                "sales_order_lines.tax_snapshot_json IS NOT NULL AND json_extract(sales_order_lines.tax_snapshot_json, '$.product_type') = 'service'"
            )
            ->select(
                'sales_orders.id as order_id',
                'sales_orders.created_at',
                'sales_order_lines.qty',
                'sales_order_lines.unit_price',
                DB::raw("COALESCE(json_extract(sales_order_lines.tax_snapshot_json, '$.service_name'), 'QScare') as service_name"),
                DB::raw('COALESCE(sales_order_lines.line_total, sales_order_lines.qty * sales_order_lines.unit_price) as line_total'),
                'stores.name as store_name',
                DB::raw("COALESCE(employees.first_name || ' ' || employees.last_name, '—') as employee_name")
            );

        if ($storeId) {
            $query->where('sales_orders.store_id', $storeId);
        }
        if ($employeeId) {
            $query->where('sales_orders.sold_by_employee_id', $employeeId);
        }
        if ($dateFrom) {
            $query->whereRaw("strftime('%Y-%m-%d', sales_orders.created_at) >= ?", [$dateFrom]);
        }
        if ($dateTo) {
            $query->whereRaw("strftime('%Y-%m-%d', sales_orders.created_at) <= ?", [$dateTo]);
        }
        
        $lines = $query->orderByDesc('sales_orders.created_at')->get();

        $totalRevenue = $lines->sum('line_total');
        $totalQty = $lines->sum('qty');

        return response()->json([
            'data' => $lines,
            'summary' => [
                'total_revenue' => $totalRevenue,
                'total_qty' => $totalQty
            ]
        ]);
    }
}
