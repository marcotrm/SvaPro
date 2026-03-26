<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PosSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $rows = DB::table('pos_sessions as ps')
            ->join('stores as s', function ($join) use ($tenantId) {
                $join->on('s.id', '=', 'ps.store_id')
                    ->where('s.tenant_id', '=', $tenantId);
            })
            ->join('users as u', 'u.id', '=', 'ps.employee_id')
            ->where('ps.tenant_id', $tenantId)
            ->when($request->filled('store_id'), fn ($q) => $q->where('ps.store_id', (int) $request->integer('store_id')))
            ->when($request->filled('status'), function ($q) use ($request) {
                $status = (string) $request->input('status');
                if ($status === 'open') {
                    $q->whereNull('ps.closed_at');
                } elseif ($status === 'closed') {
                    $q->whereNotNull('ps.closed_at');
                }
            })
            ->select([
                'ps.id',
                'ps.store_id',
                's.name as store_name',
                'ps.employee_id',
                'u.name as employee_name',
                'ps.opened_at',
                'ps.closed_at',
                'ps.opening_cash',
                'ps.closing_cash',
            ])
            ->orderByDesc('ps.opened_at')
            ->limit((int) $request->input('limit', 50))
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function active(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $session = DB::table('pos_sessions as ps')
            ->join('stores as s', function ($join) use ($tenantId) {
                $join->on('s.id', '=', 'ps.store_id')
                    ->where('s.tenant_id', '=', $tenantId);
            })
            ->where('ps.tenant_id', $tenantId)
            ->where('ps.employee_id', $request->user()->id)
            ->whereNull('ps.closed_at')
            ->select([
                'ps.id',
                'ps.store_id',
                's.name as store_name',
                'ps.employee_id',
                'ps.opened_at',
                'ps.opening_cash',
            ])
            ->first();

        if (! $session) {
            return response()->json(['data' => null]);
        }

        // Vendite della sessione (ordini POS creati durante la sessione)
        $salesSummary = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $session->store_id)
            ->where('channel', 'pos')
            ->where('created_at', '>=', $session->opened_at)
            ->where('status', 'paid')
            ->selectRaw('COUNT(*) as total_sales, COALESCE(SUM(grand_total), 0) as total_revenue')
            ->first();

        $session->total_sales = (int) $salesSummary->total_sales;
        $session->total_revenue = (float) $salesSummary->total_revenue;

        return response()->json(['data' => $session]);
    }

    public function open(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'store_id' => ['required', 'integer'],
            'opening_cash' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $storeId = (int) $request->input('store_id');

        if (! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Negozio non valido per il tenant.'], 422);
        }

        // Verifica che l'utente non abbia gia una sessione aperta
        $alreadyOpen = DB::table('pos_sessions')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $request->user()->id)
            ->whereNull('closed_at')
            ->exists();

        if ($alreadyOpen) {
            return response()->json(['message' => 'Hai gia una sessione POS aperta. Chiudila prima di aprirne una nuova.'], 422);
        }

        $now = now();

        $sessionId = DB::table('pos_sessions')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $storeId,
            'employee_id' => $request->user()->id,
            'opened_at' => $now,
            'opening_cash' => (float) $request->input('opening_cash'),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        AuditLogger::log($request, 'open', 'pos_session', $sessionId, 'Cassa aperta - Negozio #' . $storeId);

        return response()->json([
            'message' => 'Sessione POS aperta.',
            'session_id' => $sessionId,
        ], 201);
    }

    public function close(Request $request, int $sessionId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $session = DB::table('pos_sessions')
            ->where('tenant_id', $tenantId)
            ->where('id', $sessionId)
            ->whereNull('closed_at')
            ->first();

        if (! $session) {
            return response()->json(['message' => 'Sessione POS non trovata o gia chiusa.'], 404);
        }

        if ($session->employee_id !== $request->user()->id) {
            // Solo superadmin/admin possono chiudere sessioni di altri
            $userRoles = DB::table('user_roles as ur')
                ->join('roles as r', 'r.id', '=', 'ur.role_id')
                ->where('ur.user_id', $request->user()->id)
                ->where('ur.tenant_id', $tenantId)
                ->pluck('r.slug')
                ->all();

            if (! array_intersect($userRoles, ['superadmin', 'admin_cliente'])) {
                return response()->json(['message' => 'Non hai i permessi per chiudere questa sessione.'], 403);
            }
        }

        $validator = Validator::make($request->all(), [
            'closing_cash' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $now = now();

        // Riepilogo vendite sessione
        $salesSummary = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $session->store_id)
            ->where('channel', 'pos')
            ->where('created_at', '>=', $session->opened_at)
            ->where('created_at', '<=', $now)
            ->where('status', 'paid')
            ->selectRaw('COUNT(*) as total_sales, COALESCE(SUM(grand_total), 0) as total_revenue')
            ->first();

        DB::table('pos_sessions')
            ->where('id', $sessionId)
            ->update([
                'closed_at' => $now,
                'closing_cash' => (float) $request->input('closing_cash'),
                'updated_at' => $now,
            ]);

        $closingCash = (float) $request->input('closing_cash');
        $expectedCash = (float) $session->opening_cash + (float) $salesSummary->total_revenue;
        $difference = round($closingCash - $expectedCash, 2);

        AuditLogger::log($request, 'close', 'pos_session', $sessionId, 'Cassa chiusa - Diff €' . number_format($difference, 2));

        return response()->json([
            'message' => 'Sessione POS chiusa.',
            'summary' => [
                'opening_cash' => (float) $session->opening_cash,
                'closing_cash' => $closingCash,
                'total_sales' => (int) $salesSummary->total_sales,
                'total_revenue' => (float) $salesSummary->total_revenue,
                'expected_cash' => $expectedCash,
                'difference' => $difference,
            ],
        ]);
    }
}
