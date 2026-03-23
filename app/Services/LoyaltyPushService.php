<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class LoyaltyPushService
{
    public function queuePointsEarnedNotification(int $tenantId, int $customerId, int $orderId, int $pointsDelta, ?int $loyaltyLedgerId = null): ?int
    {
        if ($pointsDelta <= 0) {
            return null;
        }

        $customer = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->select(['first_name', 'last_name'])
            ->first();

        if (! $customer) {
            return null;
        }

        $activeDevices = DB::table('loyalty_device_tokens')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->where('notifications_enabled', true)
            ->get(['id', 'platform', 'device_token']);

        $targetDevicesCount = $activeDevices->count();
        $status = $targetDevicesCount > 0 ? 'queued' : 'pending_device';
        $now = now();

        $payload = [
            'customer_id' => $customerId,
            'order_id' => $orderId,
            'points_delta' => $pointsDelta,
            'devices' => $activeDevices->map(fn ($device) => [
                'id' => (int) $device->id,
                'platform' => $device->platform,
                'device_token' => $device->device_token,
            ])->values()->all(),
        ];

        $notificationId = DB::table('loyalty_push_notifications')->insertGetId([
            'tenant_id' => $tenantId,
            'customer_id' => $customerId,
            'loyalty_ledger_id' => $loyaltyLedgerId,
            'order_id' => $orderId,
            'notification_type' => 'points_earned',
            'title' => 'Nuovi punti loyalty disponibili',
            'message' => trim($customer->first_name.' '.$customer->last_name).', hai accumulato '.$pointsDelta.' punti con il tuo ultimo acquisto.',
            'payload_json' => json_encode($payload),
            'status' => $status,
            'target_devices_count' => $targetDevicesCount,
            'queued_at' => $now,
            'sent_at' => $targetDevicesCount > 0 ? $now : null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('outbox_events')->insert([
            'tenant_id' => $tenantId,
            'event_name' => 'loyalty.push.notification.created',
            'payload_json' => json_encode([
                'notification_id' => $notificationId,
                'customer_id' => $customerId,
                'status' => $status,
                'target_devices_count' => $targetDevicesCount,
                'type' => 'points_earned',
            ]),
            'published_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $notificationId;
    }
}