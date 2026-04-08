<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Support both comma-separated and variadic args
        $requiredRoles = [];
        foreach ($roles as $r) {
            foreach (array_map('trim', explode(',', $r)) as $role) {
                if ($role !== '') {
                    $requiredRoles[] = $role;
                }
            }
        }

        $userRoles = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->pluck('roles.code')
            ->all();

        if (count(array_intersect($requiredRoles, $userRoles)) === 0) {
            return response()->json(['message' => 'Permessi insufficienti.'], 403);
        }

        return $next($request);
    }
}
