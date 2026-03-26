<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SupplierInvoiceController extends Controller
{
    /**
     * Lista fatture fornitore con filtri
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $query = DB::table('supplier_invoices as si')
            ->leftJoin('suppliers as s', 's.id', '=', 'si.supplier_id')
            ->where('si.tenant_id', $tenantId)
            ->select([
                'si.*',
                's.name as supplier_name',
                's.vat_number as supplier_vat',
            ])
            ->orderByDesc('si.issued_at');

        if ($request->filled('supplier_id')) {
            $query->where('si.supplier_id', (int) $request->integer('supplier_id'));
        }

        if ($request->filled('document_type')) {
            $query->where('si.document_type', $request->input('document_type'));
        }

        if ($request->filled('sezionale')) {
            $query->where('si.sezionale', $request->input('sezionale'));
        }

        if ($request->filled('is_paid')) {
            $query->where('si.is_paid', filter_var($request->input('is_paid'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('si.issued_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('si.issued_at', '<=', $request->input('date_to'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('si.invoice_number', 'like', $search)
                    ->orWhere('s.name', 'like', $search);
            });
        }

        $limit = min((int) ($request->input('limit', 100)), 1000);

        return response()->json(['data' => $query->limit($limit)->get()]);
    }

    /**
     * Dettaglio fattura fornitore con righe
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $invoice = DB::table('supplier_invoices as si')
            ->leftJoin('suppliers as s', 's.id', '=', 'si.supplier_id')
            ->where('si.tenant_id', $tenantId)
            ->where('si.id', $id)
            ->select(['si.*', 's.name as supplier_name', 's.vat_number as supplier_vat', 's.email as supplier_email'])
            ->first();

        if (! $invoice) {
            return response()->json(['message' => 'Fattura fornitore non trovata.'], 404);
        }

        $lines = DB::table('supplier_invoice_lines as sil')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'sil.product_variant_id')
            ->leftJoin('products as p', 'p.id', '=', 'pv.product_id')
            ->where('sil.supplier_invoice_id', $id)
            ->select([
                'sil.*',
                'p.name as product_name',
                'p.sku as product_sku',
            ])
            ->get();

        return response()->json([
            'data' => $invoice,
            'lines' => $lines,
        ]);
    }

    /**
     * Registra nuova fattura fornitore
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'supplier_id' => ['required', 'integer'],
            'purchase_order_id' => ['nullable', 'integer'],
            'invoice_number' => ['required', 'string', 'max:50'],
            'document_type' => ['nullable', 'string', 'in:TD01,TD02,TD04,TD05,TD06,TD16,TD17,TD18,TD19,TD20,TD21,TD24,TD25,TD26,TD27'],
            'causale' => ['nullable', 'string', 'max:80'],
            'sezionale' => ['nullable', 'string', 'max:10'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'tax_total' => ['nullable', 'numeric', 'min:0'],
            'grand_total' => ['required', 'numeric', 'min:0'],
            'issued_at' => ['required', 'date'],
            'received_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['nullable', 'array'],
            'lines.*.product_variant_id' => ['nullable', 'integer'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.qty' => ['required_with:lines', 'integer', 'min:1'],
            'lines.*.unit_price' => ['required_with:lines', 'numeric', 'min:0'],
            'lines.*.tax_amount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.line_total' => ['required_with:lines', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (! DB::table('suppliers')->where('tenant_id', $tenantId)->where('id', $request->integer('supplier_id'))->exists()) {
            return response()->json(['message' => 'Fornitore non valido.'], 422);
        }

        $now = now();

        $invoiceId = DB::table('supplier_invoices')->insertGetId([
            'tenant_id' => $tenantId,
            'supplier_id' => $request->integer('supplier_id'),
            'purchase_order_id' => $request->input('purchase_order_id'),
            'invoice_number' => $request->input('invoice_number'),
            'document_type' => $request->input('document_type', 'TD01'),
            'causale' => $request->input('causale', 'Fattura Fornitore'),
            'sezionale' => $request->input('sezionale', 'FPS'),
            'payment_method' => $request->input('payment_method'),
            'is_paid' => false,
            'subtotal' => $request->input('subtotal'),
            'tax_total' => $request->input('tax_total', 0),
            'grand_total' => $request->input('grand_total'),
            'currency' => 'EUR',
            'issued_at' => $request->input('issued_at'),
            'received_at' => $request->input('received_at', $now),
            'notes' => $request->input('notes'),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($request->filled('lines')) {
            foreach ($request->input('lines') as $line) {
                DB::table('supplier_invoice_lines')->insert([
                    'supplier_invoice_id' => $invoiceId,
                    'product_variant_id' => $line['product_variant_id'] ?? null,
                    'description' => $line['description'] ?? null,
                    'qty' => $line['qty'],
                    'unit_price' => $line['unit_price'],
                    'tax_amount' => $line['tax_amount'] ?? 0,
                    'line_total' => $line['line_total'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        AuditLogger::log($request, 'create', 'supplier_invoice', $invoiceId, $request->input('invoice_number'));

        return response()->json(['message' => 'Fattura fornitore registrata.', 'supplier_invoice_id' => $invoiceId], 201);
    }

    /**
     * Aggiorna fattura fornitore
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $exists = DB::table('supplier_invoices')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'Fattura fornitore non trovata.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'invoice_number' => ['nullable', 'string', 'max:50'],
            'document_type' => ['nullable', 'string', 'max:10'],
            'causale' => ['nullable', 'string', 'max:80'],
            'sezionale' => ['nullable', 'string', 'max:10'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'subtotal' => ['nullable', 'numeric', 'min:0'],
            'tax_total' => ['nullable', 'numeric', 'min:0'],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
            'issued_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $fields = array_filter($request->only([
            'invoice_number', 'document_type', 'causale', 'sezionale',
            'payment_method', 'subtotal', 'tax_total', 'grand_total',
            'issued_at', 'notes',
        ]), fn ($v) => $v !== null);

        $fields['updated_at'] = now();

        DB::table('supplier_invoices')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->update($fields);

        AuditLogger::log($request, 'update', 'supplier_invoice', $id);

        return response()->json(['message' => 'Fattura fornitore aggiornata.']);
    }

    /**
     * Segna fattura come pagata
     */
    public function markPaid(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('supplier_invoices')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->where('is_paid', false)
            ->update([
                'is_paid' => true,
                'paid_at' => now(),
                'payment_method' => $request->input('payment_method', 'bonifico'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Fattura non trovata o già pagata.'], 404);
        }

        AuditLogger::log($request, 'mark_paid', 'supplier_invoice', $id);

        return response()->json(['message' => 'Fattura segnata come pagata.']);
    }

    /**
     * Elimina fattura fornitore
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $invoice = DB::table('supplier_invoices')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (! $invoice) {
            return response()->json(['message' => 'Fattura fornitore non trovata.'], 404);
        }

        if ($invoice->is_paid) {
            return response()->json(['message' => 'Non è possibile eliminare una fattura già pagata.'], 422);
        }

        DB::table('supplier_invoice_lines')->where('supplier_invoice_id', $id)->delete();
        DB::table('supplier_invoices')->where('id', $id)->delete();

        AuditLogger::log($request, 'delete', 'supplier_invoice', $id, $invoice->invoice_number);

        return response()->json(['message' => 'Fattura fornitore eliminata.']);
    }
}
