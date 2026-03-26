<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SmartReorderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmartInventoryController extends Controller
{
    public function __construct(private readonly SmartReorderService $service)
    {
    }

    public function preview(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json($this->service->previewForTenant($tenantId));
    }

    public function run(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json($this->service->runForTenant($tenantId));
    }

    public function runAutoToCentral(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json($this->service->runAutoToCentralForTenant($tenantId));
    }

    public function exportCsv(Request $request)
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $csv = $this->service->exportCsv($tenantId);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="smart_reorder_' . now()->format('Y-m-d') . '.csv"',
        ]);
    }

    public function exportPdf(Request $request)
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $pdf = $this->service->exportPdf($tenantId);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="smart_reorder_' . now()->format('Y-m-d') . '.pdf"',
        ]);
    }

    public function emailSupplier(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'supplier_id' => ['required', 'integer'],
        ]);

        $preview = $this->service->previewForTenant($tenantId);
        $supplierId = (int) $request->input('supplier_id');

        $supplierAlerts = collect($preview['alerts'])
            ->filter(fn (array $a) => ($a['supplier_id'] ?? 0) === $supplierId)
            ->values()
            ->all();

        if (empty($supplierAlerts)) {
            return response()->json(['message' => 'Nessun articolo da riordinare per questo fornitore.'], 422);
        }

        $sent = $this->service->emailSupplier($tenantId, $supplierId, $supplierAlerts);

        return $sent
            ? response()->json(['message' => 'Email inviata al fornitore.'])
            : response()->json(['message' => 'Impossibile inviare l\'email. Verificare l\'email del fornitore.'], 422);
    }
}
