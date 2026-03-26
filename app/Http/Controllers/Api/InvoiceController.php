<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class InvoiceController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate([
            'order_id' => 'required|integer|exists:sales_orders,id',
        ]);

        $tenantId = $request->attributes->get('tenant_id');
        $order = DB::table('sales_orders')
            ->where('id', $request->input('order_id'))
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Ordine non trovato'], 404);
        }

        // Check if invoice already exists
        $existing = DB::table('invoices')
            ->where('sales_order_id', $order->id)
            ->where('tenant_id', $tenantId)
            ->first();

        if ($existing) {
            return response()->json(['data' => $existing]);
        }

        // Generate progressive invoice number
        $year = now()->year;
        $lastNumber = DB::table('invoices')
            ->where('tenant_id', $tenantId)
            ->whereYear('issued_at', $year)
            ->max('progressive');

        $progressive = ($lastNumber ?? 0) + 1;
        $invoiceNumber = sprintf('FT-%d-%05d', $year, $progressive);

        // Get tenant info
        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        // Get customer
        $customer = $order->customer_id
            ? DB::table('customers')->where('id', $order->customer_id)->first()
            : null;

        // Get order lines
        $lines = DB::table('sales_order_lines')
            ->join('product_variants', 'sales_order_lines.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('sales_order_lines.sales_order_id', $order->id)
            ->select(
                'products.name as product_name',
                'product_variants.sku',
                'sales_order_lines.qty',
                'sales_order_lines.unit_price',
                'sales_order_lines.discount_amount',
                'sales_order_lines.tax_amount',
                'sales_order_lines.excise_amount',
                'sales_order_lines.line_total'
            )
            ->get();

        $documentType = $request->input('document_type', 'TD01');
        $causale = $request->input('causale', 'Fattura Vendita');
        $sezionale = $request->input('sezionale', 'FPS');

        // Determina sezionale automatico basato su tipo documento
        if ($documentType === 'TD27') {
            $sezionale = 'A27';
            $causale = $causale ?: 'Autofatturazione';
        } elseif ($documentType === 'TD24') {
            $sezionale = 'FDI';
            $causale = $causale ?: 'Fattura Differita';
        }

        $invoiceId = DB::table('invoices')->insertGetId([
            'tenant_id'       => $tenantId,
            'sales_order_id'  => $order->id,
            'invoice_number'  => $invoiceNumber,
            'document_type'   => $documentType,
            'causale'         => $causale,
            'sezionale'       => $sezionale,
            'progressive'     => $progressive,
            'customer_id'     => $order->customer_id,
            'warehouse_id'    => $order->store_id ? DB::table('warehouses')->where('store_id', $order->store_id)->value('id') : null,
            'subtotal'        => $order->subtotal,
            'discount_total'  => $order->discount_total,
            'tax_total'       => $order->tax_total,
            'excise_total'    => $order->excise_total,
            'grand_total'     => $order->grand_total,
            'currency'        => $order->currency,
            'payment_method'  => $request->input('payment_method') ?? ($order->paid_at ? 'contanti' : null),
            'is_paid'         => (bool) $order->paid_at,
            'paid_at'         => $order->paid_at,
            'issued_at'       => now(),
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $invoice = DB::table('invoices')->where('id', $invoiceId)->first();

        AuditLogger::log($request, 'invoice_generated', 'invoice', $invoiceId, $invoiceNumber);

        return response()->json(['data' => $invoice], 201);
    }

    public function download(Request $request, $id)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $invoice = DB::table('invoices')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$invoice) {
            return response()->json(['message' => 'Fattura non trovata'], 404);
        }

        $order = DB::table('sales_orders')
            ->where('id', $invoice->sales_order_id)
            ->first();

        $customer = $invoice->customer_id
            ? DB::table('customers')
                ->leftJoin('customer_addresses', function ($join) {
                    $join->on('customers.id', '=', 'customer_addresses.customer_id')
                         ->where('customer_addresses.is_default', true);
                })
                ->where('customers.id', $invoice->customer_id)
                ->select('customers.*', 'customer_addresses.line1', 'customer_addresses.city', 'customer_addresses.zip', 'customer_addresses.country')
                ->first()
            : null;

        $lines = DB::table('sales_order_lines')
            ->join('product_variants', 'sales_order_lines.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('sales_order_lines.sales_order_id', $invoice->sales_order_id)
            ->select(
                'products.name as product_name',
                'product_variants.sku',
                'sales_order_lines.qty',
                'sales_order_lines.unit_price',
                'sales_order_lines.discount_amount',
                'sales_order_lines.tax_amount',
                'sales_order_lines.excise_amount',
                'sales_order_lines.line_total'
            )
            ->get();

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        $data = [
            'invoice'  => $invoice,
            'order'    => $order,
            'customer' => $customer,
            'lines'    => $lines,
            'tenant'   => $tenant,
        ];

        $pdf = Pdf::loadView('invoices.template', $data);
        $pdf->setPaper('A4');

        DB::table('invoices')->where('id', $id)->update(['pdf_generated_at' => now(), 'updated_at' => now()]);

        return $pdf->download($invoice->invoice_number . '.pdf');
    }

    public function index(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');

        $query = DB::table('invoices')
            ->leftJoin('customers', 'invoices.customer_id', '=', 'customers.id')
            ->leftJoin('warehouses', 'invoices.warehouse_id', '=', 'warehouses.id')
            ->where('invoices.tenant_id', $tenantId)
            ->select(
                'invoices.*',
                'customers.first_name',
                'customers.last_name',
                'customers.email as customer_email',
                'warehouses.name as warehouse_name'
            )
            ->orderByDesc('invoices.issued_at');

        if ($request->filled('document_type')) {
            $query->where('invoices.document_type', $request->input('document_type'));
        }

        if ($request->filled('sezionale')) {
            $query->where('invoices.sezionale', $request->input('sezionale'));
        }

        if ($request->filled('is_paid')) {
            $query->where('invoices.is_paid', filter_var($request->input('is_paid'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('causale')) {
            $query->where('invoices.causale', 'like', '%' . $request->input('causale') . '%');
        }

        if ($request->filled('date_from')) {
            $query->whereDate('invoices.issued_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('invoices.issued_at', '<=', $request->input('date_to'));
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }

    public function sendEmail(Request $request, int $id)
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $invoice = DB::table('invoices')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (! $invoice) {
            return response()->json(['message' => 'Fattura non trovata.'], 404);
        }

        // Determina destinatario
        $email = $request->input('email');

        if (! $email && $invoice->customer_id) {
            $customer = DB::table('customers')->where('id', $invoice->customer_id)->first();
            $email = $customer?->email;
        }

        if (! $email) {
            return response()->json(['message' => 'Nessun indirizzo email disponibile per il cliente.'], 422);
        }

        // Genera PDF
        $order = DB::table('sales_orders')
            ->where('id', $invoice->sales_order_id)
            ->first();

        $customer = $invoice->customer_id
            ? DB::table('customers')
                ->leftJoin('customer_addresses', function ($join) {
                    $join->on('customers.id', '=', 'customer_addresses.customer_id')
                         ->where('customer_addresses.is_default', true);
                })
                ->where('customers.id', $invoice->customer_id)
                ->select('customers.*', 'customer_addresses.line1', 'customer_addresses.city', 'customer_addresses.zip', 'customer_addresses.country')
                ->first()
            : null;

        $lines = DB::table('sales_order_lines')
            ->join('product_variants', 'sales_order_lines.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->where('sales_order_lines.sales_order_id', $invoice->sales_order_id)
            ->select(
                'products.name as product_name',
                'product_variants.sku',
                'sales_order_lines.qty',
                'sales_order_lines.unit_price',
                'sales_order_lines.discount_amount',
                'sales_order_lines.tax_amount',
                'sales_order_lines.excise_amount',
                'sales_order_lines.line_total'
            )
            ->get();

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        $pdf = Pdf::loadView('invoices.template', [
            'invoice'  => $invoice,
            'order'    => $order,
            'customer' => $customer,
            'lines'    => $lines,
            'tenant'   => $tenant,
        ]);
        $pdf->setPaper('A4');
        $pdfContent = $pdf->output();

        try {
            Mail::raw(
                "In allegato la fattura {$invoice->invoice_number}.\n\nGrazie per il tuo acquisto.",
                function ($message) use ($email, $invoice, $pdfContent) {
                    $message->to($email)
                        ->subject('Fattura ' . $invoice->invoice_number . ' - SvaPro')
                        ->attachData($pdfContent, $invoice->invoice_number . '.pdf', [
                            'mime' => 'application/pdf',
                        ]);
                }
            );
        } catch (\Throwable $e) {
            Log::error('Invoice email failed', [
                'invoice_id' => $id,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Errore nell\'invio dell\'email. Riprova.'], 500);
        }

        AuditLogger::log($request, 'email_sent', 'invoice', $id, $invoice->invoice_number . ' → ' . $email);

        DB::table('invoices')->where('id', $id)->update(['email_sent_at' => now(), 'updated_at' => now()]);

        return response()->json(['message' => 'Fattura inviata via email a ' . $email . '.']);
    }

    public function sendToSdi(Request $request, int $id)
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $sdiService = new \App\Services\SdiService();
        $result = $sdiService->sendToSdi($id, $tenantId);

        if ($result['success']) {
            AuditLogger::log($request, 'sdi_sent', 'invoice', $id, $result['sdi_identifier'] ?? '');
        }

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Segna fattura vendita come pagata
     */
    public function markPaid(Request $request, int $id)
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('invoices')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->where('is_paid', false)
            ->update([
                'is_paid' => true,
                'paid_at' => now(),
                'payment_method' => $request->input('payment_method', 'contanti'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Fattura non trovata o già pagata.'], 404);
        }

        AuditLogger::log($request, 'mark_paid', 'invoice', $id);

        return response()->json(['message' => 'Fattura segnata come pagata.']);
    }
}
