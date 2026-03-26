<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string ...$requiredPermissions)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Non autenticato.'], 401);
        }

        $userPermissions = DB::table('user_roles as ur')
            ->join('role_permissions as rp', 'rp.role_id', '=', 'ur.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->where('ur.user_id', $user->id)
            ->pluck('p.code')
            ->unique()
            ->all();

        foreach ($requiredPermissions as $perm) {
            if (in_array($perm, $userPermissions, true)) {
                return $next($request);
            }
        }

        return response()->json(['message' => 'Permesso insufficiente per questa operazione.'], 403);
    }
}
