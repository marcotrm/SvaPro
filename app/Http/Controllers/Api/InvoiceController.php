<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $invoiceId = DB::table('invoices')->insertGetId([
            'tenant_id'       => $tenantId,
            'sales_order_id'  => $order->id,
            'invoice_number'  => $invoiceNumber,
            'progressive'     => $progressive,
            'customer_id'     => $order->customer_id,
            'subtotal'        => $order->subtotal,
            'discount_total'  => $order->discount_total,
            'tax_total'       => $order->tax_total,
            'excise_total'    => $order->excise_total,
            'grand_total'     => $order->grand_total,
            'currency'        => $order->currency,
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

        return $pdf->download($invoice->invoice_number . '.pdf');
    }

    public function index(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');

        $query = DB::table('invoices')
            ->leftJoin('customers', 'invoices.customer_id', '=', 'customers.id')
            ->where('invoices.tenant_id', $tenantId)
            ->select(
                'invoices.*',
                'customers.first_name',
                'customers.last_name',
                'customers.email as customer_email'
            )
            ->orderByDesc('invoices.issued_at');

        if ($request->filled('date_from')) {
            $query->whereDate('invoices.issued_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('invoices.issued_at', '<=', $request->input('date_to'));
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }
}
