<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    public function storeRole(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $name = trim($request->input('name'));
        $code = Str::slug($name, '_');

        // Check unique code
        if (DB::table('roles')->where('code', $code)->exists()) {
            // Append random or progressive to code
            $code .= '_' . mt_rand(100, 999);
        }

        $id = DB::table('roles')->insertGetId([
            'name' => $name,
            'code' => $code,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'create', 'role', $id, "Creato nuovo ruolo: $name ($code)");

        return response()->json(['message' => 'Ruolo creato con successo.']);
    }

    public function updateRole(Request $request, $id): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $role = DB::table('roles')->where('id', $id)->first();
        if (!$role) {
            return response()->json(['message' => 'Ruolo non trovato.'], 404);
        }

        $name = trim($request->input('name'));
        
        DB::table('roles')->where('id', $id)->update([
            'name' => $name,
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'update', 'role', $id, "Rinominato ruolo: {$role->name} → $name");

        return response()->json(['message' => 'Ruolo aggiornato con successo.']);
    }

    public function destroyRole(Request $request, $id): JsonResponse
    {
        $role = DB::table('roles')->where('id', $id)->first();
        if (!$role) {
            return response()->json(['message' => 'Ruolo non trovato.'], 404);
        }

        $protectedRoles = ['superadmin', 'admin_cliente', 'dipendente', 'cliente_finale'];
        if (in_array($role->code, $protectedRoles)) {
            return response()->json(['message' => 'Non puoi eliminare un ruolo di sistema integrato.'], 403);
        }

        // Relazioni cascade handled by database FK cascades ideally, but let's be safe
        DB::table('role_permissions')->where('role_id', $id)->delete();
        DB::table('user_roles')->where('role_id', $id)->delete();
        
        DB::table('roles')->where('id', $id)->delete();

        AuditLogger::log($request, 'delete', 'role', $id, "Eliminato ruolo: $role->name");

        return response()->json(['message' => 'Ruolo eliminato con successo.']);
    }
}
