<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyCashReportController extends Controller
{
    /** Preview incasso giornaliero (dati POS per oggi) */
    public function preview(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user     = $request->user();
        $date     = $request->input('date', now()->toDateString());

        // Store: dipendente usa il suo, admin può specificarlo
        $storeId = $this->resolveStoreId($request);
        if (!$storeId) return response()->json(['message' => 'Store non trovato.'], 422);

        // Vendite del giorno per quel negozio
        $sales = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('status', 'paid')
            ->whereRaw("(paid_at AT TIME ZONE 'Europe/Rome')::date = ?", [$date])
            ->select('channel', DB::raw('SUM(grand_total) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('channel')
            ->get()
            ->keyBy('channel');

        $cashTotal  = (float) ($sales['cash']?->total  ?? 0);
        $posTotal   = (float) ($sales['pos']?->total   ?? 0);
        $cashCount  = (int)   ($sales['cash']?->count  ?? 0);
        $posCount   = (int)   ($sales['pos']?->count   ?? 0);

        // Verifica se esiste già un report per oggi
        $existing = DB::table('daily_cash_reports')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('report_date', $date)
            ->first();

        return response()->json([
            'date'               => $date,
            'store_id'           => $storeId,
            'cash_total'         => $cashTotal,
            'pos_total'          => $posTotal,
            'total'              => round($cashTotal + $posTotal, 2),
            'transactions_count' => $cashCount + $posCount,
            'already_submitted'  => !is_null($existing),
            'submitted_at'       => $existing?->created_at,
            'submitted_by_name'  => $existing ? DB::table('users')->where('id', $existing->submitted_by)->value('name') : null,
        ]);
    }

    /** Invia il riepilogo giornaliero */
    public function submit(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user     = $request->user();
        $date     = $request->input('date', now()->toDateString());
        $notes    = $request->input('notes', '');

        $storeId = $this->resolveStoreId($request);
        if (!$storeId) return response()->json(['message' => 'Store non trovato.'], 422);

        // Controlla se già inviato
        $exists = DB::table('daily_cash_reports')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('report_date', $date)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Riepilogo già inviato per questa data.'], 422);
        }

        // Calcola totali del giorno
        $sales = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('status', 'paid')
            ->whereRaw("(paid_at AT TIME ZONE 'Europe/Rome')::date = ?", [$date])
            ->select('channel', DB::raw('SUM(grand_total) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('channel')
            ->get()
            ->keyBy('channel');

        $cashTotal  = (float) ($sales['cash']?->total ?? 0);
        $posTotal   = (float) ($sales['pos']?->total  ?? 0);
        $total      = round($cashTotal + $posTotal, 2);
        $txCount    = (int) ($sales['cash']?->count ?? 0) + (int) ($sales['pos']?->count ?? 0);

        DB::table('daily_cash_reports')->insert([
            'tenant_id'          => $tenantId,
            'store_id'           => $storeId,
            'submitted_by'       => $user->id,
            'report_date'        => $date,
            'cash_total'         => $cashTotal,
            'pos_total'          => $posTotal,
            'total'              => $total,
            'transactions_count' => $txCount,
            'notes'              => $notes,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        AuditLogger::log($request, 'submit', 'daily_cash_report', $storeId,
            "Incasso giornaliero {$date}: contanti €{$cashTotal} + POS €{$posTotal} = €{$total}"
        );

        return response()->json([
            'message'    => 'Riepilogo giornaliero inviato con successo.',
            'cash_total' => $cashTotal,
            'pos_total'  => $posTotal,
            'total'      => $total,
        ]);
    }

    /** Lista report giornalieri (admin vede tutti, dipendente vede solo il suo store) */
    public function index(Request $request): JsonResponse
    {
        $tenantId  = (int) $request->attributes->get('tenant_id');
        $storeId   = $this->resolveStoreId($request);
        $dateFrom  = $request->input('date_from');
        $dateTo    = $request->input('date_to');

        $q = DB::table('daily_cash_reports as r')
            ->join('stores as s', 'r.store_id', '=', 's.id')
            ->join('users as u', 'r.submitted_by', '=', 'u.id')
            ->where('r.tenant_id', $tenantId)
            ->select(
                'r.id', 'r.report_date', 'r.cash_total', 'r.pos_total',
                'r.total', 'r.transactions_count', 'r.notes', 'r.created_at',
                's.id as store_id', 's.name as store_name',
                'u.name as submitted_by_name'
            );

        if ($storeId) $q->where('r.store_id', $storeId);
        if ($dateFrom) $q->where('r.report_date', '>=', $dateFrom);
        if ($dateTo)   $q->where('r.report_date', '<=', $dateTo);

        $rows = $q->orderByDesc('r.report_date')->orderByDesc('r.created_at')->get();

        return response()->json(['data' => $rows]);
    }

    private function resolveStoreId(Request $request): ?int
    {
        $user = $request->user();
        if (!$user) return null;

        $isDipendente = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->where('roles.code', 'dipendente')
            ->exists();

        if ($isDipendente) {
            $sid = DB::table('employees')->where('user_id', $user->id)->value('store_id');
            return $sid ? (int) $sid : null;
        }

        // Admin: usa store_id dalla richiesta
        $sid = $request->input('store_id');
        return $sid ? (int) $sid : null;
    }
}
