<?php

namespace App\Listeners;

use App\Services\FirebaseMessagingService;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class DispatchLoyaltyPushNotification
{
    protected $firebaseService;

    public function __construct(FirebaseMessagingService $firebaseService)
    {
        $this->firebaseService = $firebaseService;
    }

    /**
     * Handle the loyalty.push.notification.dispatch event
     * Reads from outbox_events table and sends push notifications via Firebase
     */
    public function handle(): void
    {
        if (!$this->firebaseService->isEnabled()) {
            Log::info('Firebase messaging is not enabled. Skipping push dispatch.');
            return;
        }

        // Fetch unprocessed outbox events for push notification dispatch
        $events = DB::table('outbox_events')
            ->where('event_name', 'loyalty.push.notification.dispatch')
            ->whereNull('processed_at')
            ->limit(50)
            ->get();

        foreach ($events as $event) {
            try {
                $this->processEvent($event);
            } catch (\Exception $e) {
                Log::error("Failed to process outbox event {$event->id}: " . $e->getMessage());
            }
        }
    }

    /**
     * Process a single outbox event and send push notifications
     */
    protected function processEvent($event): void
    {
        $payload = json_decode($event->event_data, true) ?? [];
        
        $notificationId = $payload['notification_id'] ?? null;
        $tenantId = $payload['tenant_id'] ?? null;
        
        if (!$notificationId || !$tenantId) {
            Log::warning("Invalid outbox event payload for push dispatch: " . json_encode($payload));
            $this->markEventProcessed($event->id, false);
            return;
        }

        // Fetch notification with device tokens
        $notification = DB::table('loyalty_push_notifications')
            ->select('loyalty_push_notifications.*')
            ->where('id', $notificationId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'dispatched')
            ->first();

        if (!$notification) {
            Log::warning("Notification {$notificationId} not found or not in dispatched status");
            $this->markEventProcessed($event->id, false);
            return;
        }

        // Fetch active device tokens for the notification's customer
        $devices = DB::table('loyalty_device_tokens')
            ->where('customer_id', $notification->customer_id)
            ->where('tenant_id', $tenantId)
            ->where('notifications_enabled', true)
            ->get();

        if ($devices->isEmpty()) {
            Log::info("No active devices for notification {$notificationId}");
            $this->markEventProcessed($event->id, true);
            return;
        }

        // Prepare notification data
        $notificationData = $this->buildNotificationData($notification);

        // Send to all devices
        $deviceTokens = $devices->pluck('device_token')->toArray();
        $result = $this->firebaseService->sendToMultipleDevices($deviceTokens, $notificationData);

        // Log result
        Log::info("Push notification {$notificationId} sent to {$result['success_count']} devices", [
            'success_count' => $result['success_count'],
            'failed_count' => $result['failed_count'],
            'failed_tokens' => count($result['failed_tokens']),
        ]);

        // Update notification with delivery status
        if ($result['failed_count'] > 0) {
            DB::table('loyalty_push_notifications')
                ->where('id', $notificationId)
                ->update([
                    'status' => 'partially_delivered',
                    'delivery_status' => json_encode([
                        'success_count' => $result['success_count'],
                        'failed_count' => $result['failed_count'],
                        'failed_tokens' => $result['failed_tokens'],
                    ]),
                    'delivered_at' => now(),
                ]);
        } else {
            DB::table('loyalty_push_notifications')
                ->where('id', $notificationId)
                ->update([
                    'status' => 'delivered',
                    'delivered_at' => now(),
                ]);
        }

        // Mark event as processed
        $this->markEventProcessed($event->id, true);
    }

    /**
     * Build notification data from loyalty notification record
     */
    protected function buildNotificationData($notification): array
    {
        return [
            'title' => $this->getNotificationTitle($notification->notification_type),
            'body' => $this->getNotificationBody($notification),
            'custom_data' => [
                'notification_id' => $notification->id,
                'notification_type' => $notification->notification_type,
                'loyalty_customer_id' => $notification->customer_id,
            ],
            'deep_link' => '/loyalty/notifications/' . $notification->id,
        ];
    }

    /**
     * Get notification title based on type
     */
    protected function getNotificationTitle(string $type): string
    {
        $titles = [
            'points_earned' => 'Punti Guadagnati! 🎁',
            'points_expired' => 'Punti in Scadenza ⏰',
            'new_offer' => 'Offerta Speciale per Te 🎉',
            'tier_upgrade' => 'Hai Salito di Livello! ⭐',
            'tier_downgrade' => 'Cambio Livello Fedeltà',
        ];

        return $titles[$type] ?? 'Notifica SvaPro';
    }

    /**
     * Get notification body based on notification details
     */
    protected function getNotificationBody($notification): string
    {
        $details = json_decode($notification->notification_details, true) ?? [];

        switch ($notification->notification_type) {
            case 'points_earned':
                $points = $details['points_earned'] ?? 0;
                return "Hai guadagnato {$points} punti fedeltà!";
            
            case 'points_expired':
                $points = $details['points_expiring'] ?? 0;
                return "Attenzione: {$points} punti scadranno presto";
            
            case 'new_offer':
                $discount = $details['discount_percent'] ?? 0;
                return "Sconto speciale {$discount}% disponibile";
            
            case 'tier_upgrade':
                $tier = $details['new_tier'] ?? '';
                return "Complimenti! Sei ora {$tier}";
            
            case 'tier_downgrade':
                return "Il tuo livello fedeltà è cambiato";
            
            default:
                return "Nuova notifica disponibile";
        }
    }

    /**
     * Mark outbox event as processed
     */
    protected function markEventProcessed(int $eventId, bool $success): void
    {
        DB::table('outbox_events')
            ->where('id', $eventId)
            ->update([
                'processed_at' => now(),
                'processing_status' => $success ? 'success' : 'failed',
            ]);
    }
}
