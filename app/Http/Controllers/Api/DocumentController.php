<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DocumentController extends Controller
{
    public function generate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'entity_type' => ['required', 'string', 'in:order,purchase_order,stock_adjustment,pos_session'],
            'entity_id' => ['required', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $tenantId = (int) $request->attributes->get('tenant_id');
        $entityType = (string) $request->input('entity_type');
        $entityId = (int) $request->input('entity_id');

        $service = new DocumentService();
        $pdfContent = $service->generateForEntity($tenantId, $entityType, $entityId);

        if (! $pdfContent) {
            return response()->json(['message' => 'Entita non trovata o tipo non supportato.'], 404);
        }

        $filename = $entityType . '_' . $entityId . '.pdf';

        return response($pdfContent, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
