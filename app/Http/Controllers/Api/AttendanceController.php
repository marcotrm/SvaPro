<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    public function __construct(private readonly WhatsAppService $whatsapp) {}

    /**
     * GET /attendance?store_id=&date=YYYY-MM-DD
     * Lista timbrature di oggi (o della data specificata).
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $request->filled('store_id') ? (int) $request->integer('store_id') : null;
        $date     = $request->input('date', now()->toDateString());

        $rows = DB::table('employee_attendances as a')
            ->join('employees as e', 'e.id', '=', 'a.employee_id')
            ->leftJoin('stores as s', 's.id', '=', 'a.store_id')
            ->where('a.tenant_id', $tenantId)
            ->when($storeId, fn($q) => $q->where('a.store_id', $storeId))
            ->whereDate('a.checked_in_at', $date)
            ->orderByDesc('a.checked_in_at')
            ->select([
                'a.id',
                'a.employee_id',
                'a.store_id',
                'a.checked_in_at',
                'a.checked_out_at',
                'a.expected_start_time',
                'a.late_minutes',
                'a.notes',
                'e.first_name',
                'e.last_name',
                'e.barcode',
                'e.expected_start_time as employee_expected_start',
                's.name as store_name',
            ])
            ->get()
            ->map(function ($r) {
                $checkIn  = $r->checked_in_at  ? Carbon::parse($r->checked_in_at) : null;
                $checkOut = $r->checked_out_at ? Carbon::parse($r->checked_out_at) : null;
                $duration = ($checkIn && $checkOut)
                    ? $checkIn->diffInMinutes($checkOut)
                    : null;

                return [
                    'id'                   => $r->id,
                    'employee_id'          => $r->employee_id,
                    'employee_name'        => trim("{$r->first_name} {$r->last_name}"),
                    'barcode'              => $r->barcode,
                    'store_id'             => $r->store_id,
                    'store_name'           => $r->store_name,
                    'checked_in_at'        => $r->checked_in_at,
                    'checked_out_at'       => $r->checked_out_at,
                    'expected_start_time'  => $r->expected_start_time ?? $r->employee_expected_start,
                    'late_minutes'         => $r->late_minutes,
                    'duration_minutes'     => $duration,
                    'status'               => $r->checked_out_at ? 'fuori' : 'presente',
                ];
            });

        return response()->json(['data' => $rows]);
    }

    /**
     * GET /attendance/live
     * Chi è attualmente presente (check-in senza check-out oggi).
     */
    public function live(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        $rows = DB::table('employee_attendances as a')
            ->join('employees as e', 'e.id', '=', 'a.employee_id')
            ->leftJoin('stores as s', 's.id', '=', 'a.store_id')
            ->where('a.tenant_id', $tenantId)
            ->when($storeId, fn($q) => $q->where('a.store_id', $storeId))
            ->whereDate('a.checked_in_at', now()->toDateString())
            ->whereNull('a.checked_out_at')
            ->select(['a.*', 'e.first_name', 'e.last_name', 'e.barcode', 's.name as store_name'])
            ->get()
            ->map(fn($r) => [
                'id'           => $r->id,
                'employee_id'  => $r->employee_id,
                'employee_name'=> trim("{$r->first_name} {$r->last_name}"),
                'store_name'   => $r->store_name,
                'checked_in_at'=> $r->checked_in_at,
                'late_minutes' => $r->late_minutes,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * POST /attendance/checkin
     * Registra un'entrata. Cerca l'employee per badge_code o employee_id.
     */
    public function checkIn(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'store_id'    => ['required', 'integer'],
            'employee_id' => ['required_without:badge_code', 'integer', 'nullable'],
            'badge_code'  => ['required_without:employee_id', 'string', 'nullable'],
        ]);

        // Risolvi employee
        $employee = $this->resolveEmployee($tenantId, $request);
        if (!$employee) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        $storeId = (int) $request->integer('store_id');

        // Controlla se già registrato oggi senza check-out
        $existing = DB::table('employee_attendances')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employee->id)
            ->whereDate('checked_in_at', now()->toDateString())
            ->whereNull('checked_out_at')
            ->first();

        if ($existing) {
            return response()->json([
                'message'       => 'Già registrato in entrata.',
                'attendance_id' => $existing->id,
                'employee_name' => trim("{$employee->first_name} {$employee->last_name}"),
                'checked_in_at' => $existing->checked_in_at,
            ], 200);
        }

        $now = now();
        $expectedStart = $employee->expected_start_time; // "09:00"
        $lateMinutes   = null;

        if ($expectedStart) {
            [$h, $m] = explode(':', $expectedStart);
            $expected = $now->copy()->setHour((int)$h)->setMinute((int)$m)->setSecond(0);
            $lateMinutes = max(0, $now->diffInMinutes($expected, false) * -1); // positivo = in ritardo
        }

        $id = DB::table('employee_attendances')->insertGetId([
            'tenant_id'           => $tenantId,
            'store_id'            => $storeId,
            'employee_id'         => $employee->id,
            'checked_in_at'       => $now,
            'expected_start_time' => $expectedStart,
            'late_minutes'        => $lateMinutes > 0 ? $lateMinutes : null,
            'late_notified'       => false,
            'created_at'          => $now,
            'updated_at'          => $now,
        ]);

        $employeeName = trim("{$employee->first_name} {$employee->last_name}");
        $storeName    = DB::table('stores')->where('id', $storeId)->value('name') ?? "Negozio #{$storeId}";

        // Notifica WhatsApp immediata se in ritardo di più di 10 minuti
        if ($lateMinutes && $lateMinutes > 10) {
            $this->notifyLate($tenantId, $employeeName, $storeName, (int) $lateMinutes);
            DB::table('employee_attendances')->where('id', $id)->update(['late_notified' => true]);
        }

        return response()->json([
            'message'        => "Buongiorno, {$employeeName}! Entrata registrata.",
            'attendance_id'  => $id,
            'employee_name'  => $employeeName,
            'checked_in_at'  => $now->toIso8601String(),
            'late_minutes'   => $lateMinutes > 0 ? $lateMinutes : 0,
            'store_name'     => $storeName,
        ]);
    }

    /**
     * POST /attendance/checkout
     */
    public function checkOut(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'store_id'    => ['required', 'integer'],
            'employee_id' => ['required_without:badge_code', 'integer', 'nullable'],
            'badge_code'  => ['required_without:employee_id', 'string', 'nullable'],
        ]);

        $employee = $this->resolveEmployee($tenantId, $request);
        if (!$employee) {
            return response()->json(['message' => 'Dipendente non trovato.'], 404);
        }

        $storeId = (int) $request->integer('store_id');

        $attendance = DB::table('employee_attendances')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employee->id)
            ->where('store_id', $storeId)
            ->whereDate('checked_in_at', now()->toDateString())
            ->whereNull('checked_out_at')
            ->first();

        if (!$attendance) {
            return response()->json(['message' => 'Nessuna entrata registrata oggi per questo negozio.'], 404);
        }

        $now      = now();
        $checkIn  = Carbon::parse($attendance->checked_in_at);
        $duration = $checkIn->diffInMinutes($now);

        DB::table('employee_attendances')
            ->where('id', $attendance->id)
            ->update(['checked_out_at' => $now, 'updated_at' => $now]);

        $employeeName = trim("{$employee->first_name} {$employee->last_name}");
        $hours   = intdiv($duration, 60);
        $minutes = $duration % 60;

        return response()->json([
            'message'         => "Arrivederci, {$employeeName}! Uscita registrata.",
            'employee_name'   => $employeeName,
            'checked_out_at'  => $now->toIso8601String(),
            'duration_minutes'=> $duration,
            'duration_label'  => "{$hours}h {$minutes}m",
        ]);
    }

    /**
     * GET /attendance/employees-for-kiosk?store_id=
     * Ritorna i dipendenti del tenant con lo stato di oggi (dentro/fuori).
     */
    public function employeesForKiosk(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId  = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        $employees = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->select(['id', 'first_name', 'last_name', 'barcode', 'expected_start_time', 'role'])
            ->orderBy('first_name')
            ->get();

        // Timbrature di oggi
        $today = DB::table('employee_attendances')
            ->where('tenant_id', $tenantId)
            ->when($storeId, fn($q) => $q->where('store_id', $storeId))
            ->whereDate('checked_in_at', now()->toDateString())
            ->get()
            ->keyBy('employee_id');

        $result = $employees->map(function ($emp) use ($today) {
            $att = $today->get($emp->id);
            return [
                'id'                   => $emp->id,
                'name'                 => trim("{$emp->first_name} {$emp->last_name}"),
                'first_name'           => $emp->first_name,
                'last_name'            => $emp->last_name,
                'barcode'              => $emp->barcode,
                'expected_start_time'  => $emp->expected_start_time,
                'role'                 => $emp->role,
                'status'               => $att
                    ? ($att->checked_out_at ? 'fuori' : 'presente')
                    : 'assente',
                'checked_in_at'        => $att?->checked_in_at,
                'checked_out_at'       => $att?->checked_out_at,
                'late_minutes'         => $att?->late_minutes,
                'attendance_id'        => $att?->id,
            ];
        });

        return response()->json(['data' => $result, 'server_time' => now()->toIso8601String()]);
    }

    // ─── Helper ──────────────────────────────────────────────────

    private function resolveEmployee(int $tenantId, Request $request): ?\stdClass
    {
        // Prima prova: barcode esplicito
        if ($request->filled('badge_code')) {
            $emp = DB::table('employees')
                ->where('tenant_id', $tenantId)
                ->where('barcode', $request->input('badge_code'))
                ->first();
            if ($emp) return $emp;
        }
        // Seconda prova: employee_id numerico
        if ($request->filled('employee_id')) {
            return DB::table('employees')
                ->where('tenant_id', $tenantId)
                ->where('id', (int) $request->integer('employee_id'))
                ->first();
        }
        return null;
    }

    private function notifyLate(int $tenantId, string $employeeName, string $storeName, int $lateMinutes): void
    {
        // Trova i numeri degli admin del tenant da notificare
        $admins = DB::table('users')
            ->where('tenant_id', $tenantId)
            ->whereIn('role', ['superadmin', 'admin_cliente'])
            ->whereNotNull('phone')
            ->pluck('phone');

        $body = "⏰ *Ritardo dipendente*\n"
              . "📍 Negozio: *{$storeName}*\n"
              . "👤 {$employeeName} è arrivato con *{$lateMinutes} minuti* di ritardo.\n"
              . "🕐 Ora: " . now()->format('H:i');

        foreach ($admins as $phone) {
            $this->whatsapp->send($phone, $body);
        }
    }
}
