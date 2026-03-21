<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $customers = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('id')
            ->limit((int) $request->input('limit', 100))
            ->get();

        return response()->json(['data' => $customers]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'code' => ['nullable', 'string', 'max:50'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'birth_date' => ['nullable', 'date'],
            'marketing_consent' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $id = DB::table('customers')->insertGetId([
            'tenant_id' => $tenantId,
            'code' => $request->input('code'),
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'birth_date' => $request->input('birth_date'),
            'marketing_consent' => (bool) $request->boolean('marketing_consent'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Cliente creato.', 'customer_id' => $id], 201);
    }

    public function update(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->update([
                'first_name' => $request->input('first_name'),
                'last_name' => $request->input('last_name'),
                'email' => $request->input('email'),
                'phone' => $request->input('phone'),
                'marketing_consent' => $request->has('marketing_consent') ? (bool) $request->boolean('marketing_consent') : DB::raw('marketing_consent'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        return response()->json(['message' => 'Cliente aggiornato.']);
    }
}
