<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $request->input('store_id');
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        // Solo i manager o superadmin possono vedere tutti gli store
        // Ma lasciamo che il filtro sia applicato dalla route (dipendente id/store).
        
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

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user = $request->user();

        $request->validate([
            'store_id' => ['required', 'integer'],
            'type'     => ['required', 'in:deposit,withdrawal'],
            'amount'   => ['required', 'numeric', 'min:0.01'],
            'note'     => ['nullable', 'string', 'max:255'],
        ]);

        $storeId = (int) $request->input('store_id');
        
        $id = DB::table('cash_movements')->insertGetId([
            'tenant_id'   => $tenantId,
            'store_id'    => $storeId,
            'employee_id' => $user->id,
            'type'        => $request->input('type'),
            'amount'      => $request->input('amount'),
            'note'        => $request->input('note'),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return response()->json([
            'message' => 'Movimento registrato con successo',
            'data' => [
                'id' => $id,
                'type' => $request->input('type'),
                'amount' => $request->input('amount'),
            ]
        ], 201);
    }
}
