<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ResolveTenant
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $requestedTenantCode = $request->header('X-Tenant-Code');

        $roleCodes = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->pluck('roles.code')
            ->all();

        $isSuperAdmin = in_array('superadmin', $roleCodes, true);

        // For superadmin: allow switching tenant via X-Tenant-Code header
        if ($isSuperAdmin && $requestedTenantCode) {
            $tenantId = (int) DB::table('tenants')->where('code', $requestedTenantCode)->value('id');

            if (! $tenantId) {
                return response()->json(['message' => 'Tenant non trovato.'], 404);
            }

            $request->attributes->set('tenant_id', $tenantId);
            return $next($request);
        }

        // For regular users: always use their own tenant_id (ignore X-Tenant-Code)
        // This prevents 403 loops caused by stale localStorage tenant codes
        $tenantId = (int) $user->tenant_id;

        if (! $tenantId) {
            return response()->json(['message' => 'Tenant non assegnato all\'utente.'], 422);
        }

        $request->attributes->set('tenant_id', $tenantId);

        return $next($request);
    }
}
