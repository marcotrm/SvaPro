<?php

namespace App\Console\Commands;

use App\Services\FirebaseMessagingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessLoyaltyPushDeliveries extends Command
{
    protected $signature = 'loyalty:process-firebase-deliveries {--tenantId=} {--limit=50}';
    protected $description = 'Process Firebase push notification deliveries from outbox events';

    protected $firebaseService;

    public function __construct(FirebaseMessagingService $firebaseService)
    {
        parent::__construct();
        $this->firebaseService = $firebaseService;
    }

    public function handle(): int
    {
        if (!$this->firebaseService->isEnabled()) {
            $this->warn('Firebase messaging is not enabled. Configure FIREBASE_CREDENTIALS_PATH in .env');
            return 0;
        }

        $limit = (int) $this->option('limit');
        $tenantId = $this->option('tenantId');

        $query = DB::table('outbox_events')
            ->where('event_name', 'loyalty.push.notification.dispatch')
            ->whereNull('processed_at')
            ->limit($limit);

        $events = $query->get();

        if ($events->isEmpty()) {
            $this->info('No pending Firebase push deliveries to process.');
            return 0;
        }

        $successCount = 0;
        $failureCount = 0;

        foreach ($events as $event) {
            try {
                if ($this->processEvent($event)) {
                    $successCount++;
                } else {
                    $failureCount++;
                }
            } catch (\Exception $e) {
                Log::error("Failed to process outbox event {$event->id}: " . $e->getMessage());
                $failureCount++;
                $this->markEventProcessed($event->id, false);
            }
        }

        $this->info("Firebase push delivery completed: {$successCount} succeeded, {$failureCount} failed");

        return 0;
    }

    /**
     * Process a single outbox event and send Firebase push notifications
     */
    protected function processEvent($event): bool
    {
        $payload = json_decode($event->event_data, true) ?? [];

        $notificationId = $payload['notification_id'] ?? null;
        $tenantId = $payload['tenant_id'] ?? null;

        if (!$notificationId || !$tenantId) {
            Log::warning("Invalid outbox event payload: " . json_encode($payload));
            $this->markEventProcessed($event->id, false);
            return false;
        }

        // Fetch notification
        $notification = DB::table('loyalty_push_notifications')
            ->where('id', $notificationId)
            ->where('tenant_id', $tenantId)
            ->where('status', 'dispatched')
            ->first();

        if (!$notification) {
            Log::warning("Notification {$notificationId} not found or not in dispatched status");
            $this->markEventProcessed($event->id, false);
            return false;
        }

        // Fetch active device tokens
        $devices = DB::table('loyalty_device_tokens')
            ->where('customer_id', $notification->customer_id)
            ->where('tenant_id', $tenantId)
            ->where('notifications_enabled', true)
            ->get();

        if ($devices->isEmpty()) {
            Log::info("No active devices for notification {$notificationId}");
            $this->markEventProcessed($event->id, true);
            return true;
        }

        // Build and send notification to all devices
        $notificationData = $this->buildNotificationData($notification);
        $deviceTokens = $devices->pluck('device_token')->toArray();
        $result = $this->firebaseService->sendToMultipleDevices($deviceTokens, $notificationData);

        // Update notification status
        if ($result['failed_count'] > 0) {
            DB::table('loyalty_push_notifications')
                ->where('id', $notificationId)
                ->update([
                    'status' => 'partially_delivered',
                    'delivery_status' => json_encode([
                        'success_count' => $result['success_count'],
                        'failed_count' => $result['failed_count'],
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

        $this->markEventProcessed($event->id, true);

        Log::info("Notification {$notificationId} sent to {$result['success_count']} devices");

        return true;
    }

    /**
     * Build notification data
     */
    protected function buildNotificationData($notification): array
    {
        return [
            'title' => $this->getNotificationTitle($notification->notification_type),
            'body' => $this->getNotificationBody($notification),
            'custom_data' => [
                'notification_id' => $notification->id,
                'notification_type' => $notification->notification_type,
            ],
            'deep_link' => '/loyalty/notifications/' . $notification->id,
        ];
    }

    protected function getNotificationTitle(string $type): string
    {
        $titles = [
            'points_earned' => 'Punti Guadagnati! 🎁',
            'points_expired' => 'Punti in Scadenza ⏰',
            'new_offer' => 'Offerta Speciale per Te 🎉',
            'tier_upgrade' => 'Hai Salito di Livello! ⭐',
            'tier_downgrade' => 'Cambio Livello Fedeltà',
        ];

        return $titles[$type] ?? 'Notifica';
    }

    protected function getNotificationBody($notification): string
    {
        $details = json_decode($notification->notification_details, true) ?? [];

            $pointsEarned = $details['points_earned'] ?? 0;
            $pointsExpiring = $details['points_expiring'] ?? 0;
            $discountPercent = $details['discount_percent'] ?? 0;
            $newTier = $details['new_tier'] ?? 'VIP';

            return match ($notification->notification_type) {
                'points_earned' => "Hai guadagnato {$pointsEarned} punti!",
                'points_expired' => "Attenzione: {$pointsExpiring} punti scadranno presto",
                'new_offer' => "Sconto speciale {$discountPercent}% disponibile",
                'tier_upgrade' => "Complimenti! Sei ora {$newTier}",
                'tier_downgrade' => "Il tuo livello fedeltà è cambiato",
                default => "Nuova notifica disponibile"
            };
    }

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
