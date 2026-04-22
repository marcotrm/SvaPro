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

        // For superadmin/admin: allow switching tenant via X-Tenant-Code header
        if ($isSuperAdmin && $requestedTenantCode) {
            $tenantId = (int) DB::table('tenants')->where('code', $requestedTenantCode)->value('id');

            if (! $tenantId) {
                return response()->json(['message' => 'Tenant non trovato.'], 404);
            }

            $request->attributes->set('tenant_id', $tenantId);
            return $next($request);
        }

        // For regular users: always use their own tenant_id
        $tenantId = (int) $user->tenant_id;
        if (! $tenantId) {
            return response()->json(['message' => 'Tenant non assegnato all\'utente.'], 422);
        }
        $request->attributes->set('tenant_id', $tenantId);

        // Security check for store_manager and dipendente: force store_id
        // BUT skip if user is also a project_manager (they need to switch stores freely)
        $isStoreManager = in_array('store_manager', $roleCodes, true);
        $isDipendente = in_array('dipendente', $roleCodes, true);
        $isProjectManager = in_array('project_manager', $roleCodes, true);
        
        if (($isStoreManager || $isDipendente) && !$isProjectManager && !$isSuperAdmin) {
            // Find the assigned store_id
            $assignedStoreId = DB::table('user_roles')
                ->where('user_id', $user->id)
                ->whereNotNull('store_id')
                ->value('store_id');
            
            // Fallback: get store from employee record
            if (!$assignedStoreId) {
                $assignedStoreId = DB::table('employees')
                    ->where('user_id', $user->id)
                    ->where('tenant_id', $tenantId)
                    ->value('store_id');
            }
            
            if ($assignedStoreId) {
                // Force X-Store-ID attribute on request so controllers use it
                $request->headers->set('X-Store-ID', $assignedStoreId);
                $request->headers->set('x-store-id', $assignedStoreId);
                $request->attributes->set('store_id', $assignedStoreId);
                // Force the query parameter and payload so filters can't be bypassed
                $request->query->set('store_id', $assignedStoreId);
                $request->merge(['store_id' => $assignedStoreId]);
            }
        }

        return $next($request);
    }
}
