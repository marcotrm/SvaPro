<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
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
        $tenantId = (int)$request->attributes->get('tenant_id');
        $storeId = $request->integer('store_id');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        $shifts = Shift::where('tenant_id', $tenantId)
            ->where('store_id', $storeId)
            ->whereBetween('date', [$startDate, $endDate])
            ->get();

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

        $shifts = Shift::with('store:id,name')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('date', '>=', now()->subDays(7)->toDateString())
            ->orderBy('date', 'asc')
            ->get();

        return response()->json(['data' => $shifts]);
    }
}
