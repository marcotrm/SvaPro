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
                'stores.name as store_name',
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
            // Dipendente: vede solo il proprio store
            $storesQuery->where('id', $forcedStoreId);
        }
        $stores = $storesQuery->get(['id', 'name']);

        $results = [];
        foreach ($stores as $store) {
            $deposits    = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('type', 'deposit')
                ->sum('amount');
            $withdrawals = (float) DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('type', 'withdrawal')
                ->sum('amount');

            // Aggiungi vendite POS al saldo cassa (metodo contanti)
            $salesCash   = (float) DB::table('sales_orders')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->where('status', 'paid')
                ->where('channel', 'cash')
                ->sum('grand_total');

            // Ultima movimentazione
            $lastMov = DB::table('cash_movements')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $store->id)
                ->orderByDesc('created_at')
                ->first(['created_at', 'type', 'amount']);

            $results[] = [
                'store_id'          => $store->id,
                'store_name'        => $store->name,
                'balance'           => round($salesCash + $deposits - $withdrawals, 2),
                'total_deposits'    => round($salesCash + $deposits, 2),
                'total_withdrawals' => round($withdrawals, 2),
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

        $id = DB::table('cash_movements')->insertGetId([
            'tenant_id'   => $tenantId,
            'store_id'    => $storeId,
            'employee_id' => $employeeId,
            'type'        => $request->input('type'),
            'amount'      => $request->input('amount'),
            'note'        => $request->input('note'),
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
}
