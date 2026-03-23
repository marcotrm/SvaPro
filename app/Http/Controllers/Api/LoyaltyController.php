<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LoyaltyController extends Controller
{
    public function pushMonitoringStats(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $days = min(max((int) $request->integer('days', 7), 1), 30);

        $from = now()->subDays($days - 1)->startOfDay();
        $to = now()->endOfDay();

        $statusRows = DB::table('loyalty_push_notifications')
            ->where('tenant_id', $tenantId)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->get();

        $statusCounts = [];
        foreach ($statusRows as $row) {
            $statusCounts[(string) $row->status] = (int) $row->total;
        }

        $pendingQueue = ($statusCounts['queued'] ?? 0) + ($statusCounts['pending_device'] ?? 0);
        $inFlight = $statusCounts['dispatched'] ?? 0;

        $outboxSummary = DB::table('outbox_events')
            ->where('tenant_id', $tenantId)
            ->where('event_name', 'loyalty.push.notification.dispatch')
            ->whereNotNull('processed_at')
            ->whereBetween('processed_at', [$from, $to])
            ->selectRaw("COUNT(*) as total_processed")
            ->selectRaw("SUM(CASE WHEN processing_status = 'success' THEN 1 ELSE 0 END) as success_count")
            ->selectRaw("SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed_count")
            ->first();

        $processedCount = (int) ($outboxSummary->total_processed ?? 0);
        $successCount = (int) ($outboxSummary->success_count ?? 0);
        $failedCount = (int) ($outboxSummary->failed_count ?? 0);
        $successRate = $processedCount > 0
            ? round(($successCount / $processedCount) * 100, 2)
            : 0.0;

        $trendRows = DB::table('outbox_events')
            ->where('tenant_id', $tenantId)
            ->where('event_name', 'loyalty.push.notification.dispatch')
            ->whereNotNull('processed_at')
            ->whereBetween('processed_at', [$from, $to])
            ->selectRaw('DATE(processed_at) as day')
            ->selectRaw("SUM(CASE WHEN processing_status = 'success' THEN 1 ELSE 0 END) as success_count")
            ->selectRaw("SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed_count")
            ->groupByRaw('DATE(processed_at)')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $deliveryTrend = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = now()->subDays($i)->toDateString();
            $row = $trendRows->get($day);
            $daySuccess = is_object($row) ? (int) $row->success_count : 0;
            $dayFailed = is_object($row) ? (int) $row->failed_count : 0;
            $dayTotal = $daySuccess + $dayFailed;

            $deliveryTrend[] = [
                'date' => Carbon::parse($day)->format('d/m'),
                'success_count' => $daySuccess,
                'failed_count' => $dayFailed,
                'success_rate' => $dayTotal > 0 ? round(($daySuccess / $dayTotal) * 100, 2) : 0,
            ];
        }

        $deviceRows = DB::table('loyalty_device_tokens')
            ->where('tenant_id', $tenantId)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as registered_count')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $deviceTrend = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = now()->subDays($i)->toDateString();
            $deviceRow = $deviceRows->get($day);
            $registered = is_object($deviceRow) ? (int) $deviceRow->registered_count : 0;
            $deviceTrend[] = [
                'date' => Carbon::parse($day)->format('d/m'),
                'registered_count' => $registered,
            ];
        }

        $activeDeviceCount = DB::table('loyalty_device_tokens')
            ->where('tenant_id', $tenantId)
            ->where('notifications_enabled', true)
            ->count();

        $totalDeviceCount = DB::table('loyalty_device_tokens')
            ->where('tenant_id', $tenantId)
            ->count();

        $recentNotifications = DB::table('loyalty_push_notifications as lpn')
            ->leftJoin('customers as c', function ($join) use ($tenantId) {
                $join->on('c.id', '=', 'lpn.customer_id')
                    ->where('c.tenant_id', '=', $tenantId);
            })
            ->where('lpn.tenant_id', $tenantId)
            ->orderByDesc('lpn.id')
            ->limit(12)
            ->get([
                'lpn.id',
                'lpn.notification_type',
                'lpn.title',
                'lpn.status',
                'lpn.target_devices_count',
                'lpn.sent_at',
                'lpn.delivered_at',
                'lpn.created_at',
                'c.first_name',
                'c.last_name',
                'c.code as customer_code',
            ]);

        return response()->json([
            'summary' => [
                'pending_queue' => $pendingQueue,
                'in_flight' => $inFlight,
                'success_count' => $successCount,
                'failed_count' => $failedCount,
                'processed_count' => $processedCount,
                'success_rate' => $successRate,
                'active_devices' => (int) $activeDeviceCount,
                'total_devices' => (int) $totalDeviceCount,
            ],
            'status_breakdown' => $statusCounts,
            'delivery_trend' => $deliveryTrend,
            'device_registration_trend' => $deviceTrend,
            'recent_notifications' => $recentNotifications,
            'meta' => [
                'days' => $days,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ]);
    }

    public function showWallet(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $wallet = DB::table('loyalty_wallets as lw')
            ->join('customers as c', 'c.id', '=', 'lw.customer_id')
            ->leftJoin('loyalty_cards as lc', 'lc.customer_id', '=', 'c.id')
            ->where('lw.tenant_id', $tenantId)
            ->where('lw.customer_id', $customerId)
            ->select([
                'lw.customer_id',
                'lw.points_balance',
                'lw.tier_code',
                'c.first_name',
                'c.last_name',
                'c.email',
                'lc.card_code',
                'lc.status as card_status',
            ])
            ->first();

        if (! $wallet) {
            return response()->json(['message' => 'Wallet loyalty non trovato.'], 404);
        }

        $ledger = DB::table('loyalty_ledger')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        $devices = DB::table('loyalty_device_tokens')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('last_seen_at')
            ->get(['id', 'platform', 'device_name', 'app_version', 'notifications_enabled', 'last_seen_at']);

        $notifications = DB::table('loyalty_push_notifications')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->limit(10)
            ->get();

        return response()->json([
            'wallet' => $wallet,
            'ledger' => $ledger,
            'devices' => $devices,
            'notifications' => $notifications,
        ]);
    }

    public function registerDevice(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'platform' => ['required', 'in:ios,android,web'],
            'device_token' => ['required', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:100'],
            'app_version' => ['nullable', 'string', 'max:30'],
            'notifications_enabled' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $customerExists = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->exists();

        if (! $customerExists) {
            return response()->json(['message' => 'Cliente non trovato per il tenant.'], 404);
        }

        $now = now();

        DB::table('loyalty_device_tokens')->updateOrInsert(
            ['device_token' => (string) $request->input('device_token')],
            [
                'tenant_id' => $tenantId,
                'customer_id' => $customerId,
                'platform' => (string) $request->input('platform'),
                'device_name' => $request->input('device_name'),
                'app_version' => $request->input('app_version'),
                'notifications_enabled' => (bool) $request->boolean('notifications_enabled', true),
                'last_seen_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        return response()->json(['message' => 'Device loyalty registrato.']);
    }

    public function notifications(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $notifications = DB::table('loyalty_push_notifications')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->limit((int) $request->input('limit', 20))
            ->get();

        return response()->json([
            'data' => $notifications,
            'meta' => [
                'unread' => DB::table('loyalty_push_notifications')
                    ->where('tenant_id', $tenantId)
                    ->where('customer_id', $customerId)
                    ->whereNull('read_at')
                    ->count(),
            ],
        ]);
    }

    public function markNotificationRead(Request $request, int $customerId, int $notificationId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('loyalty_push_notifications')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->where('id', $notificationId)
            ->update([
                'read_at' => now(),
                'status' => 'read',
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Notifica loyalty non trovata.'], 404);
        }

        return response()->json(['message' => 'Notifica segnata come letta.']);
    }

    public function redeemPreview(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'points' => ['required', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $wallet = DB::table('loyalty_wallets')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->first();

        if (! $wallet) {
            return response()->json(['message' => 'Wallet loyalty non trovato.'], 404);
        }

        $requestedPoints = (int) $request->integer('points');
        $currentBalance = (int) $wallet->points_balance;

        if ($requestedPoints > $currentBalance) {
            return response()->json(['message' => 'Punti insufficienti per il riscatto.'], 422);
        }

        $monetaryValue = round($requestedPoints * 0.05, 2);

        return response()->json([
            'customer_id' => $customerId,
            'requested_points' => $requestedPoints,
            'current_balance' => $currentBalance,
            'remaining_balance' => $currentBalance - $requestedPoints,
            'monetary_value' => $monetaryValue,
        ]);
    }
}
