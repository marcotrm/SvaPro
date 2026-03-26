<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $query = DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.actor_user_id')
            ->where('audit_logs.tenant_id', $tenantId)
            ->orderByDesc('audit_logs.performed_at')
            ->orderByDesc('audit_logs.id')
            ->select([
                'audit_logs.*',
                'users.name as actor_name',
                'users.email as actor_email',
            ]);

        if ($request->filled('user_id')) {
            $query->where('audit_logs.actor_user_id', $request->input('user_id'));
        }

        if ($request->filled('action')) {
            $query->where('audit_logs.action', $request->input('action'));
        }

        if ($request->filled('entity_type')) {
            $query->where('audit_logs.entity_type', $request->input('entity_type'));
        }

        if ($request->filled('entity_id')) {
            $query->where('audit_logs.entity_id', $request->input('entity_id'));
        }

        if ($request->filled('date_from')) {
            $query->where('audit_logs.performed_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->where('audit_logs.performed_at', '<=', $request->input('date_to') . ' 23:59:59');
        }

        $limit = min((int) ($request->input('limit', 50)), 200);

        $data = $query->limit($limit)->get()->map(function ($row) {
            $row->changes_json = $row->changes_json ? json_decode($row->changes_json, true) : null;
            return $row;
        });

        return response()->json(['data' => $data]);
    }

    public function show(Request $request, int $logId): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $row = DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.actor_user_id')
            ->where('audit_logs.tenant_id', $tenantId)
            ->where('audit_logs.id', $logId)
            ->select([
                'audit_logs.*',
                'users.name as actor_name',
                'users.email as actor_email',
            ])
            ->first();

        if (! $row) {
            return response()->json(['message' => 'Log non trovato.'], 404);
        }

        $row->changes_json = $row->changes_json ? json_decode($row->changes_json, true) : null;

        return response()->json(['data' => $row]);
    }

    public function filters(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $entityTypes = DB::table('audit_logs')
            ->where('tenant_id', $tenantId)
            ->distinct()
            ->pluck('entity_type');

        $actions = DB::table('audit_logs')
            ->where('tenant_id', $tenantId)
            ->distinct()
            ->pluck('action');

        return response()->json([
            'entity_types' => $entityTypes,
            'actions' => $actions,
        ]);
    }
}
