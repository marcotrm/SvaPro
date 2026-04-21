<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashMovementController extends Controller
{
    /**
     * Recupera lo store_id dell'utente se è un dipendente.
     * I dipendenti possono vedere/operare SOLO sul proprio store.
     */
    private function getSecureStoreId(Request $request): ?int
    {
        $user = $request->user();
        if (!$user) return $request->input('store_id') ? (int) $request->input('store_id') : null;

        $isDipendente = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->where('roles.code', 'dipendente')
            ->exists();

        if ($isDipendente) {
            $employeeStoreId = DB::table('employees')
                ->where('user_id', $user->id)
                ->value('store_id');
            if ($employeeStoreId) {
                return (int) $employeeStoreId;
            }
        }

        // Admin/superadmin: usa il filtro passato dal frontend
        return $request->input('store_id') ? (int) $request->input('store_id') : null;
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $this->getSecureStoreId($request);  // ← forzato per dipendente
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        $query = DB::table('cash_movements')
            ->leftJoin('users', 'cash_movements.employee_id', '=', 'users.id')
            ->leftJoin('stores', 'cash_movements.store_id', '=', 'stores.id')
            ->where('cash_movements.tenant_id', $tenantId)
            ->select(
                'cash_movements.id',
                'cash_movements.type',
                'cash_movements.amount',
                'cash_movements.note',
                'cash_movements.created_at',
                'cash_movements.store_id',
                'cash_movements.balance_after_transaction',
                'stores.name as store_name',
                'stores.company_group',
                'users.name as employee_name'
            );

        if ($storeId) {
            $query->where('cash_movements.store_id', $storeId);
        }

        if ($dateFrom) {
            $query->whereRaw("(cash_movements.created_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]);
        }
        if ($dateTo) {
            $query->whereRaw("(cash_movements.created_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]);
        }

        $movements = $query->orderByDesc('cash_movements.created_at')->get();

        return response()->json(['data' => $movements]);
    }

    public function balances(Request $request): JsonResponse
    {
        $tenantId       = (int) $request->attributes->get('tenant_id');
        $forcedStoreId  = $this->getSecureStoreId($request);  // ← null = admin vede tutto

        $storesQuery = DB::table('stores')->where('tenant_id', $tenantId);
        if ($forcedStoreId) {
            $storesQuery->where('id', $forcedStoreId);
        }
        $stores = $storesQuery->get(['id', 'name']);

        $results = [];
        foreach ($stores as $store) {
            // Depositi manuali (escluse monete — le monete hanno note che inizia con 🪙)
            $manualDeposits = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('type', 'deposit')
                ->whereRaw("(note NOT LIKE '🪙%' OR note IS NULL)")
                ->sum('amount');

            // Monete: depositi il cui note inizia con 🪙
            $coinDeposits = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('type', 'deposit')
                ->whereRaw("note LIKE '🪙%'")
                ->sum('amount');

            $withdrawals = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('type', 'withdrawal')
                ->sum('amount');

            // Vendite POS — contanti
            $salesCash = (float) DB::table('sales_orders')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('status', 'paid')
                ->where('channel', 'cash')
                ->sum('grand_total');

            // Vendite POS — carta/pos
            $salesPos = (float) DB::table('sales_orders')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('status', 'paid')
                ->where('channel', 'pos')
                ->sum('grand_total');

            // Ultima movimentazione
            $lastMov = DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->orderByDesc('created_at')
                ->first(['created_at', 'type', 'amount']);

            $totalIn  = round($salesCash + $manualDeposits + $coinDeposits, 2);
            $balance  = round($totalIn - $withdrawals, 2);

            $results[] = [
                'store_id'          => $store->id,
                'store_name'        => $store->name,
                'balance'           => $balance,
                'total_deposits'    => $totalIn,
                'total_withdrawals' => round($withdrawals, 2),
                // breakdown
                'sales_cash'        => round($salesCash, 2),
                'sales_pos'         => round($salesPos, 2),
                'manual_deposits'   => round($manualDeposits, 2),
                'coin_amount'       => round($coinDeposits, 2),
                'last_movement'     => $lastMov,
            ];
        }

        return response()->json(['data' => $results]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId       = (int) $request->attributes->get('tenant_id');
        $user           = $request->user();
        $forcedStoreId  = $this->getSecureStoreId($request);

        $request->validate([
            'store_id' => ['required', 'integer'],
            'type'     => ['required', 'in:deposit,withdrawal'],
            'amount'   => ['required', 'numeric', 'min:0.01'],
            'note'     => ['nullable', 'string', 'max:255'],
        ]);

        // Se il dipendente prova a usare uno store diverso dal suo → forza il suo
        $storeId = $forcedStoreId ?? (int) $request->input('store_id');

        // Risolvi dipendente da barcode se passato
        $employeeId = $user->id;
        $barcode = $request->input('operator_barcode');
        if ($barcode) {
            $emp = DB::table('employees')
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->where(function($q) use ($barcode) {
                    $q->where('barcode', $barcode)
                      ->orWhere('id', (int) $barcode)
                      ->orWhere('first_name', 'like', '%' . $barcode . '%')
                      ->orWhere('last_name', 'like', '%' . $barcode . '%');
                })
                ->first(['id']);
            if ($emp) $employeeId = $emp->id;
        }

        // Calcolo saldo attuale prima della transazione
        $deposits = (float) DB::table('cash_movements')
            ->where('tenant_id', $tenantId)->where('store_id', $storeId)->where('type', 'deposit')->sum('amount');
        $withdrawals = (float) DB::table('cash_movements')
            ->where('tenant_id', $tenantId)->where('store_id', $storeId)->where('type', 'withdrawal')->sum('amount');
        $salesCash = (float) DB::table('sales_orders')
            ->where('tenant_id', $tenantId)->where('store_id', $storeId)
            ->where('status', 'paid')->where('channel', 'cash')->sum('grand_total');
        
        $currentBalance = round($salesCash + $deposits - $withdrawals, 2);
        
        // Nuovo saldo
        $parsedAmount = (float) $request->input('amount');
        $newBalance = $request->input('type') === 'deposit' 
            ? $currentBalance + $parsedAmount 
            : $currentBalance - $parsedAmount;

        $id = DB::table('cash_movements')->insertGetId([
            'tenant_id'   => $tenantId,
            'store_id'    => $storeId,
            'employee_id' => $employeeId,
            'type'        => $request->input('type'),
            'amount'      => $parsedAmount,
            'note'        => $request->input('note'),
            'balance_after_transaction' => $newBalance,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return response()->json([
            'message' => 'Movimento registrato con successo',
            'data' => [
                'id'     => $id,
                'type'   => $request->input('type'),
                'amount' => $request->input('amount'),
            ]
        ], 201);
    }

    /**
     * Riepilogo per società (company_group) con breakdown contanti/POS.
     * GET /cash-movements/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&company=...
     */
    public function summary(Request $request): JsonResponse
    {
        $tenantId  = (int) $request->attributes->get('tenant_id');
        $dateFrom  = $request->input('date_from');
        $dateTo    = $request->input('date_to');
        $company   = $request->input('company'); // opzionale — filtra per nome società

        // Recupera tutte le company_group del tenant
        $storesQuery = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('company_group')
            ->select('id', 'name', 'company_group');
        if ($company) $storesQuery->where('company_group', $company);
        $stores = $storesQuery->get();

        $companies = $stores->groupBy('company_group');

        // Lista di tutte le company (anche senza store esplicito) per il tenant
        $allCompanies = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('company_group')
            ->distinct()->pluck('company_group');

        $results = [];

        foreach ($companies as $companyName => $compStores) {
            $storeIds = $compStores->pluck('id')->toArray();

            // ── Movimenti di cassa nel periodo ────────────────────────
            $movQuery = DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->whereIn('store_id', $storeIds);
            if ($dateFrom) $movQuery->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]);
            if ($dateTo)   $movQuery->whereRaw("(created_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]);

            $totalDeposits    = (float) (clone $movQuery)->where('type', 'deposit')->sum('amount');
            $totalWithdrawals = (float) (clone $movQuery)->where('type', 'withdrawal')->sum('amount');
            $movCount         = $movQuery->count();

            // ── Vendite POS nel periodo (pagamenti) ────────────────────
            $salesQuery = DB::table('payments')
                ->join('sales_orders', 'sales_orders.id', '=', 'payments.sales_order_id')
                ->where('sales_orders.tenant_id', $tenantId)
                ->whereIn('sales_orders.store_id', $storeIds)
                ->where('payments.status', 'paid');
            if ($dateFrom) $salesQuery->whereRaw("(payments.paid_at AT TIME ZONE 'Europe/Rome')::date >= ?", [$dateFrom]);
            if ($dateTo)   $salesQuery->whereRaw("(payments.paid_at AT TIME ZONE 'Europe/Rome')::date <= ?", [$dateTo]);

            $cashSales = (float) (clone $salesQuery)->where('payments.method', 'cash')->sum('payments.amount');
            $posSales  = (float) (clone $salesQuery)->where('payments.method', 'card')->sum('payments.amount');
            $totalSales = $cashSales + $posSales;

            // ── Saldo live cassa (tutti i movimenti storici) ───────────
            $liveDep = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)->whereIn('store_id', $storeIds)->where('type', 'deposit')->sum('amount');
            $liveWit = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)->whereIn('store_id', $storeIds)->where('type', 'withdrawal')->sum('amount');
            $liveCash = (float) DB::table('sales_orders')
                ->where('tenant_id', $tenantId)->whereIn('store_id', $storeIds)->where('status','paid')->where('channel','cash')->sum('grand_total');
            $liveBalance = round($liveCash + $liveDep - $liveWit, 2);

            $results[] = [
                'company'          => $companyName,
                'stores'           => $compStores->pluck('name')->toArray(),
                'store_count'      => count($storeIds),
                // Periodo selezionato
                'period_deposits'  => round($totalDeposits, 2),
                'period_withdrawals' => round($totalWithdrawals, 2),
                'period_net'       => round($totalDeposits - $totalWithdrawals, 2),
                'period_mov_count' => $movCount,
                // Vendite POS nel periodo
                'cash_sales'       => round($cashSales, 2),
                'pos_sales'        => round($posSales, 2),
                'total_sales'      => round($totalSales, 2),
                // Saldo live corrente
                'live_balance'     => $liveBalance,
            ];
        }

        return response()->json([
            'data'      => $results,
            'companies' => $allCompanies->values(),
        ]);
    }
}
