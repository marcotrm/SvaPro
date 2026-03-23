<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DispatchLoyaltyPushNotificationsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'loyalty:dispatch-push {--tenantId= : Tenant ID opzionale} {--limit=100 : Numero massimo di notifiche da processare}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Processa la coda notifiche loyalty e genera eventi outbox di dispatch push';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $tenantId = $this->option('tenantId');
        $limit = max(1, (int) $this->option('limit'));

        $notifications = DB::table('loyalty_push_notifications')
            ->when($tenantId !== null, fn ($query) => $query->where('tenant_id', (int) $tenantId))
            ->whereIn('status', ['queued', 'pending_device'])
            ->orderBy('id')
            ->limit($limit)
            ->get();

        if ($notifications->isEmpty()) {
            $this->info('Nessuna notifica loyalty da processare.');
            return self::SUCCESS;
        }

        $processed = 0;
        $skipped = 0;
        $now = now();

        foreach ($notifications as $notification) {
            $deviceCount = DB::table('loyalty_device_tokens')
                ->where('tenant_id', (int) $notification->tenant_id)
                ->where('customer_id', (int) $notification->customer_id)
                ->where('notifications_enabled', true)
                ->count();

            if ($deviceCount <= 0) {
                DB::table('loyalty_push_notifications')
                    ->where('id', (int) $notification->id)
                    ->update([
                        'status' => 'pending_device',
                        'target_devices_count' => 0,
                        'updated_at' => $now,
                    ]);

                $skipped++;
                continue;
            }

            DB::table('outbox_events')->insert([
                'tenant_id' => (int) $notification->tenant_id,
                'event_name' => 'loyalty.push.notification.dispatch',
                'payload_json' => json_encode([
                    'notification_id' => (int) $notification->id,
                    'customer_id' => (int) $notification->customer_id,
                    'notification_type' => (string) $notification->notification_type,
                    'target_devices_count' => $deviceCount,
                ]),
                'published_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('loyalty_push_notifications')
                ->where('id', (int) $notification->id)
                ->update([
                    'status' => 'dispatched',
                    'target_devices_count' => $deviceCount,
                    'sent_at' => $now,
                    'updated_at' => $now,
                ]);

            $processed++;
        }

        $this->info('Notifiche processate: '.$processed);
        $this->line('Notifiche in attesa device: '.$skipped);

        return self::SUCCESS;
    }
}