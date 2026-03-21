<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $employees = DB::table('employees as e')
            ->leftJoin('employee_point_wallets as epw', function ($join) {
                $join->on('epw.employee_id', '=', 'e.id')->on('epw.tenant_id', '=', 'e.tenant_id');
            })
            ->where('e.tenant_id', $tenantId)
            ->select(['e.*', 'epw.points_balance'])
            ->orderByDesc('e.id')
            ->get();

        return response()->json(['data' => $employees]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'store_id' => ['required', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'photo_url' => ['nullable', 'string', 'max:255'],
            'hire_date' => ['nullable', 'date'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $storeExists = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $request->integer('store_id'))->exists();
        if (! $storeExists) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $employeeId = DB::table('employees')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $request->integer('store_id'),
            'user_id' => $request->input('user_id'),
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'photo_url' => $request->input('photo_url'),
            'hire_date' => $request->input('hire_date'),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('employee_point_wallets')->insert([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
            'points_balance' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Dipendente creato.', 'employee_id' => $employeeId], 201);
    }

    public function update(Request $request, int $employeeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('id', $employeeId)
            ->update([
                'first_name' => $request->input('first_name'),
                'last_name' => $request->input('last_name'),
                'photo_url' => $request->input('photo_url'),
                'status' => $request->input('status', 'active'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        return response()->json(['message' => 'Dipendente aggiornato.']);
    }
}
