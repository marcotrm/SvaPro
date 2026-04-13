<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GamificationController
 * Gestisce le funzionalità di gamification per i dipendenti.
 */
class GamificationController extends Controller
{
    /** Missioni disponibili per il dipendente loggato */
    public function missions(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user = $request->user();

        // Placeholder: restituisce lista vuota — implementazione completa in roadmap
        return response()->json(['data' => []]);
    }

    /** Sfide di squadra attive */
    public function teamChallenges(Request $request): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    /** Classifica dipendenti per punti */
    public function leaderboard(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        $employees = DB::table('employees as e')
            ->leftJoin('stores as s', 's.id', '=', 'e.store_id')
            ->where('e.tenant_id', $tenantId)
            ->where('e.status', 'active')
            ->when($storeId, fn ($q) => $q->where('e.store_id', $storeId))
            ->select([
                'e.id',
                DB::raw("e.first_name || ' ' || e.last_name as name"),
                's.name as store_name',
            ])
            ->orderBy('e.last_name')
            ->get()
            ->map(fn ($e) => [
                'employee_id'   => $e->id,
                'employee_name' => $e->name,
                'store_name'    => $e->store_name,
                'points'        => 0,
                'rank'          => 1,
            ]);

        return response()->json(['data' => $employees]);
    }

    /** Statistiche personali del dipendente loggato */
    public function playerStats(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user = $request->user();

        $employee = DB::table('employees')
            ->where('user_id', $user->id)
            ->where('tenant_id', $tenantId)
            ->first(['id', 'first_name', 'last_name']);

        return response()->json([
            'data' => [
                'employee_id'   => $employee?->id,
                'employee_name' => $employee ? "{$employee->first_name} {$employee->last_name}" : $user->name,
                'points'        => 0,
                'level'         => 1,
                'missions_completed' => 0,
                'badges'        => [],
            ],
        ]);
    }
}
