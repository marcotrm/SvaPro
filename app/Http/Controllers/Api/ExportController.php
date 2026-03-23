<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExportController extends Controller
{
    public function exportOrders(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storeId  = $request->input('store_id');

        $query = DB::table('sales_orders')
            ->leftJoin('customers', 'sales_orders.customer_id', '=', 'customers.id')
            ->where('sales_orders.tenant_id', $tenantId)
            ->select(
                'sales_orders.id',
                'sales_orders.status',
                'sales_orders.channel',
                'sales_orders.subtotal',
                'sales_orders.discount_total',
                'sales_orders.tax_total',
                'sales_orders.excise_total',
                'sales_orders.grand_total',
                'sales_orders.currency',
                'sales_orders.paid_at',
                'sales_orders.created_at',
                'customers.first_name',
                'customers.last_name',
                'customers.email as customer_email'
            )
            ->orderByDesc('sales_orders.created_at');

        if ($storeId) {
            $query->where('sales_orders.store_id', $storeId);
        }
        if ($request->filled('status')) {
            $query->where('sales_orders.status', $request->input('status'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('sales_orders.created_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('sales_orders.created_at', '<=', $request->input('date_to'));
        }

        $rows = $query->limit(5000)->get();

        return $this->csvResponse($rows, [
            'ID', 'Stato', 'Canale', 'Subtotale', 'Sconto', 'IVA', 'Accise',
            'Totale', 'Valuta', 'Pagato il', 'Creato il', 'Nome', 'Cognome', 'Email Cliente',
        ], 'ordini.csv');
    }

    public function exportCustomers(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');

        $query = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->select('id', 'code', 'first_name', 'last_name', 'email', 'phone', 'birth_date', 'marketing_consent', 'created_at')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $s = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($s) {
                $q->where('first_name', 'ilike', $s)
                  ->orWhere('last_name', 'ilike', $s)
                  ->orWhere('email', 'ilike', $s);
            });
        }

        $rows = $query->limit(5000)->get();

        return $this->csvResponse($rows, [
            'ID', 'Codice', 'Nome', 'Cognome', 'Email', 'Telefono', 'Data nascita', 'Consenso marketing', 'Registrato il',
        ], 'clienti.csv');
    }

    public function exportInventory(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $storeId  = $request->input('store_id');

        $query = DB::table('stock_items')
            ->join('product_variants', 'stock_items.product_variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->join('warehouses', 'stock_items.warehouse_id', '=', 'warehouses.id')
            ->where('stock_items.tenant_id', $tenantId)
            ->select(
                'products.name as product_name',
                'product_variants.sku',
                'warehouses.name as warehouse_name',
                'stock_items.on_hand',
                'stock_items.reserved',
                DB::raw('(stock_items.on_hand - stock_items.reserved) as available'),
                'stock_items.reorder_point',
                'stock_items.safety_stock',
                'stock_items.updated_at'
            )
            ->orderBy('products.name');

        if ($storeId) {
            $query->where('warehouses.store_id', $storeId);
        }

        $rows = $query->limit(5000)->get();

        return $this->csvResponse($rows, [
            'Prodotto', 'SKU', 'Magazzino', 'In stock', 'Riservati', 'Disponibili',
            'Punto riordino', 'Scorta sicurezza', 'Aggiornato il',
        ], 'inventario.csv');
    }

    private function csvResponse($rows, array $headers, string $filename)
    {
        $callback = function () use ($rows, $headers) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, "\xEF\xBB\xBF"); // UTF-8 BOM for Excel
            fputcsv($handle, $headers, ';');

            foreach ($rows as $row) {
                fputcsv($handle, (array) $row, ';');
            }
            fclose($handle);
        };

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
