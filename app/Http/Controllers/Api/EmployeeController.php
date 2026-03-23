<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $employees = $this->employeeBaseQuery($tenantId)
            ->orderByDesc('e.id')
            ->get();

        return response()->json(['data' => $employees]);
    }

    public function topPerformers(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $employees = collect($this->employeeBaseQuery($tenantId)->get())
            ->map(function ($employee) {
                $ordersCount = (int) ($employee->orders_count ?? 0);
                $netSales = (float) ($employee->total_net_sales ?? 0);
                $margin = (float) ($employee->total_margin ?? 0);
                $points = (int) ($employee->points_balance ?? 0);

                return [
                    'employee_id' => (int) $employee->id,
                    'employee_name' => trim($employee->first_name.' '.$employee->last_name),
                    'store_name' => $employee->store_name,
                    'status' => $employee->status,
                    'points_balance' => $points,
                    'orders_count' => $ordersCount,
                    'total_net_sales' => round($netSales, 2),
                    'total_margin' => round($margin, 2),
                    'avg_ticket' => $ordersCount > 0 ? round($netSales / $ordersCount, 2) : 0.0,
                    'last_sale_at' => $employee->last_sale_at,
                ];
            });

        $topPerformers = $employees
            ->sortByDesc('points_balance')
            ->sortByDesc('total_net_sales')
            ->values()
            ->map(function (array $employee, int $index) {
                $employee['rank'] = $index + 1;
                return $employee;
            })
            ->take(5)
            ->values()
            ->all();

        $activeEmployees = $employees->where('status', 'active');
        $totalOrders = (int) $employees->sum('orders_count');
        $totalNetSales = round((float) $employees->sum('total_net_sales'), 2);

        return response()->json([
            'overview' => [
                'total_employees' => $employees->count(),
                'active_employees' => $activeEmployees->count(),
                'total_orders' => $totalOrders,
                'total_net_sales' => $totalNetSales,
                'avg_ticket' => $totalOrders > 0 ? round($totalNetSales / $totalOrders, 2) : 0.0,
            ],
            'top_performers' => $topPerformers,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'store_id' => ['required', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'photo_url' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $storeExists = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $request->integer('store_id'))->exists();
        if (! $storeExists) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $employeeId = DB::table('employees')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $request->integer('store_id'),
            'user_id' => $request->input('user_id'),
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'photo_url' => $request->input('photo_url'),
            'hire_date' => $request->input('hire_date'),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('employee_point_wallets')->insert([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
            'points_balance' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Dipendente creato.', 'employee_id' => $employeeId], 201);
    }

    public function update(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->update([
                'first_name' => $request->input('first_name'),
                'last_name' => $request->input('last_name'),
                'photo_url' => $request->input('photo_url'),
                'status' => $request->input('status', 'active'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        return response()->json(['message' => 'Dipendente aggiornato.']);
    }

    private function employeeBaseQuery(int $tenantId)
    {
        $salesStats = DB::table('employee_sales_facts')
            ->where('tenant_id', $tenantId)
            ->groupBy('employee_id')
            ->selectRaw('employee_id, COUNT(*) as orders_count, COALESCE(SUM(net_amount), 0) as total_net_sales, COALESCE(SUM(margin_amount), 0) as total_margin, MAX(sold_at) as last_sale_at');

        return DB::table('employees as e')
            ->leftJoin('stores as s', 's.id', '=', 'e.store_id')
            ->leftJoin('employee_point_wallets as epw', function ($join) {
                $join->on('epw.employee_id', '=', 'e.id')->on('epw.tenant_id', '=', 'e.tenant_id');
            })
            ->leftJoinSub($salesStats, 'sales_stats', function ($join) {
                $join->on('sales_stats.employee_id', '=', 'e.id');
            })
            ->where('e.tenant_id', $tenantId)
            ->select([
                'e.*',
                's.name as store_name',
                DB::raw('COALESCE(epw.points_balance, 0) as points_balance'),
                DB::raw('COALESCE(sales_stats.orders_count, 0) as orders_count'),
                DB::raw('COALESCE(sales_stats.total_net_sales, 0) as total_net_sales'),
                DB::raw('COALESCE(sales_stats.total_margin, 0) as total_margin'),
                'sales_stats.last_sale_at',
            ]);
    }
}
