<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $rows = DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = trim((string) $request->input('q'));
                $query->where(function ($inner) use ($term) {
                    $inner->where('name', 'like', '%' . $term . '%')
                        ->orWhere('email', 'like', '%' . $term . '%')
                        ->orWhere('vat_number', 'like', '%' . $term . '%');
                });
            })
            ->orderBy('name')
            ->limit((int) $request->input('limit', 100))
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, int $supplierId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $supplier = DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->first();

        if (! $supplier) {
            return response()->json(['message' => 'Fornitore non trovato.'], 404);
        }

        // Prodotti associati al fornitore
        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('default_supplier_id', $supplierId)
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'product_type']);

        // Ultimi ordini di acquisto
        $purchaseOrders = DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('supplier_id', $supplierId)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        $supplier->products = $products;
        $supplier->purchase_orders = $purchaseOrders;

        return response()->json(['data' => $supplier]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), $this->rules());

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $now = now();

        $supplierId = DB::table('suppliers')->insertGetId([
            'tenant_id'         => $tenantId,
            'name'              => (string) $request->input('name'),
            'code'              => $request->input('code'),
            'vat_number'        => $request->input('vat_number'),
            'email'             => $request->input('email'),
            'phone'             => $request->input('phone'),
            'address'           => $request->input('address'),
            'city'              => $request->input('city'),
            'province'          => $request->input('province'),
            'zip'               => $request->input('zip'),
            'notes'             => $request->input('notes'),
            // Campi logistici per riordino automatico
            'lead_time_giorni'  => $request->input('lead_time_giorni') !== null ? (int) $request->input('lead_time_giorni') : null,
            'moq'               => $request->input('moq') !== null ? (int) $request->input('moq') : null,
            'lot_size'          => $request->input('lot_size') !== null ? (int) $request->input('lot_size') : null,
            'created_at'        => $now,
            'updated_at'        => $now,
        ]);

        AuditLogger::log($request, 'create', 'supplier', $supplierId, $request->input('name'));

        return response()->json([
            'message' => 'Fornitore creato.',
            'supplier_id' => $supplierId,
        ], 201);
    }

    public function update(Request $request, int $supplierId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $exists = DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'Fornitore non trovato.'], 404);
        }

        $validator = Validator::make($request->all(), $this->rules());

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->update([
                'name'             => (string) $request->input('name'),
                'code'             => $request->input('code'),
                'vat_number'       => $request->input('vat_number'),
                'email'            => $request->input('email'),
                'phone'            => $request->input('phone'),
                'address'          => $request->input('address'),
                'city'             => $request->input('city'),
                'province'         => $request->input('province'),
                'zip'              => $request->input('zip'),
                'notes'            => $request->input('notes'),
                // Campi logistici
                'lead_time_giorni' => $request->input('lead_time_giorni') !== null ? (int) $request->input('lead_time_giorni') : null,
                'moq'              => $request->input('moq') !== null ? (int) $request->input('moq') : null,
                'lot_size'         => $request->input('lot_size') !== null ? (int) $request->input('lot_size') : null,
                'updated_at'       => now(),
            ]);

        AuditLogger::log($request, 'update', 'supplier', $supplierId, $request->input('name'));

        return response()->json(['message' => 'Fornitore aggiornato.']);
    }

    public function destroy(Request $request, int $supplierId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $supplier = DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->first();

        if (! $supplier) {
            return response()->json(['message' => 'Fornitore non trovato.'], 404);
        }

        // Verifica che non abbia PO attivi
        $activePo = DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('supplier_id', $supplierId)
            ->whereIn('status', ['draft', 'sent', 'partial'])
            ->exists();

        if ($activePo) {
            return response()->json([
                'message' => 'Impossibile eliminare: il fornitore ha ordini di acquisto attivi.',
            ], 422);
        }

        DB::table('suppliers')
            ->where('tenant_id', $tenantId)
            ->where('id', $supplierId)
            ->delete();

        AuditLogger::log($request, 'delete', 'supplier', $supplierId, $supplier->name);

        return response()->json(['message' => 'Fornitore eliminato.']);
    }

    private function rules(): array
    {
        return [
            'name'             => ['required', 'string', 'max:255'],
            'code'             => ['nullable', 'string', 'max:100'],
            'vat_number'       => ['nullable', 'string', 'max:50'],
            'email'            => ['nullable', 'email', 'max:255'],
            'phone'            => ['nullable', 'string', 'max:50'],
            'address'          => ['nullable', 'string', 'max:255'],
            'city'             => ['nullable', 'string', 'max:100'],
            'province'         => ['nullable', 'string', 'max:10'],
            'zip'              => ['nullable', 'string', 'max:20'],
            'notes'            => ['nullable', 'string'],
            // Campi logistici riordino
            'lead_time_giorni' => ['nullable', 'integer', 'min:1', 'max:365'],
            'moq'              => ['nullable', 'integer', 'min:1'],
            'lot_size'         => ['nullable', 'integer', 'min:1'],
        ];
    }
}
