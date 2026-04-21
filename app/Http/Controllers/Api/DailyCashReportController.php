<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyCashReportController extends Controller
{
    /** Preview incasso giornaliero: mostra totale vendite, già inviato, e da inviare (delta) */
    public function preview(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $date     = $request->input('date', now()->toDateString());

        $storeId = $this->resolveStoreId($request);
        if (!$storeId) return response()->json(['message' => 'Store non trovato.'], 422);

        // Totale vendite del giorno
        $sales = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('status', 'paid')
            ->whereRaw("(paid_at AT TIME ZONE 'Europe/Rome')::date = ?", [$date])
            ->select(DB::raw('SUM(grand_total) as total'), DB::raw('COUNT(*) as count'))
            ->first();

        $totalToday  = round((float) ($sales?->total ?? 0), 2);
        $txCount     = (int) ($sales?->count ?? 0);

        // Somma già inviata oggi (tutti gli invii precedenti)
        $alreadySent = (float) DB::table('daily_cash_reports')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('report_date', $date)
            ->sum('total');
        $alreadySent = round($alreadySent, 2);

        $remaining = round($totalToday - $alreadySent, 2);

        // Ultimo invio di oggi
        $lastReport = DB::table('daily_cash_reports as r')
            ->join('users as u', 'r.submitted_by', '=', 'u.id')
            ->where('r.tenant_id', $tenantId)
            ->where('r.store_id', $storeId)
            ->where('r.report_date', $date)
            ->orderByDesc('r.created_at')
            ->select('r.created_at', 'u.name as submitted_by_name', 'r.total as last_amount')
            ->first();

        return response()->json([
            'date'               => $date,
            'store_id'           => $storeId,
            'total_today'        => $totalToday,
            'already_sent'       => $alreadySent,
            'remaining'          => max(0, $remaining),
            'transactions_count' => $txCount,
            'can_send'           => $remaining > 0.01, // c'è ancora qualcosa da inviare
            'last_sent_at'       => $lastReport?->created_at,
            'last_sent_by'       => $lastReport?->submitted_by_name,
            'last_amount'        => $lastReport?->last_amount,
        ]);
    }

    /** Invia il delta (vendite non ancora inviate) e crea un cash_movement reale */
    public function submit(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user     = $request->user();
        $date     = $request->input('date', now()->toDateString());

        $storeId = $this->resolveStoreId($request);
        if (!$storeId) return response()->json(['message' => 'Store non trovato.'], 422);

        // Ricalcola il delta
        $sales = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('status', 'paid')
            ->whereRaw("(paid_at AT TIME ZONE 'Europe/Rome')::date = ?", [$date])
            ->select(DB::raw('SUM(grand_total) as total'), DB::raw('COUNT(*) as count'))
            ->first();

        $totalToday  = round((float) ($sales?->total ?? 0), 2);
        $txCount     = (int) ($sales?->count ?? 0);

        $alreadySent = (float) DB::table('daily_cash_reports')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('report_date', $date)
            ->sum('total');

        $delta = round($totalToday - $alreadySent, 2);

        if ($delta <= 0) {
            return response()->json(['message' => 'Nessun importo da inviare. Hai già inviato tutto il fatturato di oggi.'], 422);
        }

        // Salva il report (uno per invio)
        DB::table('daily_cash_reports')->insert([
            'tenant_id'          => $tenantId,
            'store_id'           => $storeId,
            'submitted_by'       => $user->id,
            'report_date'        => $date,
            'cash_total'         => $delta, // usiamo cash_total per il delta in questo contesto
            'pos_total'          => 0,
            'total'              => $delta,
            'transactions_count' => $txCount,
            'notes'              => "Invio automatico delta: €{$delta} (totale giorno: €{$totalToday})",
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        // ── Crea cash_movement reale → visibile subito lato superadmin in Cassa Live ──
        DB::table('cash_movements')->insert([
            'tenant_id'  => $tenantId,
            'store_id'   => $storeId,
            'employee_id' => null,
            'type'       => 'deposit',
            'amount'     => $delta,
            'note'       => "📊 Incasso giornaliero {$date} inviato da {$user->name} (€{$delta})",
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'submit', 'daily_cash_report', $storeId,
            "Incasso delta {$date}: €{$delta} (totale {$totalToday}, già inviato " . round($alreadySent, 2) . ")"
        );

        return response()->json([
            'message'    => "Incasso di €" . number_format($delta, 2, ',', '.') . " inviato con successo!",
            'delta'      => $delta,
            'total_today' => $totalToday,
        ]);
    }

    /** Lista report giornalieri */
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
                'r.id', 'r.report_date', 'r.total', 'r.transactions_count', 'r.created_at',
                's.id as store_id', 's.name as store_name',
                'u.name as submitted_by_name'
            );

        if ($storeId) $q->where('r.store_id', $storeId);
        if ($dateFrom) $q->where('r.report_date', '>=', $dateFrom);
        if ($dateTo)   $q->where('r.report_date', '<=', $dateTo);

        $rows = $q->orderByDesc('r.created_at')->get();

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

        $sid = $request->input('store_id');
        return $sid ? (int) $sid : null;
    }
}
