<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class StoreController extends Controller
{
    // ─── Lista negozi per tenant ────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('is_main')
            ->orderBy('name')
            ->get()   // select * — resiliente a colonne opzionali non ancora migrate
            ->map(function ($s) use ($tenantId) {
                $formatted = $this->formatStore($s);
                try {
                    $formatted['revenue_18'] = $this->calculateRevenue18WeeklyAvg($tenantId, $s->id);
                } catch (\Throwable $e) {
                    $formatted['revenue_18'] = 0.0;
                }
                return $formatted;
            });


        return response()->json(['data' => $stores]);
    }

    // ─── Singolo negozio con presenze live ──────────────────────────
    public function show(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->where('id', $storeId)
            ->first();

        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        // Presenze live di oggi
        $liveAttendance = DB::table('employee_attendances as a')
            ->join('employees as e', 'e.id', '=', 'a.employee_id')
            ->where('a.tenant_id', $tenantId)
            ->where('a.store_id', $storeId)
            ->whereDate('a.checked_in_at', now()->toDateString())
            ->whereNull('a.checked_out_at')
            ->select(['e.first_name', 'e.last_name', 'a.checked_in_at', 'a.late_minutes'])
            ->get()
            ->map(fn($r) => [
                'name'          => trim("{$r->first_name} {$r->last_name}"),
                'checked_in_at' => $r->checked_in_at,
                'late_minutes'  => $r->late_minutes,
            ]);

        $formattedStore = $this->formatStore($store);
        $formattedStore['revenue_18'] = $this->calculateRevenue18WeeklyAvg($tenantId, $storeId);

        return response()->json([
            'data' => array_merge(
                (array) $formattedStore,
                ['live_attendance' => $liveAttendance]
            ),
        ]);
    }

    // ─── Crea negozio ───────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'name'                   => ['required', 'string', 'max:120'],
            'code'                   => ['required', 'string', 'max:20'],
            'address'                => ['nullable', 'string', 'max:255'],
            'city'                   => ['nullable', 'string', 'max:100'],
            'zip_code'               => ['nullable', 'string', 'max:10'],
            'country'                => ['nullable', 'string', 'max:10'],
            'phone'                  => ['nullable', 'string', 'max:30'],
            'email'                  => ['nullable', 'email', 'max:150'],
            'timezone'               => ['nullable', 'string', 'max:50'],
            'is_main'                => ['nullable', 'boolean'],
            'opening_hours'          => ['nullable', 'array'],
            'default_start_time'     => ['nullable', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'late_tolerance_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'numero_esercizio'       => ['nullable', 'string', 'max:20'],
            'numero_ordinale'        => ['nullable', 'string', 'max:20'],
            'parent_store_id'        => ['nullable', 'integer'],
            'company_group'          => ['nullable', 'string', 'max:100'],
        ]);

        // Codice univoco per tenant
        if (DB::table('stores')->where('tenant_id', $tenantId)->where('code', $request->input('code'))->exists()) {
            return response()->json(['errors' => ['code' => ['Codice negozio già in uso.']]], 422);
        }

        $now = now();
        $id = DB::table('stores')->insertGetId([
            'tenant_id'              => $tenantId,
            'code'                   => strtoupper(trim($request->input('code'))),
            'name'                   => trim($request->input('name')),
            'address'                => $request->input('address'),
            'city'                   => $request->input('city'),
            'zip_code'               => $request->input('zip_code'),
            'country'                => $request->input('country', 'IT'),
            'phone'                  => $request->input('phone'),
            'email'                  => $request->input('email'),
            'timezone'               => $request->input('timezone', 'Europe/Rome'),
            'is_main'                => (bool) $request->boolean('is_main', false),
            'opening_hours'          => $request->has('opening_hours')
                ? json_encode($request->input('opening_hours'))
                : null,
            'default_start_time'     => $request->input('default_start_time'),
            'late_tolerance_minutes' => (int) $request->input('late_tolerance_minutes', 10),
            'numero_esercizio'       => $request->input('numero_esercizio'),
            'numero_ordinale'        => $request->input('numero_ordinale'),
            'parent_store_id'        => $request->filled('parent_store_id') ? (int) $request->input('parent_store_id') : null,
            'company_group'          => $request->input('company_group'),
            'auto_reorder_enabled'   => true,
            'created_at'             => $now,
            'updated_at'             => $now,
        ]);

        // Crea magazzino default per il nuovo negozio
        $warehouseExists = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('name', 'LIKE', '%' . trim($request->input('name')) . '%')
            ->exists();

        if (!$warehouseExists) {
            DB::table('warehouses')->insert([
                'tenant_id'  => $tenantId,
                'name'       => 'Magazzino ' . trim($request->input('name')),
                'type'       => 'store',
                'store_id'   => $id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        AuditLogger::log($request, 'create', 'store', $id, $request->input('name'));

        return response()->json(['message' => 'Negozio creato.', 'store_id' => $id], 201);
    }

    // ─── Aggiorna negozio ───────────────────────────────────────────
    public function update(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->first();
        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        $request->validate([
            'name'                   => ['sometimes', 'string', 'max:120'],
            'code'                   => ['sometimes', 'string', 'max:20'],
            'address'                => ['nullable', 'string', 'max:255'],
            'city'                   => ['nullable', 'string', 'max:100'],
            'zip_code'               => ['nullable', 'string', 'max:10'],
            'phone'                  => ['nullable', 'string', 'max:30'],
            'email'                  => ['nullable', 'email', 'max:150'],
            'timezone'               => ['nullable', 'string', 'max:50'],
            'is_main'                => ['nullable', 'boolean'],
            'opening_hours'          => ['nullable', 'array'],
            'default_start_time'     => ['nullable', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'late_tolerance_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'numero_esercizio'       => ['nullable', 'string', 'max:20'],
            'numero_ordinale'        => ['nullable', 'string', 'max:20'],
            'parent_store_id'        => ['nullable', 'integer'],
            'company_group'          => ['nullable', 'string', 'max:100'],
            'whatsapp_notify_phone'  => ['nullable', 'string', 'max:30'],
        ]);

        $payload = array_filter([
            'name'                   => $request->input('name'),
            'code'                   => $request->filled('code')
                ? strtoupper(trim($request->input('code'))) : null,
            'address'                => $request->input('address'),
            'city'                   => $request->input('city'),
            'zip_code'               => $request->input('zip_code'),
            'phone'                  => $request->input('phone'),
            'email'                  => $request->input('email'),
            'timezone'               => $request->input('timezone'),
            'default_start_time'     => $request->input('default_start_time'),
            'late_tolerance_minutes' => $request->filled('late_tolerance_minutes')
                ? (int) $request->input('late_tolerance_minutes') : null,
            'numero_esercizio'       => $request->input('numero_esercizio'),
            'numero_ordinale'        => $request->input('numero_ordinale'),
            'company_group'          => $request->input('company_group'),
            'whatsapp_notify_phone'  => $request->has('whatsapp_notify_phone')
                ? ($request->input('whatsapp_notify_phone') ?: null) : null,
        ], fn($v) => $v !== null);

        // Gestisci esplicitamente whatsapp_notify_phone = '' (svuota il campo)
        if ($request->has('whatsapp_notify_phone') && $request->input('whatsapp_notify_phone') === '') {
            $payload['whatsapp_notify_phone'] = null;
        }

        // parent_store_id: gestisce esplicitamente null (rimuovi relazione)
        if ($request->has('parent_store_id')) {
            $payload['parent_store_id'] = $request->filled('parent_store_id')
                ? (int) $request->input('parent_store_id') : null;
        }

        if ($request->has('is_main')) {
            $payload['is_main'] = (bool) $request->boolean('is_main');
        }
        if ($request->has('opening_hours')) {
            $payload['opening_hours'] = json_encode($request->input('opening_hours'));
        }
        $payload['updated_at'] = now();

        DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->update($payload);

        AuditLogger::log($request, 'update', 'store', $storeId, $request->input('name', $store->name));

        return response()->json(['message' => 'Negozio aggiornato.']);
    }

    // ─── Elimina negozio ────────────────────────────────────────────
    public function destroy(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->first();
        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        if ($store->is_main) {
            return response()->json(['message' => 'Non puoi eliminare il negozio principale.'], 422);
        }

        DB::table('stores')->where('id', $storeId)->delete();

        AuditLogger::log($request, 'delete', 'store', $storeId, $store->name);

        return response()->json(['message' => 'Negozio eliminato.']);
    }

    // ─── Crea Credenziali Negozio ──────────────────────────────────────
    public function createCredentials(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $store = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->first();
        
        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        $request->validate([
            'email'    => ['required', 'email'],
            // Password opzionale se si vogliono aggiornare solo le credenziali senza cambiarla
            'password' => ['nullable', 'string', 'min:6'],
        ]);

        $email    = strtolower(trim($request->input('email')));
        $password = $request->input('password'); // null se non fornita

        $existingUser = DB::table('users')->where('email', $email)->first();

        if ($existingUser) {
            // Aggiorna password solo se fornita
            if ($password) {
                DB::table('users')->where('id', $existingUser->id)->update([
                    'password'   => \Illuminate\Support\Facades\Hash::make($password),
                    'updated_at' => now(),
                ]);
            }

            // Assicuriamoci che esista come dipendente nel negozio corrente
            $employeeExists = DB::table('employees')
                ->where('user_id', $existingUser->id)
                ->where('store_id', $storeId)
                ->exists();

            if (!$employeeExists) {
                // Cerca un employee DIP- da riutilizzare invece di creare uno nuovo
                $dipEmployee = DB::table('employees')
                    ->where('store_id', $storeId)
                    ->where('tenant_id', $tenantId)
                    ->where('barcode', 'like', 'DIP-%')
                    ->whereNull('user_id')
                    ->first();

                if ($dipEmployee) {
                    DB::table('employees')->where('id', $dipEmployee->id)->update([
                        'user_id'    => $existingUser->id,
                        'first_name' => preg_replace('/\s+/', ' ', trim(explode('@', $email)[0])),
                        'updated_at' => now(),
                    ]);
                } else {
                    DB::table('employees')->insert([
                        'tenant_id'  => $tenantId,
                        'store_id'   => $storeId,
                        'user_id'    => $existingUser->id,
                        'first_name' => preg_replace('/\s+/', ' ', trim(explode('@', $email)[0])),
                        'last_name'  => '',
                        'barcode'    => 'DIP-' . $store->code . '-' . rand(1000, 9999),
                        'status'     => 'active',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            AuditLogger::log($request, 'update_credentials', 'store', $storeId, "Credenziali aggiornate per: $email");

            // Salva password in chiaro nei settings del negozio (recovery superadmin)
            if ($password) {
                try {
                    $settings = json_decode($store->settings_json ?? '{}', true) ?? [];
                    $settings['store_access_password'] = $password;
                    DB::table('stores')->where('id', $storeId)->update([
                        'settings_json' => json_encode($settings),
                        'updated_at' => now(),
                    ]);
                } catch (\Throwable $e) {
                    \Log::warning('settings_json non disponibile, skip password save: ' . $e->getMessage());
                }
            }

            return response()->json([
                'message' => 'Credenziali aggiornate con successo!',
                'email'   => $email,
            ]);
        }

        // ─ Nuovo utente ────────────────────────────────────
        if (!$password) {
            return response()->json(['message' => 'La password è obbligatoria per un nuovo utente.'], 422);
        }

        $userId = DB::table('users')->insertGetId([
            'name'       => explode('@', $email)[0],
            'email'      => $email,
            'password'   => \Illuminate\Support\Facades\Hash::make($password),
            'tenant_id'  => $tenantId,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $roleId = DB::table('roles')->where('code', 'dipendente')->value('id');
        if ($roleId) {
            DB::table('user_roles')->insert([
                'user_id'   => $userId,
                'role_id'   => $roleId,
                'tenant_id' => $tenantId,
            ]);
        }

        // Cerca un employee DIP- esistente da riutilizzare invece di crearne uno nuovo
        // Questo evita l'accumulo di employee quando si cambiano le credenziali più volte
        $existingDipEmployee = DB::table('employees')
            ->where('store_id', $storeId)
            ->where('tenant_id', $tenantId)
            ->where('barcode', 'like', 'DIP-%')
            ->orderBy('id', 'desc')
            ->first();

        if ($existingDipEmployee) {
            // Riutilizza il DIP- esistente puntandolo al nuovo user
            DB::table('employees')->where('id', $existingDipEmployee->id)->update([
                'user_id'    => $userId,
                'first_name' => explode('@', $email)[0],
                'updated_at' => now(),
            ]);
        } else {
            DB::table('employees')->insert([
                'tenant_id'  => $tenantId,
                'store_id'   => $storeId,
                'user_id'    => $userId,
                'first_name' => explode('@', $email)[0],
                'last_name'  => '',
                'barcode'    => 'DIP-' . $store->code . '-' . rand(1000, 9999),
                'status'     => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        AuditLogger::log($request, 'create_credentials', 'store', $storeId, "Credenziali create: $email");

        // Salva password in chiaro nei settings del negozio (recovery superadmin)
        try {
            $settings = json_decode($store->settings_json ?? '{}', true) ?? [];
            $settings['store_access_password'] = $password;
            DB::table('stores')->where('id', $storeId)->update([
                'settings_json' => json_encode($settings),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            \Log::warning('settings_json non disponibile, skip password save: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Credenziali generate con successo!',
            'email'   => $email,
        ]);
    }

    /**
     * GET /stores/{id}/credentials
     * Restituisce l'email dell'utente associato al negozio (senza password).
     */
    public function getCredentials(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $store = DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->first();

        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        // Cerca prima il dipendente con barcode DIP- (creato dal sistema credenziali)
        // Ordine DESC per prendere il più recente in caso di più record
        $employee = DB::table('employees')
            ->where('store_id', $storeId)
            ->where('tenant_id', $tenantId)
            ->where('barcode', 'like', 'DIP-%')
            ->whereNotNull('user_id')
            ->orderBy('id', 'desc')
            ->first();

        // Fallback: qualsiasi dipendente con user_id (es. dati demo)
        if (!$employee) {
            $employee = DB::table('employees')
                ->where('store_id', $storeId)
                ->where('tenant_id', $tenantId)
                ->whereNotNull('user_id')
                ->orderBy('id', 'desc')
                ->first();
        }

        if (!$employee || !$employee->user_id) {
            return response()->json(['email' => null, 'has_credentials' => false]);
        }

        $user = DB::table('users')->where('id', $employee->user_id)->first();

        if (!$user) {
            return response()->json(['email' => null, 'has_credentials' => false]);
        }

        return response()->json([
            'email'           => $user->email,
            'has_credentials' => true,
            'user_id'         => $user->id,
            'store_password'  => (function() use ($store) {
                try { return json_decode($store->settings_json ?? '{}', true)['store_access_password'] ?? null; }
                catch (\Throwable $e) { return null; }
            })(),
        ]);
    }

    /**
     * POST /stores/{storeId}/notify-managers
     * Invia una notifica a tutti gli admin/manager del tenant
     * (usato dai dipendenti per notificare turni proposti)
     */
    public function notifyManagers(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $title = $request->input('title', '🔔 Nuova notifica');
        $body  = $request->input('body', '');
        $type  = $request->input('type', 'info');

        // Trova tutti gli utenti admin/admin_cliente del tenant
        $adminUserIds = DB::table('user_roles as ur')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->join('users as u', 'u.id', '=', 'ur.user_id')
            ->where('u.tenant_id', $tenantId)
            ->whereIn('r.code', ['superadmin', 'admin_cliente', 'admin', 'shift_manager', 'project_manager'])
            ->where('u.status', 'active')
            ->pluck('ur.user_id')
            ->unique();

        $now = now();
        $inserted = 0;
        foreach ($adminUserIds as $userId) {
            // Trova l'employee_id dell'admin (se esiste)
            $empId = DB::table('employees')
                ->where('tenant_id', $tenantId)
                ->where('user_id', $userId)
                ->value('id');

            DB::table('employee_notifications')->insert([
                'tenant_id'      => $tenantId,
                'employee_id'    => $empId,
                'user_id'        => $userId,
                'type'           => $type,
                'title'          => $title,
                'body'           => $body,
                'is_read'        => 0,
                'created_at'     => $now,
                'updated_at'     => $now,
            ]);
            $inserted++;
        }

        return response()->json(['message' => "Notifica inviata a {$inserted} manager.", 'sent' => $inserted]);
    }

    /**
     * POST /stores/{storeId}/test-whatsapp
     * Invia un messaggio WhatsApp di test al numero configurato sullo store.
     */
    public function testWhatsapp(Request $request, int $storeId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $store = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->where('id', $storeId)
            ->first();

        if (!$store) {
            return response()->json(['message' => 'Negozio non trovato.'], 404);
        }

        // Accetta il numero direttamente dal body (utile per testare prima di salvare)
        $phone = $request->input('phone') ?: ($store->whatsapp_notify_phone ?? null);
        if (!$phone) {
            return response()->json(['message' => 'Nessun numero WhatsApp configurato per questo negozio.'], 422);
        }

        // Controlla prima che Twilio sia configurato
        $sid   = config('services.twilio.sid');
        $token = config('services.twilio.token');
        $from  = config('services.twilio.whatsapp_from', 'whatsapp:+14155238886');

        if (empty($sid) || empty($token)) {
            return response()->json([
                'message' => '⚠️ Twilio non configurato. Aggiungi TWILIO_SID e TWILIO_TOKEN nelle variabili d\'ambiente di Railway.',
            ], 503);
        }

        // Normalizza numero: deve iniziare con +
        $phoneClean = preg_replace('/\s+/', '', $phone);
        if (!str_starts_with($phoneClean, '+')) {
            $phoneClean = '+' . ltrim($phoneClean, '0');
        }

        $body = "✅ *Test notifica SvaPro*\n"
              . "📍 Negozio: *{$store->name}*\n"
              . "🕐 " . now()->setTimezone('Europe/Rome')->format('d/m/Y H:i') . "\n\n"
              . "Le notifiche di ritardo dipendente sono attive su questo numero.";

        // Chiama Twilio direttamente per ottenere l'errore dettagliato
        $url  = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
        $data = http_build_query([
            'From' => $from,
            'To'   => 'whatsapp:' . $phoneClean,
            'Body' => $body,
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $data,
            CURLOPT_USERPWD        => "{$sid}:{$token}",
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $response  = curl_exec($ch);
        $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return response()->json(['message' => "❌ Errore di rete: {$curlError}"], 500);
        }

        $decoded = json_decode($response, true);

        if ($httpCode >= 200 && $httpCode < 300) {
            return response()->json(['message' => "✅ Messaggio inviato a {$phoneClean} (SID: " . ($decoded['sid'] ?? '?') . ")"]);
        }

        // Twilio ha risposto con errore — mostriamo il messaggio esatto
        $twilioMsg  = $decoded['message'] ?? 'Errore sconosciuto';
        $twilioCode = $decoded['code']    ?? $httpCode;

        $hints = [
            21608 => 'Il numero non è verificato nel sandbox Twilio. Il destinatario deve prima inviare "join [parola]" al numero sandbox +14155238886.',
            21211 => 'Numero non valido. Usa il formato internazionale: +39XXXXXXXXXX',
            20003 => 'Credenziali errate: TWILIO_SID o TWILIO_TOKEN non validi.',
            63007 => 'Canale WhatsApp non abilitato. Verifica le impostazioni nel tuo account Twilio.',
        ];
        $hint = $hints[$twilioCode] ?? null;

        $msg = "❌ Twilio errore {$twilioCode}: {$twilioMsg}";
        if ($hint) $msg .= "\n💡 {$hint}";

        return response()->json(['message' => $msg], 422);
    }

    // ─── Helpers ────────────────────────────────────────────────────
    private function formatStore(\stdClass $s): array
    {
        $oh = $s->opening_hours ? json_decode($s->opening_hours, true) : null;

        // Calcola se il negozio è aperto adesso
        $isOpenNow = false;
        if ($oh) {
            $tz  = $s->timezone ?? 'Europe/Rome';
            $now = Carbon::now($tz);
            $day = strtolower($now->format('D')); // mon, tue, ...
            $todayHours = $oh[$day] ?? null;
            if ($todayHours && !($todayHours['closed'] ?? false)) {
                try {
                    $openStr = $todayHours['open'] ?? '00:00';
                    $closeStr = $todayHours['close'] ?? '23:59';
                    // Fallback se passano stringhe vuote
                    if (empty(trim($openStr))) $openStr = '00:00';
                    if (empty(trim($closeStr))) $closeStr = '23:59';
                    
                    $openTime  = Carbon::parse($openStr, $tz);
                    $closeTime = Carbon::parse($closeStr, $tz);
                    $isOpenNow = $now->between($openTime, $closeTime);
                } catch (\Throwable $e) {
                    $isOpenNow = false;
                }
            }
        }

        return [
            'id'                     => $s->id,
            'code'                   => $s->code,
            'name'                   => $s->name,
            'address'                => $s->address,
            'city'                   => $s->city,
            'zip_code'               => $s->zip_code ?? null,
            'country'                => $s->country ?? 'IT',
            'phone'                  => $s->phone ?? null,
            'email'                  => $s->email ?? null,
            'timezone'               => $s->timezone ?? 'Europe/Rome',
            'is_main'                => (bool) ($s->is_main ?? false),
            'opening_hours'          => $oh,
            'default_start_time'     => $s->default_start_time ?? null,
            'late_tolerance_minutes' => (int) ($s->late_tolerance_minutes ?? 10),
            'is_open_now'            => $isOpenNow,
            'auto_reorder_enabled'   => (bool) ($s->auto_reorder_enabled ?? true),
            'numero_esercizio'       => $s->numero_esercizio ?? null,
            'numero_ordinale'        => $s->numero_ordinale ?? null,
            'parent_store_id'        => $s->parent_store_id ?? null,
            'company_group'          => $s->company_group ?? null,
            'whatsapp_notify_phone'  => $s->whatsapp_notify_phone ?? null,
        ];
    }

    /**
     * Calcola la media settimanale del fatturato entro le ore 18.
     * Per ogni giorno dalla settimana corrente (lun → oggi), somma gli ordini
     * con created_at <= {giorno} 18:00:00, poi divide per i giorni.
     */
    private function calculateRevenue18WeeklyAvg(int $tenantId, int $storeId): float
    {
        $tz          = 'Europe/Rome';
        $now         = Carbon::now($tz);
        $startOfWeek = $now->copy()->startOfWeek(Carbon::MONDAY)->startOfDay();
        $today       = $now->copy()->startOfDay();

        // Costruisce array di date: lunedì → oggi
        $dates  = [];
        $cursor = $startOfWeek->copy();
        while ($cursor->lte($today)) {
            $dates[] = $cursor->toDateString();
            $cursor->addDay();
        }

        if (empty($dates)) {
            return 0.0;
        }

        $totalRevenue = 0.0;
        foreach ($dates as $date) {
            $cutoff = Carbon::createFromFormat('Y-m-d H:i:s', $date . ' 18:00:00', $tz)
                ->setTimezone('UTC'); // confronto corretto con DB

            $daily = (float) DB::table('sales_orders')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $storeId)
                ->whereDate('created_at', $date)
                ->where('created_at', '<=', $cutoff)
                ->whereIn('status', ['paid', 'completed'])
                ->sum('grand_total');

            $totalRevenue += $daily;
        }

        return round($totalRevenue / count($dates), 2);
    }

    // ─── Superadmin methods (unchanged) ─────────────────────────────
    public function tenants(Request $request): JsonResponse
    {
        $user = $request->user();

        $roleCodes = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->pluck('roles.code')
            ->all();

        $isSuperAdmin = in_array('superadmin', $roleCodes, true);

        $query = DB::table('tenants')
            ->orderBy('name')
            ->select(['id', 'code', 'name', 'status']);

        if (! $isSuperAdmin) {
            $query->where('id', (int) $user->tenant_id);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function tenantHealth(Request $request): JsonResponse
    {
        $user = $request->user();

        $isSuperAdmin = DB::table('user_roles')
            ->join('roles', 'roles.id', '=', 'user_roles.role_id')
            ->where('user_roles.user_id', $user->id)
            ->where('roles.code', 'superadmin')
            ->exists();

        if (! $isSuperAdmin) {
            return response()->json(['message' => 'Permessi insufficienti.'], 403);
        }

        $tenants = DB::table('tenants')->orderBy('name')->get(['id', 'code', 'name', 'status']);
        $result  = [];

        foreach ($tenants as $tenant) {
            $tid        = (int) $tenant->id;
            $storeCount = DB::table('stores')->where('tenant_id', $tid)->count();
            $orderStats = DB::table('sales_orders')
                ->where('tenant_id', $tid)
                ->selectRaw("COUNT(*) as total_orders, COALESCE(SUM(grand_total),0) as total_revenue, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_orders")
                ->first();

            $result[] = [
                'tenant_id'      => $tid,
                'code'           => $tenant->code,
                'name'           => $tenant->name,
                'status'         => $tenant->status,
                'stores'         => $storeCount,
                'admins'         => DB::table('users as u')->join('user_roles as ur', 'ur.user_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'ur.role_id')->where('u.tenant_id', $tid)->where('r.code', 'admin_cliente')->where('u.status', 'active')->count(),
                'products'       => DB::table('products')->where('tenant_id', $tid)->count(),
                'customers'      => DB::table('customers')->where('tenant_id', $tid)->count(),
                'employees'      => DB::table('employees')->where('tenant_id', $tid)->count(),
                'total_orders'   => (int) ($orderStats->total_orders ?? 0),
                'paid_orders'    => (int) ($orderStats->paid_orders ?? 0),
                'total_revenue'  => round((float) ($orderStats->total_revenue ?? 0), 2),
                'low_stock_items'=> 0,
            ];
        }

        return response()->json(['data' => $result]);
    }

    public function tenantSettings(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $tenant   = DB::table('tenants')->where('id', $tenantId)->first();

        if (!$tenant) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        return response()->json(['data' => [
            'id'           => $tenant->id,
            'name'         => $tenant->name,
            'code'         => $tenant->code,
            'vat_number'   => $tenant->vat_number,
            'timezone'     => $tenant->timezone,
            'status'       => $tenant->status,
            'settings_json'=> $tenant->settings_json ? json_decode($tenant->settings_json, true) : null,
        ]]);
    }

    public function updateTenantSettings(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        // Costruisce solo i campi effettivamente inviati (evita di sovrascrivere con NULL)
        $update = ['updated_at' => now()];

        if ($request->has('name'))          $update['name']          = $request->input('name');
        if ($request->has('vat_number'))    $update['vat_number']    = $request->input('vat_number');
        if ($request->has('timezone'))      $update['timezone']      = $request->input('timezone');
        if ($request->has('settings_json')) {
            // Merge con settings_json esistenti per non perdere altre chiavi
            $existing = DB::table('tenants')->where('id', $tenantId)->value('settings_json');
            $existing = json_decode($existing ?? '{}', true) ?: [];
            $new      = $request->input('settings_json');
            $merged   = array_merge($existing, is_array($new) ? $new : []);
            // Deep merge per gamification_rules
            if (isset($new['gamification_rules']) && isset($existing['gamification_rules'])) {
                $merged['gamification_rules'] = array_merge($existing['gamification_rules'], $new['gamification_rules']);
            }
            $update['settings_json'] = json_encode($merged);
        }

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();
        if (!$tenant) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        DB::table('tenants')->where('id', $tenantId)->update($update);

        AuditLogger::log($request, 'update', 'tenant', $tenantId, $tenant->name);

        return response()->json(['message' => 'Impostazioni tenant aggiornate.']);
    }
}
