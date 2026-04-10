<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\CustomerEmailOtp;
use App\Services\AuditLogger;
use App\Services\CustomerOtpService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $orderStats = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->when($storeId !== null, fn ($q) => $q->where('store_id', $storeId))
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

        $query = DB::table('customers as c')
            ->leftJoinSub($orderStats, 'order_stats', fn ($j) => $j->on('order_stats.customer_id', '=', 'c.id'))
            ->leftJoinSub($deviceStats, 'device_stats', fn ($j) => $j->on('device_stats.customer_id', '=', 'c.id'))
            ->leftJoinSub($pushStats, 'push_stats', fn ($j) => $j->on('push_stats.customer_id', '=', 'c.id'))
            ->leftJoin('loyalty_cards as lc', function ($join) use ($tenantId) {
                $join->on('lc.customer_id', '=', 'c.id')
                    ->where('lc.tenant_id', '=', $tenantId);
            })
            ->where('c.tenant_id', $tenantId)
            // Nota: I clienti appartengono al tenant, non al singolo negozio.
            // Il filtro store_id cambia solo le statistiche ordini mostrate, non nasconde clienti.
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = trim((string) $request->input('q'));
                $query->where(function ($inner) use ($term) {
                    $inner->where('c.first_name', 'like', '%'.$term.'%')
                        ->orWhere('c.last_name', 'like', '%'.$term.'%')
                        ->orWhere('c.company_name', 'like', '%'.$term.'%')
                        ->orWhere('c.email', 'like', '%'.$term.'%')
                        ->orWhere('c.phone', 'like', '%'.$term.'%')
                        ->orWhere('c.code', 'like', '%'.$term.'%')
                        ->orWhere('c.city', 'like', '%'.$term.'%');
                });
            })
            ->when($request->filled('city'), fn ($q) => $q->where('c.city', $request->input('city')))
            ->when($request->filled('customer_type'), fn ($q) => $q->where('c.customer_type', $request->input('customer_type')))
            ->select([
                'c.*',
                'order_stats.paid_orders_count',
                'order_stats.last_purchase_at as last_purchase_at_db',
                'order_stats.first_purchase_at',
                'lc.card_code',
                'lc.status as loyalty_status',
                'device_stats.loyalty_devices_count',
                'device_stats.loyalty_last_seen_at',
                'push_stats.last_push_sent_at',
                'push_stats.push_notifications_last_7d',
            ])
            ->orderByDesc('c.id')
            ->limit((int) $request->input('limit', 100));

        $customers = $query->get();

        return response()->json(['data' => $this->hydrateCustomers($customers)]);
    }

    public function returnFrequencyAnalytics(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $orderStats = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->when($storeId !== null, fn ($q) => $q->where('store_id', $storeId))
            ->whereNotNull('customer_id')
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) as paid_orders_count, MAX(paid_at) as last_purchase_at, MIN(paid_at) as first_purchase_at');

        $customers = $this->hydrateCustomers(
            DB::table('customers as c')
                ->leftJoinSub($orderStats, 'order_stats', fn ($j) => $j->on('order_stats.customer_id', '=', 'c.id'))
                ->leftJoin('loyalty_cards as lc', function ($join) use ($tenantId) {
                    $join->on('lc.customer_id', '=', 'c.id')->where('lc.tenant_id', '=', $tenantId);
                })
                ->where('c.tenant_id', $tenantId)
                ->when($storeId !== null, fn ($q) => $q->whereNotNull('order_stats.customer_id'))
                ->select(['c.*', 'order_stats.paid_orders_count', 'order_stats.last_purchase_at as last_purchase_at_db', 'order_stats.first_purchase_at', 'lc.card_code', 'lc.status as loyalty_status'])
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

    public function show(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $orderStats = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('status', 'paid')
            ->whereNotNull('customer_id')
            ->where('customer_id', $customerId)
            ->groupBy('customer_id')
            ->selectRaw('customer_id, COUNT(*) as paid_orders_count, MAX(paid_at) as last_purchase_at, MIN(paid_at) as first_purchase_at');

        $customer = DB::table('customers as c')
            ->leftJoinSub($orderStats, 'order_stats', fn ($j) => $j->on('order_stats.customer_id', '=', 'c.id'))
            ->leftJoin('loyalty_cards as lc', function ($join) use ($tenantId) {
                $join->on('lc.customer_id', '=', 'c.id')
                    ->where('lc.tenant_id', '=', $tenantId);
            })
            ->where('c.id', $customerId)
            ->where('c.tenant_id', $tenantId)
            ->select([
                'c.*',
                'order_stats.paid_orders_count',
                'order_stats.last_purchase_at as last_purchase_at_db',
                'order_stats.first_purchase_at',
                'lc.card_code',
                'lc.status as loyalty_status',
            ])
            ->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $hydrated = $this->hydrateCustomers(collect([$customer]))[0];
        return response()->json(['data' => $hydrated]);
    }

    public function sendWhatsapp(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $customer = DB::table('customers')->where('id', $customerId)->where('tenant_id', $tenantId)->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $request->validate(['message' => ['required', 'string', 'max:1600']]);

        $phone = $customer->phone;
        if (!$phone) {
            return response()->json(['message' => 'Numero di telefono non disponibile per questo cliente.'], 422);
        }

        try {
            $whatsapp = app(WhatsAppService::class);
            $whatsapp->send($phone, $request->input('message'));
            AuditLogger::log($request, 'send_whatsapp', 'customer', $customerId, $customer->first_name . ' ' . $customer->last_name);
            return response()->json(['message' => 'Messaggio WhatsApp inviato.']);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Errore invio WhatsApp: ' . $e->getMessage()], 500);
        }
    }

    public function sendEmail(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $customer = DB::table('customers')->where('id', $customerId)->where('tenant_id', $tenantId)->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'body'    => ['required', 'string'],
        ]);

        $email = $customer->email;
        if (!$email) {
            return response()->json(['message' => 'Email non disponibile per questo cliente.'], 422);
        }

        try {
            Mail::raw($request->input('body'), function ($msg) use ($email, $request) {
                $msg->to($email)->subject($request->input('subject'));
            });
            AuditLogger::log($request, 'send_email', 'customer', $customerId, $customer->first_name . ' ' . $customer->last_name);
            return response()->json(['message' => 'Email inviata.']);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Errore invio email: ' . $e->getMessage()], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $customerType = $request->input('customer_type', 'privato');

        $rules = [
            'customer_type' => ['nullable', 'in:privato,azienda'],
            'code' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'marketing_consent' => ['nullable', 'boolean'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'province' => ['nullable', 'string', 'max:3'],
            'zip_code' => ['nullable', 'string', 'max:10'],
            'country' => ['nullable', 'string', 'max:2'],
        ];

        if ($customerType === 'azienda') {
            $rules['company_name'] = ['required', 'string', 'max:255'];
            $rules['vat_number'] = ['nullable', 'string', 'max:30'];
            $rules['sdi_code'] = ['nullable', 'string', 'max:10'];
            $rules['pec_email'] = ['nullable', 'email', 'max:255'];
            $rules['contact_person'] = ['nullable', 'string', 'max:200'];
        } else {
            $rules['first_name'] = ['required', 'string', 'max:100'];
            $rules['last_name'] = ['required', 'string', 'max:100'];
            $rules['codice_fiscale'] = ['nullable', 'string', 'max:16'];
            $rules['birth_date'] = ['nullable', 'date'];
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $isAzienda = $customerType === 'azienda';

        $id = DB::table('customers')->insertGetId([
            'tenant_id' => $tenantId,
            'customer_type' => $customerType,
            'code' => $request->input('code') ?: null,
            'first_name' => $isAzienda ? ($request->input('contact_person') ?: '') : $request->input('first_name'),
            'last_name' => $isAzienda ? '' : $request->input('last_name'),
            'company_name' => $isAzienda ? $request->input('company_name') : null,
            'vat_number' => $isAzienda ? $request->input('vat_number') : null,
            'sdi_code' => $isAzienda ? $request->input('sdi_code') : null,
            'pec_email' => $isAzienda ? $request->input('pec_email') : null,
            'contact_person' => $isAzienda ? $request->input('contact_person') : null,
            'codice_fiscale' => ! $isAzienda ? $request->input('codice_fiscale') : null,
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'birth_date' => ! $isAzienda ? $request->input('birth_date') : null,
            'address' => $request->input('address'),
            'city' => $request->input('city'),
            'province' => $request->input('province'),
            'zip_code' => $request->input('zip_code'),
            'country' => $request->input('country', 'IT'),
            'marketing_consent' => (bool) $request->boolean('marketing_consent'),
            'total_orders' => 0,
            'total_spent' => 0,
            'avg_days_between_purchases' => null,
            'uuid' => (string) Str::uuid(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $displayName = $isAzienda
            ? $request->input('company_name')
            : $request->input('first_name').' '.$request->input('last_name');

        AuditLogger::log($request, 'create', 'customer', $id, $displayName);

        return response()->json(['message' => 'Cliente creato.', 'customer_id' => $id], 201);
    }

    public function update(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $old = DB::table('customers')->where('tenant_id', $tenantId)->where('id', $customerId)->first();

        if (! $old) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $customerType = $request->input('customer_type', $old->customer_type ?? 'privato');
        $isAzienda = $customerType === 'azienda';

        $updated = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->update([
                'customer_type' => $customerType,
                'first_name' => $isAzienda ? ($request->input('contact_person') ?: $old->first_name) : ($request->input('first_name') ?? $old->first_name),
                'last_name' => $isAzienda ? '' : ($request->input('last_name') ?? $old->last_name),
                'company_name' => $isAzienda ? $request->input('company_name', $old->company_name) : null,
                'vat_number' => $isAzienda ? $request->input('vat_number', $old->vat_number) : null,
                'sdi_code' => $isAzienda ? $request->input('sdi_code', $old->sdi_code) : null,
                'pec_email' => $isAzienda ? $request->input('pec_email', $old->pec_email) : null,
                'contact_person' => $isAzienda ? $request->input('contact_person', $old->contact_person) : null,
                'codice_fiscale' => ! $isAzienda ? $request->input('codice_fiscale', $old->codice_fiscale) : null,
                'email' => $request->input('email', $old->email),
                'phone' => $request->input('phone', $old->phone),
                'birth_date' => ! $isAzienda ? $request->input('birth_date', $old->birth_date) : null,
                'address' => $request->input('address', $old->address),
                'city' => $request->input('city', $old->city),
                'province' => $request->input('province', $old->province),
                'zip_code' => $request->input('zip_code', $old->zip_code),
                'country' => $request->input('country', $old->country ?? 'IT'),
                'marketing_consent' => $request->has('marketing_consent')
                    ? (bool) $request->boolean('marketing_consent')
                    : (bool) ($old->marketing_consent ?? false),
                'updated_at' => now(),
            ]);

        AuditLogger::log($request, 'update', 'customer', $customerId, ($old->company_name ?? $old->first_name.' '.$old->last_name));

        return response()->json(['message' => 'Cliente aggiornato.']);
    }

    public function sendOtp(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'channel' => ['required', 'in:email,sms'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $service = new CustomerOtpService();
        $result = $service->sendOtp($tenantId, $customerId, (string) $request->input('channel'));

        return response()->json(['message' => $result['message']], $result['success'] ? 200 : 422);
    }

    public function verifyOtp(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'channel' => ['required', 'in:email,sms'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $service = new CustomerOtpService();
        $result = $service->verifyOtp($tenantId, $customerId, (string) $request->input('channel'), (string) $request->input('code'));

        AuditLogger::log($request, 'verify_otp', 'customer', $customerId, $request->input('channel'));

        return response()->json(['message' => $result['message']], $result['success'] ? 200 : 422);
    }

    private function hydrateCustomers($customers): array
    {
        return collect($customers)
            ->map(function ($customer) {
                $paidOrdersCount = (int) ($customer->paid_orders_count ?? 0);
                $firstPurchaseAt = $customer->first_purchase_at ? Carbon::parse($customer->first_purchase_at) : null;
                $lastPurchaseAtRaw = $customer->last_purchase_at_db ?? ($customer->last_purchase_at ?? null);
                $lastPurchaseAt = $lastPurchaseAtRaw ? Carbon::parse($lastPurchaseAtRaw) : null;

                $returnFrequencyDays = null;
                if ($paidOrdersCount > 1 && $firstPurchaseAt && $lastPurchaseAt) {
                    $totalDays = max(1, $firstPurchaseAt->diffInDays($lastPurchaseAt));
                    $returnFrequencyDays = round($totalDays / ($paidOrdersCount - 1), 1);
                }

                $customerType = $customer->customer_type ?? 'privato';

                return [
                    'id' => (int) $customer->id,
                    'customer_type' => $customerType,
                    'code' => $customer->code,
                    // Privato
                    'first_name' => $customer->first_name,
                    'last_name' => $customer->last_name,
                    'codice_fiscale' => $customer->codice_fiscale ?? null,
                    'birth_date' => $customer->birth_date,
                    // Azienda
                    'company_name' => $customer->company_name ?? null,
                    'vat_number' => $customer->vat_number ?? null,
                    'sdi_code' => $customer->sdi_code ?? null,
                    'pec_email' => $customer->pec_email ?? null,
                    'contact_person' => $customer->contact_person ?? null,
                    // Comuni
                    'email' => $customer->email,
                    'email_verified' => (bool) ($customer->email_verified ?? false),
                    'phone' => $customer->phone,
                    'phone_verified' => (bool) ($customer->phone_verified ?? false),
                    'marketing_consent' => (bool) $customer->marketing_consent,
                    // Indirizzo
                    'address' => $customer->address ?? null,
                    'city' => $customer->city ?? null,
                    'province' => $customer->province ?? null,
                    'zip_code' => $customer->zip_code ?? null,
                    'country' => $customer->country ?? 'IT',
                    // Loyalty
                    'card_code' => $customer->card_code,
                    'loyalty_status' => $customer->loyalty_status,
                    'loyalty_devices_count' => (int) ($customer->loyalty_devices_count ?? 0),
                    'loyalty_last_seen_at' => $customer->loyalty_last_seen_at ?? null,
                    'last_push_sent_at' => $customer->last_push_sent_at ?? null,
                    'push_notifications_last_7d' => (int) ($customer->push_notifications_last_7d ?? 0),
                    // Statistiche
                    'paid_orders_count' => $paidOrdersCount,
                    'total_orders' => (int) ($customer->total_orders ?? $paidOrdersCount),
                    'total_spent' => round((float) ($customer->total_spent ?? 0), 2),
                    'avg_days_between_purchases' => $returnFrequencyDays,
                    'last_purchase_at' => $lastPurchaseAt?->toDateTimeString(),
                    'return_frequency_days' => $returnFrequencyDays,
                    'created_at' => $customer->created_at,
                    'updated_at' => $customer->updated_at,
                ];
            })
            ->all();
    }
    /**
     * Invia OTP via email al cliente per verifica.
     */
    public function sendEmailOtp(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $customer = DB::table('customers')->where('id', $customerId)->where('tenant_id', $tenantId)->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $email = $request->input('email') ?: $customer->email;
        if (!$email) {
            return response()->json(['message' => 'Email mancante.'], 422);
        }

        $otp = (string) random_int(100000, 999999);
        Cache::put("email_otp_{$customerId}", $otp, now()->addMinutes(10));

        try {
            Mail::to($email)->send(new CustomerEmailOtp($otp, $customer->first_name . ' ' . $customer->last_name));
            return response()->json(['message' => 'OTP inviato.']);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Errore invio email: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Verifica OTP email del cliente.
     */
    public function verifyEmailOtp(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $customer = DB::table('customers')->where('id', $customerId)->where('tenant_id', $tenantId)->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $submitted = (string) $request->input('otp');
        $stored    = Cache::get("email_otp_{$customerId}");

        if (!$stored || $stored !== $submitted) {
            return response()->json(['message' => 'Codice OTP non valido o scaduto.'], 422);
        }

        Cache::forget("email_otp_{$customerId}");

        DB::table('customers')->where('id', $customerId)->update([
            'email_verified_at' => now(),
            'updated_at'        => now(),
        ]);

        return response()->json(['message' => 'Email verificata con successo.']);
    }

    /**
     * Upload visura camerale PDF per un cliente azienda.
     */
    public function uploadVisura(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $customer = DB::table('customers')->where('id', $customerId)->where('tenant_id', $tenantId)->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato.'], 404);
        }

        $request->validate([
            'visura' => ['required', 'file', 'mimes:pdf', 'max:5120'], // max 5MB
        ]);

        // Elimina visura precedente
        if ($customer->visura_camerale_path) {
            Storage::disk('private')->delete($customer->visura_camerale_path);
        }

        $path = $request->file('visura')->store("visure/tenant_{$tenantId}", 'private');

        DB::table('customers')->where('id', $customerId)->update([
            'visura_camerale_path' => $path,
            'updated_at'           => now(),
        ]);

        return response()->json(['message' => 'Visura caricata.', 'path' => $path]);
    }

    /**
     * Download visura camerale PDF (solo admin).
     */
    public function downloadVisura(Request $request, int $customerId): mixed
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $customer = DB::table('customers')->where('id', $customerId)->where('tenant_id', $tenantId)->first();

        if (!$customer || !$customer->visura_camerale_path) {
            return response()->json(['message' => 'Visura non trovata.'], 404);
        }

        if (!Storage::disk('private')->exists($customer->visura_camerale_path)) {
            return response()->json(['message' => 'File non trovato su disco.'], 404);
        }

        return Storage::disk('private')->download(
            $customer->visura_camerale_path,
            "visura_{$customer->company_name}.pdf"
        );
    }
}
