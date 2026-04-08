<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class StoreController extends Controller
{
    // ─── Lista negozi per tenant ────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->get([
                'id', 'code', 'name', 'address', 'city', 'zip_code', 'country',
                'phone', 'email', 'timezone', 'is_main',
                'opening_hours', 'default_start_time', 'late_tolerance_minutes',
                'auto_reorder_enabled',
            ])
            ->map(fn($s) => $this->formatStore($s));

        return response()->json(['data' => $stores]);
    }

    // ─── Singolo negozio con presenze live ──────────────────────────
    public function show(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->where('id', $storeId)
            ->first();

        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        // Presenze live di oggi
        $liveAttendance = DB::table('employee_attendances as a')
            ->join('employees as e', 'e.id', '=', 'a.employee_id')
            ->where('a.tenant_id', $tenantId)
            ->where('a.store_id', $storeId)
            ->whereDate('a.checked_in_at', now()->toDateString())
            ->whereNull('a.checked_out_at')
            ->select(['e.first_name', 'e.last_name', 'a.checked_in_at', 'a.late_minutes'])
            ->get()
            ->map(fn($r) => [
                'name'          => trim("{$r->first_name} {$r->last_name}"),
                'checked_in_at' => $r->checked_in_at,
                'late_minutes'  => $r->late_minutes,
            ]);

        return response()->json([
            'data' => array_merge(
                (array) $this->formatStore($store),
                ['live_attendance' => $liveAttendance]
            ),
        ]);
    }

    // ─── Crea negozio ───────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'name'                   => ['required', 'string', 'max:120'],
            'code'                   => ['required', 'string', 'max:20'],
            'address'                => ['nullable', 'string', 'max:255'],
            'city'                   => ['nullable', 'string', 'max:100'],
            'zip_code'               => ['nullable', 'string', 'max:10'],
            'country'                => ['nullable', 'string', 'max:10'],
            'phone'                  => ['nullable', 'string', 'max:30'],
            'email'                  => ['nullable', 'email', 'max:150'],
            'timezone'               => ['nullable', 'string', 'max:50'],
            'is_main'                => ['nullable', 'boolean'],
            'opening_hours'          => ['nullable', 'array'],
            'default_start_time'     => ['nullable', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'late_tolerance_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
        ]);

        // Codice univoco per tenant
        if (DB::table('stores')->where('tenant_id', $tenantId)->where('code', $request->input('code'))->exists()) {
            return response()->json(['errors' => ['code' => ['Codice negozio già in uso.']]], 422);
        }

        $now = now();
        $id = DB::table('stores')->insertGetId([
            'tenant_id'              => $tenantId,
            'code'                   => strtoupper(trim($request->input('code'))),
            'name'                   => trim($request->input('name')),
            'address'                => $request->input('address'),
            'city'                   => $request->input('city'),
            'zip_code'               => $request->input('zip_code'),
            'country'                => $request->input('country', 'IT'),
            'phone'                  => $request->input('phone'),
            'email'                  => $request->input('email'),
            'timezone'               => $request->input('timezone', 'Europe/Rome'),
            'is_main'                => (bool) $request->boolean('is_main', false),
            'opening_hours'          => $request->has('opening_hours')
                ? json_encode($request->input('opening_hours'))
                : null,
            'default_start_time'     => $request->input('default_start_time'),
            'late_tolerance_minutes' => (int) $request->input('late_tolerance_minutes', 10),
            'auto_reorder_enabled'   => true,
            'created_at'             => $now,
            'updated_at'             => $now,
        ]);

        // Crea magazzino default per il nuovo negozio
        $warehouseExists = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('name', 'LIKE', '%' . trim($request->input('name')) . '%')
            ->exists();

        if (!$warehouseExists) {
            DB::table('warehouses')->insert([
                'tenant_id'  => $tenantId,
                'name'       => 'Magazzino ' . trim($request->input('name')),
                'code'       => strtoupper(trim($request->input('code'))) . '-WH',
                'store_id'   => $id,
                'is_default' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        AuditLogger::log($request, 'create', 'store', $id, $request->input('name'));

        return response()->json(['message' => 'Negozio creato.', 'store_id' => $id], 201);
    }

    // ─── Aggiorna negozio ───────────────────────────────────────────
    public function update(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->first();
        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        $request->validate([
            'name'                   => ['sometimes', 'string', 'max:120'],
            'code'                   => ['sometimes', 'string', 'max:20'],
            'address'                => ['nullable', 'string', 'max:255'],
            'city'                   => ['nullable', 'string', 'max:100'],
            'zip_code'               => ['nullable', 'string', 'max:10'],
            'phone'                  => ['nullable', 'string', 'max:30'],
            'email'                  => ['nullable', 'email', 'max:150'],
            'timezone'               => ['nullable', 'string', 'max:50'],
            'is_main'                => ['nullable', 'boolean'],
            'opening_hours'          => ['nullable', 'array'],
            'default_start_time'     => ['nullable', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'late_tolerance_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
        ]);

        $payload = array_filter([
            'name'                   => $request->input('name'),
            'address'                => $request->input('address'),
            'city'                   => $request->input('city'),
            'zip_code'               => $request->input('zip_code'),
            'phone'                  => $request->input('phone'),
            'email'                  => $request->input('email'),
            'timezone'               => $request->input('timezone'),
            'default_start_time'     => $request->input('default_start_time'),
            'late_tolerance_minutes' => $request->filled('late_tolerance_minutes')
                ? (int) $request->input('late_tolerance_minutes') : null,
        ], fn($v) => $v !== null);

        if ($request->has('is_main')) {
            $payload['is_main'] = (bool) $request->boolean('is_main');
        }
        if ($request->has('opening_hours')) {
            $payload['opening_hours'] = json_encode($request->input('opening_hours'));
        }
        $payload['updated_at'] = now();

        DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->update($payload);

        AuditLogger::log($request, 'update', 'store', $storeId, $request->input('name', $store->name));

        return response()->json(['message' => 'Negozio aggiornato.']);
    }

    // ─── Elimina negozio ────────────────────────────────────────────
    public function destroy(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->first();
        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        if ($store->is_main) {
            return response()->json(['message' => 'Non puoi eliminare il negozio principale.'], 422);
        }

        DB::table('stores')->where('id', $storeId)->delete();

        AuditLogger::log($request, 'delete', 'store', $storeId, $store->name);

        return response()->json(['message' => 'Negozio eliminato.']);
    }

    // ─── Helpers ────────────────────────────────────────────────────
    private function formatStore(\stdClass $s): array
    {
        $oh = $s->opening_hours ? json_decode($s->opening_hours, true) : null;

        // Calcola se il negozio è aperto adesso
        $isOpenNow = false;
        if ($oh) {
            $tz  = $s->timezone ?? 'Europe/Rome';
            $now = Carbon::now($tz);
            $day = strtolower($now->format('D')); // mon, tue, ...
            $todayHours = $oh[$day] ?? null;
            if ($todayHours && !($todayHours['closed'] ?? false)) {
                $openTime  = Carbon::createFromFormat('H:i', $todayHours['open']  ?? '00:00', $tz);
                $closeTime = Carbon::createFromFormat('H:i', $todayHours['close'] ?? '23:59', $tz);
                $isOpenNow = $now->between($openTime, $closeTime);
            }
        }

        return [
            'id'                     => $s->id,
            'code'                   => $s->code,
            'name'                   => $s->name,
            'address'                => $s->address,
            'city'                   => $s->city,
            'zip_code'               => $s->zip_code ?? null,
            'country'                => $s->country ?? 'IT',
            'phone'                  => $s->phone ?? null,
            'email'                  => $s->email ?? null,
            'timezone'               => $s->timezone ?? 'Europe/Rome',
            'is_main'                => (bool) ($s->is_main ?? false),
            'opening_hours'          => $oh,
            'default_start_time'     => $s->default_start_time ?? null,
            'late_tolerance_minutes' => (int) ($s->late_tolerance_minutes ?? 10),
            'is_open_now'            => $isOpenNow,
            'auto_reorder_enabled'   => (bool) ($s->auto_reorder_enabled ?? true),
        ];
    }

    // ─── Superadmin methods (unchanged) ─────────────────────────────
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
        $result  = [];

        foreach ($tenants as $tenant) {
            $tid        = (int) $tenant->id;
            $storeCount = DB::table('stores')->where('tenant_id', $tid)->count();
            $orderStats = DB::table('sales_orders')
                ->where('tenant_id', $tid)
                ->selectRaw("COUNT(*) as total_orders, COALESCE(SUM(grand_total),0) as total_revenue, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_orders")
                ->first();

            $result[] = [
                'tenant_id'      => $tid,
                'code'           => $tenant->code,
                'name'           => $tenant->name,
                'status'         => $tenant->status,
                'stores'         => $storeCount,
                'admins'         => DB::table('users as u')->join('user_roles as ur', 'ur.user_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'ur.role_id')->where('u.tenant_id', $tid)->where('r.code', 'admin_cliente')->where('u.status', 'active')->count(),
                'products'       => DB::table('products')->where('tenant_id', $tid)->count(),
                'customers'      => DB::table('customers')->where('tenant_id', $tid)->count(),
                'employees'      => DB::table('employees')->where('tenant_id', $tid)->count(),
                'total_orders'   => (int) ($orderStats->total_orders ?? 0),
                'paid_orders'    => (int) ($orderStats->paid_orders ?? 0),
                'total_revenue'  => round((float) ($orderStats->total_revenue ?? 0), 2),
                'low_stock_items'=> 0,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function tenantSettings(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $tenant   = DB::table('tenants')->where('id', $tenantId)->first();

        if (!$tenant) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        return response()->json(['data' => [
            'id'           => $tenant->id,
            'name'         => $tenant->name,
            'code'         => $tenant->code,
            'vat_number'   => $tenant->vat_number,
            'timezone'     => $tenant->timezone,
            'status'       => $tenant->status,
            'settings_json'=> $tenant->settings_json ? json_decode($tenant->settings_json, true) : null,
        ]]);
    }

    public function updateTenantSettings(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('tenants')->where('id', $tenantId)->update([
            'name'          => $request->input('name'),
            'vat_number'    => $request->input('vat_number'),
            'timezone'      => $request->input('timezone', 'Europe/Rome'),
            'settings_json' => $request->has('settings_json') ? json_encode($request->input('settings_json')) : DB::raw('settings_json'),
            'updated_at'    => now(),
        ]);

        if (!$updated) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        AuditLogger::log($request, 'update', 'tenant', $tenantId, $request->input('name'));

        return response()->json(['message' => 'Impostazioni tenant aggiornate.']);
    }
}
