<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $customers = $this->customerBaseQuery($tenantId, $storeId)
            ->when($storeId !== null, fn ($query) => $query->whereNotNull('order_stats.customer_id'))
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = trim((string) $request->input('q'));
                $query->where(function ($inner) use ($term) {
                    $inner->where('c.first_name', 'like', '%'.$term.'%')
                        ->orWhere('c.last_name', 'like', '%'.$term.'%')
                        ->orWhere('c.email', 'like', '%'.$term.'%')
                        ->orWhere('c.code', 'like', '%'.$term.'%')
                        ->orWhere('ca.city', 'like', '%'.$term.'%');
                });
            })
            ->when($request->filled('city'), function ($query) use ($request) {
                $query->where('ca.city', $request->input('city'));
            })
            ->orderByDesc('id')
            ->limit((int) $request->input('limit', 100))
            ->get();

        return response()->json(['data' => $this->hydrateCustomers($customers)]);
    }

    public function returnFrequencyAnalytics(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $customers = $this->hydrateCustomers(
            $this->customerBaseQuery($tenantId, $storeId)
                ->when($storeId !== null, fn ($query) => $query->whereNotNull('order_stats.customer_id'))
                ->get()
        );

        $cityBreakdown = collect($customers)
            ->filter(fn (array $customer) => ! empty($customer['city']))
            ->groupBy('city')
            ->map(fn ($items, $city) => [
                'city' => $city,
                'customers' => count($items),
            ])
            ->sortByDesc('customers')
            ->values()
            ->all();

        $returningCustomers = collect($customers)
            ->filter(fn (array $customer) => ($customer['paid_orders_count'] ?? 0) > 1)
            ->values();

        $avgReturnDays = round((float) $returningCustomers
            ->pluck('return_frequency_days')
            ->filter(fn ($value) => $value !== null)
            ->avg(), 1);

        $inactiveCutoff = now()->subDays(30);
        $inactiveCustomers = collect($customers)
            ->filter(function (array $customer) use ($inactiveCutoff) {
                if (empty($customer['last_purchase_at'])) {
                    return false;
                }

                return Carbon::parse($customer['last_purchase_at'])->lt($inactiveCutoff);
            })
            ->count();

        $topReturners = $returningCustomers
            ->sortBy([
                ['return_frequency_days', 'asc'],
                ['last_purchase_at', 'desc'],
            ])
            ->take(5)
            ->map(function (array $customer) {
                return [
                    'customer_id' => $customer['id'],
                    'customer_name' => trim($customer['first_name'].' '.$customer['last_name']),
                    'city' => $customer['city'],
                    'paid_orders_count' => $customer['paid_orders_count'],
                    'return_frequency_days' => $customer['return_frequency_days'],
                    'last_purchase_at' => $customer['last_purchase_at'],
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'overview' => [
                'total_customers' => count($customers),
                'loyalty_card_customers' => collect($customers)->whereNotNull('card_code')->count(),
                'app_ready_customers' => collect($customers)->filter(fn (array $customer) => ($customer['loyalty_devices_count'] ?? 0) > 0)->count(),
                'returning_customers' => $returningCustomers->count(),
                'avg_return_days' => $avgReturnDays,
                'inactive_customers_30d' => $inactiveCustomers,
                'push_sent_7d' => collect($customers)->sum('push_notifications_last_7d'),
            ],
            'city_breakdown' => $cityBreakdown,
            'top_returners' => $topReturners,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'code' => ['nullable', 'string', 'max:50'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'birth_date' => ['nullable', 'date'],
            'marketing_consent' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $id = DB::table('customers')->insertGetId([
            'tenant_id' => $tenantId,
            'code' => $request->input('code'),
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'birth_date' => $request->input('birth_date'),
            'marketing_consent' => (bool) $request->boolean('marketing_consent'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Cliente creato.', 'customer_id' => $id], 201);
    }

    public function update(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->update([
                'first_name' => $request->input('first_name'),
                'last_name' => $request->input('last_name'),
                'email' => $request->input('email'),
                'phone' => $request->input('phone'),
                'marketing_consent' => $request->has('marketing_consent') ? (bool) $request->boolean('marketing_consent') : DB::raw('marketing_consent'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        return response()->json(['message' => 'Cliente aggiornato.']);
    }

    private function customerBaseQuery(int $tenantId, ?int $storeId = null)
    {
        $orderStats = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->whereNotNull('customer_id')
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) as paid_orders_count, MAX(paid_at) as last_purchase_at, MIN(paid_at) as first_purchase_at');

        $deviceStats = DB::table('loyalty_device_tokens')
            ->where('tenant_id', $tenantId)
            ->where('notifications_enabled', true)
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) as loyalty_devices_count, MAX(last_seen_at) as loyalty_last_seen_at');

        $pushStats = DB::table('loyalty_push_notifications')
            ->where('tenant_id', $tenantId)
            ->groupBy('customer_id')
            ->selectRaw("customer_id, MAX(sent_at) as last_push_sent_at, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as push_notifications_last_7d", [now()->subDays(7)]);

        return DB::table('customers as c')
            ->leftJoin('customer_addresses as ca', function ($join) {
                $join->on('ca.customer_id', '=', 'c.id')
                    ->where('ca.is_default', true);
            })
            ->leftJoinSub($orderStats, 'order_stats', function ($join) {
                $join->on('order_stats.customer_id', '=', 'c.id');
            })
            ->leftJoinSub($deviceStats, 'device_stats', function ($join) {
                $join->on('device_stats.customer_id', '=', 'c.id');
            })
            ->leftJoinSub($pushStats, 'push_stats', function ($join) {
                $join->on('push_stats.customer_id', '=', 'c.id');
            })
            ->leftJoin('loyalty_cards as lc', function ($join) use ($tenantId) {
                $join->on('lc.customer_id', '=', 'c.id')
                    ->where('lc.tenant_id', '=', $tenantId);
            })
            ->where('c.tenant_id', $tenantId)
            ->select([
                'c.*',
                'ca.city',
                'order_stats.paid_orders_count',
                'order_stats.last_purchase_at',
                'order_stats.first_purchase_at',
                'lc.card_code',
                'lc.status as loyalty_status',
                'device_stats.loyalty_devices_count',
                'device_stats.loyalty_last_seen_at',
                'push_stats.last_push_sent_at',
                'push_stats.push_notifications_last_7d',
            ]);
    }

    private function hydrateCustomers($customers): array
    {
        return collect($customers)
            ->map(function ($customer) {
                $paidOrdersCount = (int) ($customer->paid_orders_count ?? 0);
                $firstPurchaseAt = $customer->first_purchase_at ? Carbon::parse($customer->first_purchase_at) : null;
                $lastPurchaseAt = $customer->last_purchase_at ? Carbon::parse($customer->last_purchase_at) : null;

                $returnFrequencyDays = null;
                if ($paidOrdersCount > 1 && $firstPurchaseAt && $lastPurchaseAt) {
                    $totalDays = max(1, $firstPurchaseAt->diffInDays($lastPurchaseAt));
                    $returnFrequencyDays = round($totalDays / ($paidOrdersCount - 1), 1);
                }

                return [
                    'id' => (int) $customer->id,
                    'code' => $customer->code,
                    'first_name' => $customer->first_name,
                    'last_name' => $customer->last_name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                    'birth_date' => $customer->birth_date,
                    'marketing_consent' => (bool) $customer->marketing_consent,
                    'city' => $customer->city,
                    'card_code' => $customer->card_code,
                    'loyalty_status' => $customer->loyalty_status,
                    'loyalty_devices_count' => (int) ($customer->loyalty_devices_count ?? 0),
                    'loyalty_last_seen_at' => $customer->loyalty_last_seen_at,
                    'last_push_sent_at' => $customer->last_push_sent_at,
                    'push_notifications_last_7d' => (int) ($customer->push_notifications_last_7d ?? 0),
                    'paid_orders_count' => $paidOrdersCount,
                    'last_purchase_at' => $lastPurchaseAt?->toDateTimeString(),
                    'return_frequency_days' => $returnFrequencyDays,
                    'created_at' => $customer->created_at,
                    'updated_at' => $customer->updated_at,
                ];
            })
            ->all();
    }
}
