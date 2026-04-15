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
        $storeId  = $request->filled('store_id') ? (int) $request->integer('store_id') : null;
        $period   = $request->input('period', 'month');

        [$dateStart, $dateEnd] = $this->periodRange($period);

        // Somma punti da ledger per il periodo selezionato
        $pointsSub = DB::table('employee_point_ledger as epl')
            ->where('epl.tenant_id', $tenantId)
            ->when($dateStart, fn ($q) => $q->where('epl.created_at', '>=', $dateStart))
            ->when($dateEnd,   fn ($q) => $q->where('epl.created_at', '<=', $dateEnd))
            ->groupBy('epl.employee_id')
            ->selectRaw('epl.employee_id, COALESCE(SUM(epl.points_delta), 0) as period_points');

        $employees = DB::table('employees as e')
            ->leftJoin('stores as s', 's.id', '=', 'e.store_id')
            ->leftJoinSub($pointsSub, 'pts', fn ($j) => $j->on('pts.employee_id', '=', 'e.id'))
            ->where('e.tenant_id', $tenantId)
            ->where('e.status', 'active')
            ->when($storeId, fn ($q) => $q->where('e.store_id', $storeId))
            ->select([
                'e.id',
                'e.first_name',
                'e.last_name',
                's.name as store_name',
                DB::raw('COALESCE(pts.period_points, 0) as points'),
            ])
            ->orderByDesc(DB::raw('COALESCE(pts.period_points, 0)'))
            ->get()
            ->values()
            ->map(fn ($e, $i) => [
                'employee_id'   => $e->id,
                'employee_name' => trim($e->first_name . ' ' . $e->last_name),
                'first_name'    => $e->first_name,
                'last_name'     => $e->last_name,
                'store_name'    => $e->store_name,
                'points'        => max(0, (int) $e->points),
                'rank'          => $i + 1,
            ]);

        return response()->json(['data' => $employees]);
    }

    /** Statistiche personali del dipendente loggato */
    public function playerStats(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user     = $request->user();
        $period   = $request->input('period', 'month');

        [$dateStart, $dateEnd] = $this->periodRange($period);

        $employee = DB::table('employees')
            ->where('user_id', $user->id)
            ->where('tenant_id', $tenantId)
            ->first(['id', 'first_name', 'last_name']);

        $points = 0;
        $missionsCompleted = 0;

        if ($employee) {
            $points = (int) DB::table('employee_point_ledger')
                ->where('tenant_id', $tenantId)
                ->where('employee_id', $employee->id)
                ->when($dateStart, fn ($q) => $q->where('created_at', '>=', $dateStart))
                ->when($dateEnd,   fn ($q) => $q->where('created_at', '<=', $dateEnd))
                ->sum('points_delta');

            $points = max(0, $points);
        }

        return response()->json([
            'data' => [
                'employee_id'        => $employee?->id,
                'employee_name'      => $employee
                    ? "{$employee->first_name} {$employee->last_name}"
                    : $user->name,
                'points'             => $points,
                'level'              => $points >= 20000 ? 4 : ($points >= 5000 ? 3 : ($points >= 1000 ? 2 : 1)),
                'missions_completed' => $missionsCompleted,
                'badges'             => [],
                'period'             => $period,
            ],
        ]);
    }

    /**
     * Calcola il range di date per il periodo selezionato.
     * @return array{0: string|null, 1: string|null}
     */
    private function periodRange(string $period): array
    {
        $now = now();
        return match ($period) {
            'month'   => [$now->copy()->startOfMonth()->toDateTimeString(), $now->toDateTimeString()],
            'quarter' => [$now->copy()->startOfQuarter()->toDateTimeString(), $now->toDateTimeString()],
            'year'    => [$now->copy()->startOfYear()->toDateTimeString(), $now->toDateTimeString()],
            default   => [null, null], // 'all' — nessun filtro data
        };
    }
}
