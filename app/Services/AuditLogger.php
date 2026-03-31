<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogger
{
    public static function log(Request $request, string $action, string $entityType, ?int $entityId = null, ?string $entityLabel = null, ?array $changes = null, ?string $attachmentUrl = null): void
    {
        $tenantId = $request->attributes->get('tenant_id');

        if (! $tenantId) {
            return;
        }

        $user = $request->user();

        DB::table('audit_logs')->insert([
            'tenant_id'     => $tenantId,
            'actor_user_id' => $user?->id,
            'user_name'     => $user?->name ?? $user?->email,
            'action'        => $action,
            'entity_type'   => $entityType,
            'entity_id'     => $entityId,
            'entity_label'  => $entityLabel ? mb_substr($entityLabel, 0, 255) : null,
            'changes_json'  => $changes ? json_encode($changes) : null,
            'attachment_url'=> $attachmentUrl,
            'ip'            => $request->ip(),
            'performed_at'  => now(),
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }
}
