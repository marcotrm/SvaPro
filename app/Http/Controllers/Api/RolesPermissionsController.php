<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RolesPermissionsController extends Controller
{
    public function matrix(Request $request): JsonResponse
    {
        $roles = DB::table('roles')->orderBy('id')->get(['id', 'code', 'name']);
        $permissions = DB::table('permissions')->orderBy('id')->get(['id', 'code', 'name']);

        $assigned = DB::table('role_permissions')
            ->get(['role_id', 'permission_id'])
            ->groupBy('role_id')
            ->map(fn ($items) => $items->pluck('permission_id')->all());

        $matrix = $roles->map(function ($role) use ($assigned) {
            return [
                'role_id' => $role->id,
                'role_code' => $role->code,
                'role_name' => $role->name,
                'permission_ids' => $assigned->get($role->id, []),
            ];
        });

        return response()->json([
            'roles' => $roles,
            'permissions' => $permissions,
            'matrix' => $matrix,
        ]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $roleId = (int) $request->input('role_id');
        $permissionId = (int) $request->input('permission_id');

        $exists = DB::table('role_permissions')
            ->where('role_id', $roleId)
            ->where('permission_id', $permissionId)
            ->exists();

        if ($exists) {
            DB::table('role_permissions')
                ->where('role_id', $roleId)
                ->where('permission_id', $permissionId)
                ->delete();
            $action = 'revoke';
        } else {
            DB::table('role_permissions')->insert([
                'role_id' => $roleId,
                'permission_id' => $permissionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $action = 'grant';
        }

        $roleName = DB::table('roles')->where('id', $roleId)->value('name');
        $permName = DB::table('permissions')->where('id', $permissionId)->value('name');

        AuditLogger::log($request, $action, 'permission', $roleId, "$roleName → $permName");

        return response()->json([
            'message' => $action === 'grant' ? 'Permesso assegnato.' : 'Permesso revocato.',
            'action' => $action,
        ]);
    }
}
