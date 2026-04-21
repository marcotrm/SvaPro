<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\EmployeeNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $request->filled('store_id') ? (int) $request->integer('store_id') : null;
        $barcode  = $request->input('barcode');

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        // Ricerca rapida per barcode, ID o nome (usata da Chat/Cassa/Tesoreria/Kiosk)
        if ($barcode) {
            $emp = DB::table('employees')
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->where(function($q) use ($barcode) {
                    $q->where('barcode', $barcode)                     // match esatto
                      ->orWhere('barcode', 'like', '%-' . $barcode)   // suffix: '5555' trova 'DIP-XXX-5555'
                      ->orWhere('id', (int) $barcode)
                      ->orWhere('first_name', 'like', '%' . $barcode . '%')
                      ->orWhere('last_name', 'like', '%' . $barcode . '%');
                })
                ->select(['id', 'first_name', 'last_name', 'barcode', 'store_id'])
                ->first();
            return response()->json(['data' => $emp ? [$emp] : []]);
        }

        $employees = $this->employeeBaseQuery($tenantId, $storeId)
            ->where('e.status', 'active')
            ->orderByDesc('e.id')
            ->get();

        return response()->json(['data' => $employees]);
    }

    /**
     * GET /employees/global-list
     * Restituisce TUTTI i dipendenti attivi del tenant, indipendentemente dallo store.
     * Usato dal Jolly picker nella pianificazione turni.
     * Legge tenant_id dall'attribute (impostato dal middleware, sicuro),
     * ma ignora il store_id forzato dal middleware per ruoli dipendente/store_manager.
     */
    public function globalList(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $employees = DB::table('employees as e')
            ->leftJoin('stores as s', 's.id', '=', 'e.store_id')
            ->where('e.tenant_id', $tenantId)
            ->where('e.status', 'active')
            ->orderBy('e.first_name')
            ->select([
                'e.id',
                'e.first_name',
                'e.last_name',
                'e.barcode',
                'e.employee_code',
                'e.max_spending_limit',
                'e.price_list_id',
                'e.store_id',
                'e.photo_url',
                'e.status',
                'e.expected_start_time',
                's.name as store_name',
            ])
            ->get()
            ->map(fn($e) => array_merge((array) $e, [
                'name' => trim("{$e->first_name} {$e->last_name}"),
            ]));

        return response()->json(['data' => $employees]);
    }

    public function topPerformers(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $employees = collect($this->employeeBaseQuery($tenantId, $storeId)->get())
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
            'store_id'   => ['required', 'integer'],
            'user_id'    => ['nullable', 'integer'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name'  => ['required', 'string', 'max:100'],
            'photo_url'  => ['nullable', 'string'],
            'hire_date'  => ['nullable', 'date'],
            'barcode'    => ['nullable', 'string', 'max:100'],
            'employee_code' => ['nullable', 'string', 'max:50'],
            'max_spending_limit' => ['nullable', 'numeric', 'min:0'],
            'price_list_id' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $storeExists = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $request->integer('store_id'))->exists();
        if (! $storeExists) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $employeeId = DB::table('employees')->insertGetId([
            'tenant_id'  => $tenantId,
            'store_id'   => $request->integer('store_id'),
            'user_id'    => $request->input('user_id'),
            'first_name' => $request->input('first_name'),
            'last_name'  => $request->input('last_name'),
            'photo_url'  => $request->input('photo_url'),
            'barcode'    => $request->input('barcode') ?: null,
            'employee_code' => $request->input('employee_code') ?: null,
            'max_spending_limit' => $request->input('max_spending_limit') !== null ? (float) $request->input('max_spending_limit') : null,
            'price_list_id' => $request->input('price_list_id') ? (int) $request->input('price_list_id') : null,
            'hire_date'  => $request->input('hire_date'),
            'status'     => 'active',
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

        AuditLogger::log($request, 'create', 'employee', $employeeId, $request->input('first_name') . ' ' . $request->input('last_name'));

        return response()->json(['message' => 'Dipendente creato.', 'employee_id' => $employeeId], 201);
    }

    public function destroy(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $employee = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->first();

        if (!$employee) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        // Elimina foto da storage se presente
        if ($employee->photo_url && str_starts_with($employee->photo_url, '/storage/')) {
            $path = str_replace('/storage/', '', $employee->photo_url);
            Storage::disk('public')->delete($path);
        }

        // Soft-delete: imposta status = deleted e svuota i dati sensibili
        DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->update([
                'status'     => 'deleted',
                'updated_at' => now(),
            ]);

        // Opzionale: elimina wallet punti
        DB::table('employee_point_wallets')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->delete();

        AuditLogger::log($request, 'delete', 'employee', $employeeId,
            ($employee->first_name ?? '') . ' ' . ($employee->last_name ?? ''));

        return response()->json(['message' => 'Dipendente eliminato.']);
    }

    public function uploadPhoto(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $employee = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->first();

        if (!$employee) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:2048'],
        ]);

        // Elimina foto precedente
        if ($employee->photo_url && str_starts_with($employee->photo_url, '/storage/')) {
            $oldPath = str_replace('/storage/', '', $employee->photo_url);
            Storage::disk('public')->delete($oldPath);
        }

        $path = $request->file('photo')->store("employees/tenant_{$tenantId}", 'public');
        $photoUrl = '/storage/' . $path;

        DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->update(['photo_url' => $photoUrl, 'updated_at' => now()]);

        AuditLogger::log($request, 'upload_photo', 'employee', $employeeId,
            ($employee->first_name ?? '') . ' ' . ($employee->last_name ?? ''));

        return response()->json(['message' => 'Foto caricata.', 'photo_url' => $photoUrl]);
    }

    public function update(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $old = DB::table('employees')->where('tenant_id', $tenantId)->where('id', $employeeId)->first();

        $updated = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->update([
                'store_id'   => $request->input('store_id') ? (int) $request->input('store_id') : DB::raw('store_id'),
                'first_name' => $request->input('first_name'),
                'last_name'  => $request->input('last_name'),
                'photo_url'  => $request->input('photo_url'),
                'barcode'    => $request->input('barcode') ?: null,
                'employee_code' => $request->input('employee_code') ?: null,
                'max_spending_limit' => $request->input('max_spending_limit') !== null ? (float) $request->input('max_spending_limit') : null,
                'price_list_id' => $request->input('price_list_id') ? (int) $request->input('price_list_id') : null,
                'status'     => $request->input('status', 'active'),
                'hire_date'  => $request->input('hire_date'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        AuditLogger::log($request, 'update', 'employee', $employeeId, ($old->first_name ?? '') . ' ' . ($old->last_name ?? ''));

        return response()->json(['message' => 'Dipendente aggiornato.']);
    }

    private function employeeBaseQuery(int $tenantId, ?int $storeId = null)
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
            ->when($storeId !== null, fn ($query) => $query->where('e.store_id', $storeId)->whereNotNull('e.store_id'))
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

    public function notifications(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        if (! DB::table('employees')->where('tenant_id', $tenantId)->where('id', $employeeId)->exists()) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        $svc = new EmployeeNotificationService();
        $unread = $svc->getUnread($tenantId, $employeeId, 50);

        $all = DB::table('employee_notifications')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'unread_count' => count($unread),
            'data' => $all,
        ]);
    }

    public function markNotificationRead(Request $request, int $employeeId, int $notificationId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $svc = new EmployeeNotificationService();
        $marked = $svc->markAsRead($tenantId, $employeeId, $notificationId);

        if (! $marked) {
            return response()->json(['message' => 'Notifica non trovata.'], 404);
        }

        return response()->json(['message' => 'Notifica letta.']);
    }

    public function markAllNotificationsRead(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $svc = new EmployeeNotificationService();
        $count = $svc->markAllAsRead($tenantId, $employeeId);

        return response()->json(['message' => $count . ' notifiche segnate come lette.']);
    }

    public function kpiDashboard(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;
        $period = $request->input('period', date('Y-m')); // YYYY-MM

        // Current month boundaries
        $monthStart = $period . '-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));

        // Previous month boundaries
        $prevMonthStart = date('Y-m-01', strtotime($monthStart . ' -1 month'));
        $prevMonthEnd = date('Y-m-t', strtotime($prevMonthStart));

        // Build employee query with this month's sales
        $currentSales = DB::table('employee_sales_facts')
            ->where('tenant_id', $tenantId)
            ->whereBetween('sold_at', [$monthStart, $monthEnd . ' 23:59:59'])
            ->groupBy('employee_id')
            ->selectRaw('employee_id, COUNT(*) as orders_count, COALESCE(SUM(net_amount), 0) as net_sales, COALESCE(SUM(margin_amount), 0) as margin');

        $prevSales = DB::table('employee_sales_facts')
            ->where('tenant_id', $tenantId)
            ->whereBetween('sold_at', [$prevMonthStart, $prevMonthEnd . ' 23:59:59'])
            ->groupBy('employee_id')
            ->selectRaw('employee_id, COUNT(*) as orders_count, COALESCE(SUM(net_amount), 0) as net_sales, COALESCE(SUM(margin_amount), 0) as margin');

        $employees = DB::table('employees as e')
            ->leftJoin('stores as s', 's.id', '=', 'e.store_id')
            ->leftJoinSub($currentSales, 'cs', fn ($j) => $j->on('cs.employee_id', '=', 'e.id'))
            ->leftJoinSub($prevSales, 'ps', fn ($j) => $j->on('ps.employee_id', '=', 'e.id'))
            ->leftJoin('employee_kpi_targets as t', function ($j) use ($period) {
                $j->on('t.employee_id', '=', 'e.id')->where('t.period', '=', $period);
            })
            ->where('e.tenant_id', $tenantId)
            ->where('e.status', 'active')
            ->when($storeId, fn ($q) => $q->where('e.store_id', $storeId))
            ->select([
                'e.id', 'e.first_name', 'e.last_name', 'e.hire_date',
                's.name as store_name',
                DB::raw('COALESCE(cs.orders_count, 0) as current_orders'),
                DB::raw('COALESCE(cs.net_sales, 0) as current_sales'),
                DB::raw('COALESCE(cs.margin, 0) as current_margin'),
                DB::raw('COALESCE(ps.orders_count, 0) as prev_orders'),
                DB::raw('COALESCE(ps.net_sales, 0) as prev_sales'),
                DB::raw('COALESCE(ps.margin, 0) as prev_margin'),
                't.sales_target', 't.orders_target',
            ])
            ->get()
            ->map(function ($e) {
                $e->current_avg_ticket = $e->current_orders > 0 ? round($e->current_sales / $e->current_orders, 2) : 0;
                $e->prev_avg_ticket = $e->prev_orders > 0 ? round($e->prev_sales / $e->prev_orders, 2) : 0;
                $e->sales_growth = $e->prev_sales > 0
                    ? round((($e->current_sales - $e->prev_sales) / $e->prev_sales) * 100, 1)
                    : ($e->current_sales > 0 ? 100 : 0);
                $e->target_progress = ($e->sales_target ?? 0) > 0
                    ? round(($e->current_sales / $e->sales_target) * 100, 1)
                    : null;
                return $e;
            });

        // Aggregated overview
        $totalCurrentSales = $employees->sum('current_sales');
        $totalPrevSales = $employees->sum('prev_sales');
        $totalCurrentOrders = $employees->sum('current_orders');

        $dailySales = DB::table('employee_sales_facts')
            ->where('tenant_id', $tenantId)
            ->whereBetween('sold_at', [$monthStart, $monthEnd . ' 23:59:59'])
            ->when($storeId, function ($q) use ($storeId, $tenantId) {
                $q->whereIn('employee_id', function ($sub) use ($storeId, $tenantId) {
                    $sub->select('id')->from('employees')
                        ->where('tenant_id', $tenantId)->where('store_id', $storeId);
                });
            })
            ->selectRaw('DATE(sold_at) as day, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as sales')
            ->groupByRaw('DATE(sold_at)')
            ->orderBy('day')
            ->get();

        return response()->json([
            'overview' => [
                'period' => $period,
                'active_employees' => $employees->count(),
                'total_orders' => (int) $totalCurrentOrders,
                'total_sales' => round((float) $totalCurrentSales, 2),
                'total_prev_sales' => round((float) $totalPrevSales, 2),
                'sales_growth' => $totalPrevSales > 0
                    ? round((($totalCurrentSales - $totalPrevSales) / $totalPrevSales) * 100, 1)
                    : 0,
                'avg_ticket' => $totalCurrentOrders > 0
                    ? round($totalCurrentSales / $totalCurrentOrders, 2)
                    : 0,
            ],
            'employees' => $employees->sortByDesc('current_sales')->values(),
            'daily_trend' => $dailySales,
        ]);
    }

    public function setKpiTarget(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
            'sales_target' => ['nullable', 'numeric', 'min:0'],
            'orders_target' => ['nullable', 'integer', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (! DB::table('employees')->where('tenant_id', $tenantId)->where('id', $employeeId)->exists()) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        DB::table('employee_kpi_targets')->updateOrInsert(
            ['employee_id' => $employeeId, 'period' => $request->input('period')],
            [
                'tenant_id' => $tenantId,
                'sales_target' => $request->input('sales_target', 0),
                'orders_target' => $request->integer('orders_target', 0),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json(['message' => 'Target KPI impostato.']);
    }
}
