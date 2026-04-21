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

        $query = DB::table('employee_shifts as es')
            ->leftJoin('stores as st', 'st.id', '=', 'es.store_id')
            ->where('es.tenant_id', $tenantId)
            ->select(
                'es.id', 'es.tenant_id', 'es.store_id', 'es.employee_id',
                'es.date', 'es.start_time', 'es.end_time', 'es.color',
                'es.status', 'es.proposed_by',
                'es.created_at', 'es.updated_at',
                'st.name as store_name'
            );

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
     * POST /shifts/propose
     * Dipendente propone un turno.
     */
    public function propose(Request $request): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        
        $shift = Shift::updateOrCreate(
            [
                'tenant_id' => $tenantId,
                'store_id' => $request->integer('store_id'),
                'employee_id' => $request->integer('employee_id'),
                'date' => $request->input('date'),
            ],
            [
                'start_time' => $request->input('start_time'),
                'end_time' => $request->input('end_time'),
                'color' => $request->input('color'),
                'status' => 'proposed',
                'proposed_by' => $request->integer('employee_id'),
            ]
        );

        return response()->json(['message' => 'Turno proposto, in attesa di conferma.', 'data' => $shift]);
    }

    /**
     * PATCH /shifts/{id}/confirm
     * Conferma singolo turno.
     */
    public function confirmShift(Request $request, $id): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        Shift::where('tenant_id', $tenantId)->where('id', $id)->update(['status' => 'confirmed']);
        return response()->json(['message' => 'Turno confermato.']);
    }

    /**
     * POST /shifts/confirm-all
     * Conferma tutti i turni 'proposed' del periodo/negozio.
     */
    public function confirmAll(Request $request): JsonResponse
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        $storeId = $request->integer('store_id');
        $start = $request->input('start_date');
        $end = $request->input('end_date');

        Shift::where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->where('status', 'proposed')
            ->whereBetween('date', [$start, $end])
            ->update(['status' => 'confirmed']);

        return response()->json(['message' => 'Tutti i turni proposti sono stati confermati.']);
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

        $shifts = DB::table('employee_shifts as es')
            ->leftJoin('stores as st', 'st.id', '=', 'es.store_id')
            ->where('es.tenant_id', $tenantId)
            ->where('es.employee_id', $employeeId)
            ->where('es.date', '>=', now()->subDays(7)->toDateString())
            ->select(
                'es.id', 'es.tenant_id', 'es.store_id', 'es.employee_id',
                'es.date', 'es.start_time', 'es.end_time', 'es.color',
                'es.status', 'es.proposed_by',
                'es.created_at', 'es.updated_at',
                'st.name as store_name'
            )
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
}
