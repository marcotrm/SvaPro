<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StoreController extends Controller
{
    public function tenants(Request $request): JsonResponse
    {
        $user = $request->user();

        $roleCodes = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->pluck('roles.code')
            ->all();

        $isSuperAdmin = in_array('superadmin', $roleCodes, true);

        $query = DB::table('tenants')
            ->orderBy('name')
            ->select(['id', 'code', 'name', 'status']);

        if (! $isSuperAdmin) {
            $query->where('id', (int) $user->tenant_id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'city', 'is_main']);

        return response()->json(['data' => $stores]);
    }
}
