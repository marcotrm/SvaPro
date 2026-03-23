<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    private function hasRole(int $userId, string $roleCode): bool
    {
        return DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $userId)
            ->where('roles.code', $roleCode)
            ->exists();
    }

    private function buildUserPayload(User $user): array
    {
        $roles = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->pluck('roles.code')
            ->values();

        $tenantCode = DB::table('tenants')->where('id', $user->tenant_id)->value('code');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'tenant_id' => $user->tenant_id,
            'tenant_code' => $tenantCode,
            'roles' => $roles,
        ];
    }

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        /** @var User|null $user */
        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
            return response()->json(['message' => 'Credenziali non valide.'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'Utente disattivato.'], 403);
        }

        $token = $user->createToken((string) ($request->input('device_name') ?: 'api-client'))->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->buildUserPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        $tenantCode = DB::table('tenants')->where('id', $user->tenant_id)->value('code');

        return response()->json($this->buildUserPayload($user));
    }

    public function switchableUsers(Request $request): JsonResponse
    {
        $actor = $request->user();

        if (! $this->hasRole((int) $actor->id, 'superadmin')) {
            return response()->json(['message' => 'Permessi insufficienti.'], 403);
        }

        $tenantCode = (string) $request->query('tenant_code', '');

        $query = DB::table('users as u')
            ->join('tenants as t', 't.id', '=', 'u.tenant_id')
            ->join('user_roles as ur', 'ur.user_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->where('u.status', 'active')
            ->where('r.code', 'admin_cliente')
            ->select([
                'u.id',
                'u.name',
                'u.email',
                'u.tenant_id',
                't.code as tenant_code',
                't.name as tenant_name',
            ])
            ->distinct()
            ->orderBy('t.name')
            ->orderBy('u.name');

        if ($tenantCode !== '') {
            $query->where('t.code', $tenantCode);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function impersonate(Request $request): JsonResponse
    {
        $actor = $request->user();

        if (! $this->hasRole((int) $actor->id, 'superadmin')) {
            return response()->json(['message' => 'Permessi insufficienti.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        /** @var User|null $target */
        $target = User::find((int) $request->integer('user_id'));

        if (! $target || $target->status !== 'active') {
            return response()->json(['message' => 'Utente non disponibile per accesso rapido.'], 422);
        }

        if (! $this->hasRole((int) $target->id, 'admin_cliente')) {
            return response()->json(['message' => 'Puoi fare switch solo su utenti admin_cliente.'], 422);
        }

        $token = $target->createToken('impersonation')->plainTextToken;

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->buildUserPayload($target),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logout eseguito.']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'current_password' => ['nullable', 'string'],
            'new_password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->filled('new_password')) {
            if (! $request->filled('current_password') || ! Hash::check((string) $request->input('current_password'), $user->password)) {
                return response()->json(['message' => 'Password attuale non corretta.'], 422);
            }
            $user->password = Hash::make((string) $request->input('new_password'));
        }

        $user->name = (string) $request->input('name');
        $user->email = (string) $request->input('email');
        $user->save();

        AuditLogger::log($request, 'update', 'profile', $user->id, $user->name);

        return response()->json([
            'message' => 'Profilo aggiornato.',
            'user' => $this->buildUserPayload($user),
        ]);
    }
}
