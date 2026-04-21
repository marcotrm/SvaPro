<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoinShipmentController extends Controller
{
    /** Lista spedizioni (pending in cima, poi per data) */
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $request->input('store_id');
        $status   = $request->input('status'); // pending|confirmed|rejected|all

        $q = DB::table('coin_shipments')
            ->join('users as u',   'coin_shipments.from_user_id', '=', 'u.id')
            ->join('stores as s',  'coin_shipments.to_store_id',  '=', 's.id')
            ->leftJoin('users as cu', 'coin_shipments.confirmed_by', '=', 'cu.id')
            ->where('coin_shipments.tenant_id', $tenantId)
            ->select(
                'coin_shipments.id',
                'coin_shipments.total_amount',
                'coin_shipments.coin_breakdown',
                'coin_shipments.status',
                'coin_shipments.notes',
                'coin_shipments.confirmed_at',
                'coin_shipments.created_at',
                's.id as store_id',
                's.name as store_name',
                'u.name as from_user_name',
                'cu.name as confirmed_by_name'
            );

        if ($storeId) $q->where('coin_shipments.to_store_id', $storeId);
        if ($status && $status !== 'all') $q->where('coin_shipments.status', $status);

        $rows = $q->orderByRaw("CASE WHEN coin_shipments.status='pending' THEN 0 ELSE 1 END")
                  ->orderByDesc('coin_shipments.created_at')
                  ->get()
                  ->map(function ($r) {
                      $r->coin_breakdown = is_string($r->coin_breakdown)
                          ? json_decode($r->coin_breakdown, true)
                          : $r->coin_breakdown;
                      return $r;
                  });

        // Totali per la dashboard
        $totConfirmed = DB::table('coin_shipments')
            ->where('tenant_id', $tenantId)
            ->where('status', 'confirmed')
            ->sum('total_amount');

        return response()->json([
            'data'           => $rows,
            'total_confirmed'=> (float) $totConfirmed,
        ]);
    }

    /** Crea nuovo pacco monete */
    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user     = $request->user();

        $request->validate([
            'to_store_id'    => 'required|integer|exists:stores,id',
            'total_amount'   => 'required|numeric|min:0.01',
            'coin_breakdown' => 'nullable|array',
            'notes'          => 'nullable|string|max:500',
        ]);

        $id = DB::table('coin_shipments')->insertGetId([
            'tenant_id'      => $tenantId,
            'from_user_id'   => $user->id,
            'to_store_id'    => $request->input('to_store_id'),
            'total_amount'   => $request->input('total_amount'),
            'coin_breakdown' => json_encode($request->input('coin_breakdown', [])),
            'status'         => 'pending',
            'notes'          => $request->input('notes'),
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        AuditLogger::log($request, 'create', 'coin_shipment', $id,
            "Pacco monete €{$request->input('total_amount')} → store #{$request->input('to_store_id')}"
        );

        return response()->json(['message' => 'Pacco monete creato.', 'id' => $id], 201);
    }

    /** Conferma ricezione (solo store destinatario) */
    public function confirm(Request $request, $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user     = $request->user();

        $shipment = DB::table('coin_shipments')
            ->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$shipment) return response()->json(['message' => 'Pacco non trovato.'], 404);
        if ($shipment->status !== 'pending')
            return response()->json(['message' => 'Il pacco è già stato processato.'], 422);

        DB::table('coin_shipments')->where('id', $id)->update([
            'status'       => 'confirmed',
            'confirmed_by' => $user->id,
            'confirmed_at' => now(),
            'updated_at'   => now(),
        ]);

        // Registra automaticamente come movimento di cassa entrata (monete)
        $deposits = (float) DB::table('cash_movements')
            ->where('tenant_id', $tenantId)->where('store_id', $shipment->to_store_id)
            ->where('type', 'deposit')->sum('amount');
        $withdrawals = (float) DB::table('cash_movements')
            ->where('tenant_id', $tenantId)->where('store_id', $shipment->to_store_id)
            ->where('type', 'withdrawal')->sum('amount');
        $salesCash = (float) DB::table('sales_orders')
            ->where('tenant_id', $tenantId)->where('store_id', $shipment->to_store_id)
            ->where('status', 'paid')->where('channel', 'cash')->sum('grand_total');
        $currentBalance = round($salesCash + $deposits - $withdrawals, 2);
        $newBalance     = $currentBalance + (float) $shipment->total_amount;

        DB::table('cash_movements')->insert([
            'tenant_id'                 => $tenantId,
            'store_id'                  => $shipment->to_store_id,
            'employee_id'               => $user->id,
            'type'                      => 'deposit',
            'amount'                    => $shipment->total_amount,
            'note'                      => '🪙 Pacco monete confermato (#' . $id . ')',
            'balance_after_transaction' => $newBalance,
            'created_at'                => now(),
            'updated_at'                => now(),
        ]);

        AuditLogger::log($request, 'confirm', 'coin_shipment', $id,
            "Confermato pacco monete €{$shipment->total_amount} store #{$shipment->to_store_id}"
        );

        return response()->json(['message' => 'Pacco confermato e cassa aggiornata.']);
    }

    /** Rifiuta il pacco */
    public function reject(Request $request, $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $shipment = DB::table('coin_shipments')
            ->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$shipment) return response()->json(['message' => 'Pacco non trovato.'], 404);
        if ($shipment->status !== 'pending')
            return response()->json(['message' => 'Il pacco è già stato processato.'], 422);

        DB::table('coin_shipments')->where('id', $id)->update([
            'status'     => 'rejected',
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'reject', 'coin_shipment', $id, "Rifiutato pacco monete #$id");
        return response()->json(['message' => 'Pacco rifiutato.']);
    }

    /** Statistiche contanti vs monete per la dashboard admin */
    public function dashboardStats(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        // Saldo corrente cassa per store (solo movimenti cash_movements)
        $stores = DB::table('stores')->where('tenant_id', $tenantId)->get(['id', 'name', 'company_group']);

        $storeStats = [];
        foreach ($stores as $store) {
            // Movimenti manuali di cassa
            $dep = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)->where('store_id', $store->id)
                ->where('type', 'deposit')
                ->when($dateFrom, fn($q) => $q->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]))
                ->when($dateTo,   fn($q) => $q->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]))
                ->sum('amount');
            $wit = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)->where('store_id', $store->id)
                ->where('type', 'withdrawal')
                ->when($dateFrom, fn($q) => $q->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]))
                ->when($dateTo,   fn($q) => $q->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]))
                ->sum('amount');

            // Vendite contanti POS
            $cashSales = (float) DB::table('sales_orders')
                ->where('tenant_id', $tenantId)->where('store_id', $store->id)
                ->where('status', 'paid')->where('channel', 'cash')
                ->when($dateFrom, fn($q) => $q->whereRaw("(paid_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]))
                ->when($dateTo,   fn($q) => $q->whereRaw("(paid_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]))
                ->sum('grand_total');

            // Monete confermate nel periodo
            $coins = (float) DB::table('coin_shipments')
                ->where('tenant_id', $tenantId)->where('to_store_id', $store->id)
                ->where('status', 'confirmed')
                ->when($dateFrom, fn($q) => $q->whereRaw("(confirmed_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]))
                ->when($dateTo,   fn($q) => $q->whereRaw("(confirmed_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]))
                ->sum('total_amount');

            $storeStats[] = [
                'store_id'      => $store->id,
                'store_name'    => $store->name,
                'company_group' => $store->company_group,
                'cash_amount'   => round($cashSales + $dep - $wit, 2),
                'coin_amount'   => round($coins, 2),
                'total'         => round($cashSales + $dep - $wit + $coins, 2),
            ];
        }

        // Pending shipments
        $pending = (int) DB::table('coin_shipments')
            ->where('tenant_id', $tenantId)->where('status', 'pending')->count();

        return response()->json([
            'stores'          => $storeStats,
            'pending_count'   => $pending,
            'total_cash'      => collect($storeStats)->sum('cash_amount'),
            'total_coins'     => collect($storeStats)->sum('coin_amount'),
            'total_combined'  => collect($storeStats)->sum('total'),
        ]);
    }
}
