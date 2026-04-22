<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StoreDeliveryController extends Controller
{
    // ── Admin: lista consegne per settimana ──────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $date     = $request->query('date'); // YYYY-MM-DD — opzionale

        $q = DB::table('store_deliveries')
            ->where('tenant_id', $tenantId)
            ->orderBy('scheduled_date')
            ->orderByRaw("CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END")
            ->orderBy('id');

        if ($date) {
            // Ritorna ±30 giorni dalla data per coprire la settimana visualizzata
            $q->whereBetween('scheduled_date', [
                date('Y-m-d', strtotime($date . ' -30 days')),
                date('Y-m-d', strtotime($date . ' +30 days')),
            ]);
        }

        return response()->json(['data' => $q->get()]);
    }

    // ── Admin: crea consegna ─────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'store_name'     => ['required', 'string', 'max:120'],
            'scheduled_date' => ['required', 'date'],
            'priority'       => ['nullable', 'in:high,normal,low'],
            'items'          => ['nullable', 'string'],
            'notes'          => ['nullable', 'string'],
            'store_id'       => ['nullable', 'integer'],
        ]);

        $id = DB::table('store_deliveries')->insertGetId([
            'tenant_id'      => $tenantId,
            'store_id'       => $request->input('store_id'),
            'store_name'     => trim($request->input('store_name')),
            'scheduled_date' => $request->input('scheduled_date'),
            'status'         => 'pending',
            'priority'       => $request->input('priority', 'normal'),
            'items'          => $request->input('items'),
            'notes'          => $request->input('notes'),
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $record = DB::table('store_deliveries')->find($id);
        return response()->json(['data' => $record], 201);
    }

    // ── Admin: aggiorna status (drag & drop Kanban) ──────────────────────
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $delivery = DB::table('store_deliveries')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (!$delivery) {
            return response()->json(['message' => 'Consegna non trovata.'], 404);
        }

        $request->validate([
            'status'         => ['required', 'in:pending,in_progress,done,issue'],
            'scheduled_date' => ['nullable', 'date'],
            'priority'       => ['nullable', 'in:high,normal,low'],
            'driver_note'    => ['nullable', 'string'],
        ]);

        $payload = [
            'status'     => $request->input('status'),
            'updated_at' => now(),
        ];

        if ($request->filled('scheduled_date')) {
            $payload['scheduled_date'] = $request->input('scheduled_date');
        }
        if ($request->filled('priority')) {
            $payload['priority'] = $request->input('priority');
        }
        if ($request->has('driver_note')) {
            $payload['driver_note'] = $request->input('driver_note');
        }
        if (in_array($request->input('status'), ['done', 'issue'])) {
            $payload['completed_at'] = now();
        } else {
            $payload['completed_at'] = null;
        }

        DB::table('store_deliveries')
            ->where('id', $id)
            ->update($payload);

        return response()->json(['data' => DB::table('store_deliveries')->find($id)]);
    }

    // ── Admin: elimina consegna ──────────────────────────────────────────
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $deleted = DB::table('store_deliveries')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Consegna non trovata.'], 404);
        }

        return response()->json(['message' => 'Eliminata.']);
    }

    // ── Driver (pubblico): lista consegne per tenant via driver_token ────
    // Il link corriere ha il formato: /deliveries/driver?tk=TENANT_CODE
    public function driverIndex(Request $request): JsonResponse
    {
        $tenantCode = $request->query('tk');
        if (!$tenantCode) {
            return response()->json(['message' => 'Token mancante.'], 401);
        }

        $tenant = DB::table('tenants')
            ->where('code', $tenantCode)
            ->where('status', 'active')
            ->first();

        if (!$tenant) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        $today = now('Europe/Rome')->toDateString();

        $deliveries = DB::table('store_deliveries')
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['pending', 'in_progress'])
            ->whereDate('scheduled_date', $today)   // solo oggi
            ->orderByRaw("CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END")
            ->orderBy('id')
            ->get();

        $completed = DB::table('store_deliveries')
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['done', 'issue'])
            ->whereDate('scheduled_date', $today)
            ->orderByDesc('completed_at')
            ->get();

        return response()->json([
            'data'      => $deliveries,
            'completed' => $completed,
            'tenant'    => ['name' => $tenant->name, 'code' => $tenant->code],
        ]);
    }

    // ── Driver (pubblico): aggiorna status consegna ──────────────────────
    public function driverUpdate(Request $request, int $id): JsonResponse
    {
        $tenantCode = $request->query('tk');
        if (!$tenantCode) {
            return response()->json(['message' => 'Token mancante.'], 401);
        }

        $tenant = DB::table('tenants')
            ->where('code', $tenantCode)
            ->where('status', 'active')
            ->first();

        if (!$tenant) {
            return response()->json(['message' => 'Tenant non trovato.'], 404);
        }

        $delivery = DB::table('store_deliveries')
            ->where('tenant_id', $tenant->id)
            ->where('id', $id)
            ->first();

        if (!$delivery) {
            return response()->json(['message' => 'Consegna non trovata.'], 404);
        }

        $request->validate([
            'status'      => ['required', 'in:pending,in_progress,done,issue'],
            'driver_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $payload = [
            'status'     => $request->input('status'),
            'driver_note'=> $request->input('driver_note', $delivery->driver_note),
            'updated_at' => now(),
        ];

        if (in_array($request->input('status'), ['done', 'issue'])) {
            $payload['completed_at'] = now();
        }

        DB::table('store_deliveries')->where('id', $id)->update($payload);

        return response()->json(['data' => DB::table('store_deliveries')->find($id)]);
    }
}
