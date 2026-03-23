<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StoreController extends Controller
{
    public function tenants(Request $request): JsonResponse
    {
        $user = $request->user();

        $roleCodes = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->pluck('roles.code')
            ->all();

        $isSuperAdmin = in_array('superadmin', $roleCodes, true);

        $query = DB::table('tenants')
            ->orderBy('name')
            ->select(['id', 'code', 'name', 'status']);

        if (! $isSuperAdmin) {
            $query->where('id', (int) $user->tenant_id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'city', 'is_main']);

        return response()->json(['data' => $stores]);
    }

    /**
     * Superadmin Control Tower – per-tenant health metrics.
     */
    public function tenantHealth(Request $request): JsonResponse
    {
        $user = $request->user();

        $isSuperAdmin = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->where('roles.code', 'superadmin')
            ->exists();

        if (! $isSuperAdmin) {
            return response()->json(['message' => 'Permessi insufficienti.'], 403);
        }

        $tenants = DB::table('tenants')->orderBy('name')->get(['id', 'code', 'name', 'status']);

        $result = [];

        foreach ($tenants as $tenant) {
            $tid = (int) $tenant->id;

            $storeCount = DB::table('stores')->where('tenant_id', $tid)->count();

            $orderStats = DB::table('sales_orders')
                ->where('tenant_id', $tid)
                ->selectRaw("COUNT(*) as total_orders, COALESCE(SUM(grand_total),0) as total_revenue, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_orders")
                ->first();

            $lowStockCount = DB::table('stock_items')
                ->where('tenant_id', $tid)
                ->whereColumn('on_hand', '<', 'reorder_point')
                ->count();

            $customerCount = DB::table('customers')->where('tenant_id', $tid)->count();

            $employeeCount = DB::table('employees')->where('tenant_id', $tid)->count();

            $productCount = DB::table('products')->where('tenant_id', $tid)->count();

            $adminCount = DB::table('users as u')
                ->join('user_roles as ur', 'ur.user_id', '=', 'u.id')
                ->join('roles as r', 'r.id', '=', 'ur.role_id')
                ->where('u.tenant_id', $tid)
                ->where('r.code', 'admin_cliente')
                ->where('u.status', 'active')
                ->count();

            $result[] = [
                'tenant_id' => $tid,
                'code' => $tenant->code,
                'name' => $tenant->name,
                'status' => $tenant->status,
                'stores' => $storeCount,
                'admins' => $adminCount,
                'products' => $productCount,
                'customers' => $customerCount,
                'employees' => $employeeCount,
                'total_orders' => (int) ($orderStats->total_orders ?? 0),
                'paid_orders' => (int) ($orderStats->paid_orders ?? 0),
                'total_revenue' => round((float) ($orderStats->total_revenue ?? 0), 2),
                'low_stock_items' => $lowStockCount,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function tenantSettings(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        if (! $tenant) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        return response()->json([
            'data' => [
                'id'           => $tenant->id,
                'name'         => $tenant->name,
                'code'         => $tenant->code,
                'vat_number'   => $tenant->vat_number,
                'timezone'     => $tenant->timezone,
                'status'       => $tenant->status,
                'settings_json' => $tenant->settings_json ? json_decode($tenant->settings_json, true) : null,
            ],
        ]);
    }

    public function updateTenantSettings(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('tenants')
            ->where('id', $tenantId)
            ->update([
                'name'          => $request->input('name'),
                'vat_number'    => $request->input('vat_number'),
                'timezone'      => $request->input('timezone', 'Europe/Rome'),
                'settings_json' => $request->has('settings_json') ? json_encode($request->input('settings_json')) : DB::raw('settings_json'),
                'updated_at'    => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        AuditLogger::log($request, 'update', 'tenant', $tenantId, $request->input('name'));

        return response()->json(['message' => 'Impostazioni tenant aggiornate.']);
    }
}
