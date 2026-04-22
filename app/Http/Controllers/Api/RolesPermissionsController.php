<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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
        $request->validate(['name' => 'required|string|max:255']);

        $name = trim($request->input('name'));
        $code = Str::slug($name, '_');

        if (DB::table('roles')->where('code', $code)->exists()) {
            $code .= '_' . mt_rand(100, 999);
        }

        $id = DB::table('roles')->insertGetId([
            'name' => $name,
            'code' => $code,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $role = DB::table('roles')->where('id', $id)->first();

        AuditLogger::log($request, 'create', 'role', $id, "Creato ruolo: $name ($code)");

        return response()->json([
            'message' => 'Ruolo creato con successo.',
            'role' => $role,
        ], 201);
    }

    public function updateRole(Request $request, $id): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:255']);

        $role = DB::table('roles')->where('id', $id)->first();
        if (!$role) return response()->json(['message' => 'Ruolo non trovato.'], 404);

        $name = trim($request->input('name'));
        DB::table('roles')->where('id', $id)->update(['name' => $name, 'updated_at' => now()]);

        AuditLogger::log($request, 'update', 'role', $id, "{$role->name} → $name");

        return response()->json(['message' => 'Ruolo aggiornato.', 'role' => DB::table('roles')->where('id', $id)->first()]);
    }

    public function destroyRole(Request $request, $id): JsonResponse
    {
        $role = DB::table('roles')->where('id', $id)->first();
        if (!$role) return response()->json(['message' => 'Ruolo non trovato.'], 404);

        $protected = ['superadmin', 'admin_cliente', 'dipendente', 'cliente_finale'];
        if (in_array($role->code, $protected)) {
            return response()->json(['message' => 'Non puoi eliminare un ruolo di sistema.'], 403);
        }

        DB::table('role_permissions')->where('role_id', $id)->delete();
        DB::table('user_roles')->where('role_id', $id)->delete();
        DB::table('roles')->where('id', $id)->delete();

        AuditLogger::log($request, 'delete', 'role', $id, "Eliminato ruolo: {$role->name}");

        return response()->json(['message' => 'Ruolo eliminato.']);
    }

    // ── User management per ruoli ──────────────────────────────────────

    public function listUsers(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $users = DB::table('users as u')
            ->where('u.tenant_id', $tenantId)
            ->where('u.status', 'active')
            ->get(['u.id', 'u.name', 'u.email', 'u.status']);

        $userRoles = DB::table('user_roles as ur')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->whereIn('ur.user_id', $users->pluck('id'))
            ->get(['ur.user_id', 'r.id as role_id', 'r.code as role_code', 'r.name as role_name']);

        $grouped = $userRoles->groupBy('user_id');

        $result = $users->map(function ($u) use ($grouped) {
            return array_merge((array) $u, [
                'roles' => $grouped->get($u->id, collect())->values(),
            ]);
        });

        return response()->json(['data' => $result]);
    }

    public function assignRole(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role_id' => 'required|integer|exists:roles,id',
        ]);

        $userId = (int) $request->input('user_id');
        $roleId = (int) $request->input('role_id');
        $tenantId = $request->user()->tenant_id;

        $alreadyHas = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role_id', $roleId)
            ->where('tenant_id', $tenantId)
            ->exists();

        if (!$alreadyHas) {
            DB::table('user_roles')->insert([
                'user_id' => $userId,
                'role_id' => $roleId,
                'tenant_id' => $tenantId,
                'store_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $roleName = DB::table('roles')->where('id', $roleId)->value('name');
        $userName = DB::table('users')->where('id', $userId)->value('name');
        AuditLogger::log($request, 'assign_role', 'user', $userId, "$userName → $roleName");

        return response()->json(['message' => 'Ruolo assegnato all\'utente.']);
    }

    public function revokeRole(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role_id' => 'required|integer|exists:roles,id',
        ]);

        $userId = (int) $request->input('user_id');
        $roleId = (int) $request->input('role_id');
        $tenantId = $request->user()->tenant_id;

        DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role_id', $roleId)
            ->where('tenant_id', $tenantId)
            ->delete();

        $roleName = DB::table('roles')->where('id', $roleId)->value('name');
        $userName = DB::table('users')->where('id', $userId)->value('name');
        AuditLogger::log($request, 'revoke_role', 'user', $userId, "$userName ← $roleName");

        return response()->json(['message' => 'Ruolo revocato.']);
    }

    public function destroyPermission(Request $request, $id): JsonResponse
    {
        $perm = DB::table('permissions')->where('id', $id)->first();
        if (!$perm) return response()->json(['message' => 'Permesso non trovato.'], 404);

        DB::table('role_permissions')->where('permission_id', $id)->delete();
        DB::table('permissions')->where('id', $id)->delete();

        AuditLogger::log($request, 'delete', 'permission', $id, "Eliminato permesso: {$perm->name}");
        return response()->json(['message' => 'Permesso eliminato.']);
    }

    /**
     * Crea un nuovo permesso/modulo personalizzato.
     */
    public function storePermission(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'code' => 'nullable|string|max:100',
        ]);

        $name = trim($request->input('name'));
        $code = $request->input('code')
            ? Str::slug($request->input('code'), '_')
            : Str::slug($name, '_');

        if (DB::table('permissions')->where('code', $code)->exists()) {
            return response()->json(['message' => 'Esiste già un permesso con questo codice.'], 422);
        }

        $id = DB::table('permissions')->insertGetId([
            'name'       => $name,
            'code'       => $code,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'create', 'permission', $id, "Creato permesso: $name ($code)");

        return response()->json([
            'message'    => 'Permesso creato.',
            'permission' => ['id' => $id, 'name' => $name, 'code' => $code],
        ], 201);
    }

    /**
     * Crea un nuovo utente nel tenant dell'admin loggato.
     */
    public function storeUser(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role_id'  => 'nullable|integer|exists:roles,id',
        ]);

        $userId = DB::table('users')->insertGetId([
            'tenant_id'  => $tenantId,
            'name'       => $request->input('name'),
            'email'      => $request->input('email'),
            'password'   => Hash::make($request->input('password')),
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Assegna ruolo se fornito
        if ($request->input('role_id')) {
            DB::table('user_roles')->insert([
                'user_id'    => $userId,
                'role_id'    => (int) $request->input('role_id'),
                'tenant_id'  => $tenantId,
                'store_id'   => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        AuditLogger::log($request, 'create', 'user', $userId, "Creato utente: {$request->input('name')} ({$request->input('email')})");

        return response()->json([
            'message' => 'Utente creato con successo.',
            'user'    => ['id' => $userId, 'name' => $request->input('name'), 'email' => $request->input('email')],
        ], 201);
    }

    /**
     * Elimina un utente dal tenant (solo se non è il superadmin attuale).
     */
    public function destroyUser(Request $request, $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $currentUserId = $request->user()->id;

        if ((int) $id === $currentUserId) {
            return response()->json(['message' => 'Non puoi eliminare te stesso.'], 422);
        }

        $user = DB::table('users')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$user) return response()->json(['message' => 'Utente non trovato.'], 404);

        // Rimuovi ruoli e poi l'utente
        DB::table('user_roles')->where('user_id', $id)->where('tenant_id', $tenantId)->delete();
        DB::table('users')->where('id', $id)->delete();

        AuditLogger::log($request, 'delete', 'user', $id, "Eliminato utente: {$user->name} ({$user->email})");

        return response()->json(['message' => 'Utente eliminato.']);
    }

    /**
     * Restituisce i dati di un utente (solo superadmin del tenant).
     */
    public function showUser(Request $request, $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $user = DB::table('users')->where('id', $id)->where('tenant_id', $tenantId)
            ->first(['id', 'name', 'email', 'status', 'password_hint']);
        if (!$user) return response()->json(['message' => 'Utente non trovato.'], 404);
        return response()->json(['data' => $user]);
    }

    /**
     * Aggiorna nome, email e/o password di un utente (solo superadmin).
     */
    public function updateUser(Request $request, $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'name'     => 'sometimes|string|max:100',
            'email'    => "sometimes|email|unique:users,email,$id",
            'password' => 'sometimes|nullable|string|min:6',
        ]);

        $user = DB::table('users')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$user) return response()->json(['message' => 'Utente non trovato.'], 404);

        $data = ['updated_at' => now()];
        if ($request->filled('name'))     $data['name']  = $request->input('name');
        if ($request->filled('email'))    $data['email'] = $request->input('email');
        if ($request->filled('password')) {
            $data['password']      = Hash::make($request->input('password'));
            $data['password_hint'] = $request->input('password'); // conserva in chiaro solo per superadmin
        }

        DB::table('users')->where('id', $id)->update($data);

        AuditLogger::log($request, 'update', 'user', $id, "Aggiornato utente: {$user->name}");

        return response()->json(['message' => 'Utente aggiornato.']);
    }
}
