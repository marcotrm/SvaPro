<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\Shift;
use App\Models\ShiftTemplate;
use Carbon\Carbon;

class ShiftController extends Controller
{
    /**
     * GET /shifts
     * Ritorna i turni per una settimana (store_id, start_date, end_date)
     */
    public function index(Request $request): JsonResponse
    {
        if (!Schema::hasTable('employee_shifts')) {
            return response()->json(['data' => [], '_note' => 'Tabella turni non ancora migrata. Esegui php artisan migrate.']);
        }
        $tenantId  = (int)$request->attributes->get('tenant_id');
        $storeId   = $request->integer('store_id', 0);
        $empId     = $request->integer('employee_id', 0);
        $startDate = $request->input('start_date');
        $endDate   = $request->input('end_date');

        // Colonne base sempre presenti
        $selectCols = [
            'es.id', 'es.tenant_id', 'es.store_id', 'es.employee_id',
            'es.date', 'es.start_time', 'es.end_time', 'es.color',
            'es.created_at', 'es.updated_at',
            'st.name as store_name',
            // Nome dipendente — utile per il PM quando vede turni proposti
            \Illuminate\Support\Facades\DB::raw("CONCAT(COALESCE(emp.first_name,''), ' ', COALESCE(emp.last_name,'')) as employee_name"),
        ];

        // Aggiungi colonne opzionali se esistono (aggiunte da migrazione successiva)
        if (Schema::hasColumn('employee_shifts', 'status')) {
            $selectCols[] = 'es.status';
        }
        if (Schema::hasColumn('employee_shifts', 'proposed_by')) {
            $selectCols[] = 'es.proposed_by';
        }

        $query = DB::table('employee_shifts as es')
            ->leftJoin('stores as st', 'st.id', '=', 'es.store_id')
            ->leftJoin('employees as emp', 'emp.id', '=', 'es.employee_id')
            ->where('es.tenant_id', $tenantId)
            ->select($selectCols);

        // Filtro per negozio (opzionale se usiamo la ricerca globale per dipendente)
        if ($storeId) {
            $query->where('es.store_id', $storeId);
        }

        // Filtro per dipendente (cross-store, nessun filtro su store_id)
        if ($empId) {
            $query->where('es.employee_id', $empId);
        }

        if ($startDate && $endDate) {
            $query->whereBetween('es.date', [$startDate, $endDate]);
        }

        $shifts = $query->orderBy('es.date')->get();

        return response()->json(['data' => $shifts]);
    }

    /**
     * POST /shifts/bulk
     * Salva o aggiorna una serie di turni.
     */
    public function bulkSave(Request $request): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        $storeId = $request->integer('store_id');
        $shiftsData = $request->input('shifts', []); // [{ employee_id, date, start_time, end_time, color }]
        $deletions = $request->input('deletions', []); // [{ employee_id, date }] -- per cancellare turni rimossi

        DB::beginTransaction();
        try {
            // Elimina i turni rimossi dalla griglia
            foreach ($deletions as $del) {
                Shift::where('tenant_id', $tenantId)
                    ->where('store_id', $storeId)
                    ->where('employee_id', $del['employee_id'])
                    ->where('date', $del['date'])
                    ->delete();
            }

            // Inserisci o aggiorna i turni
            foreach ($shiftsData as $s) {
                Shift::updateOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'store_id' => $storeId,
                        'employee_id' => $s['employee_id'],
                        'date' => $s['date'],
                    ],
                    [
                        'start_time' => $s['start_time'] ?? null,
                        'end_time' => $s['end_time'] ?? null,
                        'color' => $s['color'] ?? null,
                        'status' => $s['status'] ?? 'confirmed',
                    ]
                );
            }

            DB::commit();
            return response()->json(['message' => 'Turni salvati con successo.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Errore nel salvataggio.', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /shifts/templates
     */
    public function getTemplates(Request $request): JsonResponse
    {
        if (!Schema::hasTable('shift_templates')) {
            return response()->json(['data' => []]);
        }
        $tenantId = (int)$request->attributes->get('tenant_id');
        $templates = ShiftTemplate::where('tenant_id', $tenantId)->get();
        return response()->json(['data' => $templates]);
    }

    /**
     * POST /shifts/templates
     */
    public function saveTemplate(Request $request): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $template = ShiftTemplate::create([
            'tenant_id' => $tenantId,
            'name' => $request->input('name'),
            'start_time' => $request->input('start_time'),
            'end_time' => $request->input('end_time'),
            'color' => $request->input('color'),
        ]);

        return response()->json(['message' => 'Template salvato.', 'data' => $template]);
    }

    /**
     * DELETE /shifts/templates/{id}
     */
    public function deleteTemplate(Request $request, $id): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        ShiftTemplate::where('tenant_id', $tenantId)->where('id', $id)->delete();
        return response()->json(['message' => 'Template eliminato.']);
    }


    /**
     * GET /employee/my-shifts
     * Ritorna i turni (futuri e passati recenti) del dipendente loggato.
     */
    public function myShifts(Request $request): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        // Identificare employee (dal token API in futuro, per ora mock via employee_id)
        $employeeId = $request->input('employee_id');

        $selectCols2 = [
            'es.id', 'es.tenant_id', 'es.store_id', 'es.employee_id',
            'es.date', 'es.start_time', 'es.end_time', 'es.color',
            'es.created_at', 'es.updated_at',
            'st.name as store_name',
        ];
        if (Schema::hasColumn('employee_shifts', 'status'))      $selectCols2[] = 'es.status';
        if (Schema::hasColumn('employee_shifts', 'proposed_by')) $selectCols2[] = 'es.proposed_by';

        $shifts = DB::table('employee_shifts as es')
            ->leftJoin('stores as st', 'st.id', '=', 'es.store_id')
            ->where('es.tenant_id', $tenantId)
            ->where('es.employee_id', $employeeId)
            ->where('es.date', '>=', now()->subDays(7)->toDateString())
            ->select($selectCols2)
            ->orderBy('es.date', 'asc')
            ->get();

        return response()->json(['data' => $shifts]);
    }

    /**
     * POST /shifts/propose
     * Dipendente propone un turno — salvato con status='proposed'
     */
    public function propose(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'employee_id' => 'required|integer',
            'store_id'    => 'required|integer',
            'date'        => 'required|date',
            'start_time'  => 'nullable|string',
            'end_time'    => 'nullable|string',
        ]);

        $shift = Shift::updateOrCreate(
            [
                'tenant_id'   => $tenantId,
                'store_id'    => $request->integer('store_id'),
                'employee_id' => $request->integer('employee_id'),
                'date'        => $request->input('date'),
            ],
            [
                'start_time'  => $request->input('start_time'),
                'end_time'    => $request->input('end_time'),
                'color'       => $request->input('color', '#F59E0B'),
                'status'      => 'proposed',
                'proposed_by' => $request->integer('employee_id'),
            ]
        );

        return response()->json(['message' => 'Turno proposto con successo.', 'data' => $shift]);
    }

    /**
     * POST /shifts/{id}/confirm
     * Manager conferma un singolo turno proposed → confirmed
     */
    public function confirmShift(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = Shift::where('tenant_id', $tenantId)->where('id', $id)->update([
            'status'     => 'confirmed',
            'updated_at' => now(),
        ]);

        if (!$updated) {
            return response()->json(['message' => 'Turno non trovato.'], 404);
        }

        return response()->json(['message' => 'Turno confermato.']);
    }

    /**
     * POST /shifts/confirm-all
     * Manager conferma tutti i turni proposed di uno store/settimana
     */
    public function confirmAll(Request $request): JsonResponse
    {
        $tenantId  = (int) $request->attributes->get('tenant_id');
        $storeId   = $request->integer('store_id');
        $startDate = $request->input('start_date');
        $endDate   = $request->input('end_date');

        $query = Shift::where('tenant_id', $tenantId)->where('status', 'proposed');
        if ($storeId)   $query->where('store_id', $storeId);
        if ($startDate) $query->where('date', '>=', $startDate);
        if ($endDate)   $query->where('date', '<=', $endDate);

        $count = $query->update(['status' => 'confirmed', 'updated_at' => now()]);

        return response()->json(['message' => "{$count} turni confermati.", 'confirmed' => $count]);
    }

    // ══════════════════════════════════════════════════════════════════════
    // LOCK / CONFIRM WEEK — workflow Store Manager → Project Manager
    // ══════════════════════════════════════════════════════════════════════

    /**
     * POST /shifts/lock-week
     * Dipendente (Store Manager) blocca i turni di una settimana per uno store.
     */
    public function lockWeek(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $request->validate([
            'store_id'   => 'required|integer',
            'week_start' => 'required|date',
        ]);

        // Crea la tabella al volo se non esiste (safety net per deploy)
        if (!Schema::hasTable('shift_week_locks')) {
            Schema::create('shift_week_locks', function ($table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('store_id');
                $table->date('week_start');
                $table->unsignedBigInteger('locked_by')->nullable();
                $table->timestamp('locked_at')->nullable();
                $table->unsignedBigInteger('confirmed_by')->nullable();
                $table->timestamp('confirmed_at')->nullable();
                $table->timestamps();
                $table->unique(['tenant_id', 'store_id', 'week_start'], 'swl_unique');
            });
        }

        try {
            DB::table('shift_week_locks')->updateOrInsert(
                [
                    'tenant_id'  => $tenantId,
                    'store_id'   => $request->integer('store_id'),
                    'week_start' => $request->input('week_start'),
                ],
                [
                    'locked_by'    => $request->user()?->id ?? $request->integer('user_id', 0),
                    'locked_at'    => now(),
                    'confirmed_by' => null,
                    'confirmed_at' => null,
                    'updated_at'   => now(),
                ]
            );
        } catch (\Exception $e) {
            return response()->json(['message' => 'Errore nel blocco turni.', 'error' => $e->getMessage()], 500);
        }

        // Crea notifica per project_manager
        try {
            $storeName = DB::table('stores')->where('id', $request->integer('store_id'))->value('name') ?? 'Store';
            $weekLabel = Carbon::parse($request->input('week_start'))->format('d/m/Y');
            
            // Trova tutti gli utenti con ruolo project_manager nel tenant (supporta sia JSON array che stringa)
            $pmUsers = DB::table('users')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) {
                    $q->where('roles', 'like', '%project_manager%')
                      ->orWhere('roles', 'like', '%"project_manager"%');
                })
                ->pluck('id');

            if (Schema::hasTable('employee_notifications')) {
                foreach ($pmUsers as $pmId) {
                    DB::table('employee_notifications')->insert([
                        'tenant_id'  => $tenantId,
                        'user_id'    => $pmId,
                        'type'       => 'shift_locked',
                        'title'      => "🔒 Turni bloccati — {$storeName}",
                        'body'       => "I turni della settimana {$weekLabel} sono stati bloccati e sono in attesa di conferma.",
                        'is_read'    => false,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        } catch (\Exception $e) {
            // Non bloccare l'operazione per un errore di notifica
            \Log::warning('Shift lock notification error: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Turni bloccati con successo.']);
    }

    /**
     * POST /shifts/unlock-week
     * Store Manager o superadmin sblocca i turni.
     */
    public function unlockWeek(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $request->validate([
            'store_id'   => 'required|integer',
            'week_start' => 'required|date',
        ]);

        if (!Schema::hasTable('shift_week_locks')) {
            return response()->json(['message' => 'Nessun blocco trovato.']);
        }

        DB::table('shift_week_locks')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $request->integer('store_id'))
            ->where('week_start', $request->input('week_start'))
            ->delete();

        $weekEndDate = \Carbon\Carbon::parse($request->input('week_start'))->addDays(6)->format('Y-m-d');
        DB::table('employee_shifts')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $request->integer('store_id'))
            ->whereBetween('date', [$request->input('week_start'), $weekEndDate])
            ->where('status', 'confirmed')
            ->update(['status' => 'proposed']);

        return response()->json(['message' => 'Turni sbloccati.']);
    }

    /**
     * GET /shifts/week-locks
     * Ritorna lo stato di lock/conferma per tutti gli store di una settimana.
     */
    public function getWeekLocks(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        if (!Schema::hasTable('shift_week_locks')) {
            return response()->json(['data' => []]);
        }

        $weekStart = $request->input('week_start');

        $query = DB::table('shift_week_locks as swl')
            ->leftJoin('stores as st', 'st.id', '=', 'swl.store_id')
            ->leftJoin('users as u_lock', 'u_lock.id', '=', 'swl.locked_by')
            ->leftJoin('users as u_conf', 'u_conf.id', '=', 'swl.confirmed_by')
            ->where('swl.tenant_id', $tenantId)
            ->select(
                'swl.*',
                'st.name as store_name',
                'u_lock.name as locked_by_name',
                'u_conf.name as confirmed_by_name'
            );

        if ($weekStart) {
            $query->where('swl.week_start', $weekStart);
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * POST /shifts/confirm-week
     * Project Manager conferma i turni bloccati di uno store.
     */
    public function confirmWeek(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $request->validate([
            'store_id'   => 'required|integer',
            'week_start' => 'required|date',
        ]);

        if (!Schema::hasTable('shift_week_locks')) {
            return response()->json(['message' => 'Tabella lock non trovata.'], 404);
        }

        $updated = DB::table('shift_week_locks')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $request->integer('store_id'))
            ->where('week_start', $request->input('week_start'))
            ->whereNotNull('locked_at')
            ->update([
                'confirmed_by' => $request->user()?->id ?? $request->integer('user_id', 0),
                'confirmed_at' => now(),
                'updated_at'   => now(),
            ]);

        if (!$updated) {
            return response()->json(['message' => 'Nessun blocco trovato da confermare.'], 404);
        }

        // Segna tutti i turni di quella settimana come confermati
        $weekEndDate = Carbon::parse($request->input('week_start'))->addDays(6)->format('Y-m-d');
        DB::table('employee_shifts')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $request->integer('store_id'))
            ->whereBetween('date', [$request->input('week_start'), $weekEndDate])
            ->update(['status' => 'confirmed']);

        // Notifica allo store manager che ha bloccato
        $lock = DB::table('shift_week_locks')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $request->integer('store_id'))
            ->where('week_start', $request->input('week_start'))
            ->first();

        if ($lock && $lock->locked_by && Schema::hasTable('employee_notifications')) {
            $storeName = DB::table('stores')->where('id', $request->integer('store_id'))->value('name') ?? 'Store';
            $weekLabel = Carbon::parse($request->input('week_start'))->format('d/m/Y');
            
            DB::table('employee_notifications')->insert([
                'tenant_id'  => $tenantId,
                'user_id'    => $lock->locked_by,
                'type'       => 'shift_confirmed',
                'title'      => "✅ Turni confermati — {$storeName}",
                'body'       => "I turni della settimana {$weekLabel} sono stati confermati dal Project Manager.",
                'is_read'    => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Turni confermati con successo.']);
    }
}
