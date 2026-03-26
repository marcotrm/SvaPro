<?php

namespace App\Services;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;

class DocumentService
{
    /**
     * Genera un PDF per un'entita qualsiasi tracciata dall'audit log.
     */
    public function generateForEntity(int $tenantId, string $entityType, int $entityId): ?string
    {
        $generator = match ($entityType) {
            'order' => fn () => $this->orderDocument($tenantId, $entityId),
            'purchase_order' => fn () => $this->purchaseOrderDocument($tenantId, $entityId),
            'stock_adjustment' => fn () => $this->stockAdjustmentDocument($tenantId, $entityId),
            'pos_session' => fn () => $this->posSessionDocument($tenantId, $entityId),
            'invoice' => fn () => $this->invoiceRedirect($tenantId, $entityId),
            default => null,
        };

        return $generator ? $generator() : null;
    }

    /**
     * Documento riepilogo ordine di vendita.
     */
    private function orderDocument(int $tenantId, int $orderId): string
    {
        $order = DB::table('sales_orders as so')
            ->leftJoin('customers as c', 'c.id', '=', 'so.customer_id')
            ->leftJoin('stores as s', 's.id', '=', 'so.store_id')
            ->where('so.tenant_id', $tenantId)
            ->where('so.id', $orderId)
            ->select('so.*', 'c.first_name', 'c.last_name', 'c.email as customer_email', 's.name as store_name')
            ->first();

        if (! $order) {
            return '';
        }

        $lines = DB::table('sales_order_lines as sol')
            ->join('product_variants as pv', 'pv.id', '=', 'sol.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('sol.sales_order_id', $orderId)
            ->select('sol.*', 'p.name as product_name', 'p.sku', 'pv.flavor')
            ->get();

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        $html = $this->renderHtml('Riepilogo Ordine #' . $orderId, $tenant, [
            ['label' => 'Ordine', 'value' => '#' . $orderId],
            ['label' => 'Stato', 'value' => $order->status],
            ['label' => 'Negozio', 'value' => $order->store_name ?? '-'],
            ['label' => 'Cliente', 'value' => trim(($order->first_name ?? '') . ' ' . ($order->last_name ?? '')) ?: '-'],
            ['label' => 'Canale', 'value' => $order->channel],
            ['label' => 'Totale', 'value' => '€ ' . number_format((float) $order->grand_total, 2, ',', '.')],
            ['label' => 'Data', 'value' => $order->created_at],
        ], $lines->map(fn ($l) => [
            'Prodotto' => $l->product_name . ($l->flavor ? " ({$l->flavor})" : ''),
            'SKU' => $l->sku,
            'Qtà' => $l->qty,
            'Prezzo un.' => '€ ' . number_format((float) $l->unit_price, 2, ',', '.'),
            'Totale riga' => '€ ' . number_format((float) $l->line_total, 2, ',', '.'),
        ])->all());

        return Pdf::loadHTML($html)->setPaper('A4')->output();
    }

    /**
     * Documento ordine di acquisto.
     */
    private function purchaseOrderDocument(int $tenantId, int $poId): string
    {
        $po = DB::table('purchase_orders as po')
            ->join('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('po.tenant_id', $tenantId)
            ->where('po.id', $poId)
            ->select('po.*', 's.name as supplier_name', 's.email as supplier_email', 's.vat_number')
            ->first();

        if (! $po) {
            return '';
        }

        $lines = DB::table('purchase_order_lines as pol')
            ->join('product_variants as pv', 'pv.id', '=', 'pol.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pol.purchase_order_id', $poId)
            ->select('pol.*', 'p.name as product_name', 'p.sku', 'pv.flavor')
            ->get();

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        $html = $this->renderHtml('Ordine di Acquisto #' . $poId, $tenant, [
            ['label' => 'PO', 'value' => '#' . $poId],
            ['label' => 'Stato', 'value' => $po->status],
            ['label' => 'Fornitore', 'value' => $po->supplier_name],
            ['label' => 'P.IVA Fornitore', 'value' => $po->vat_number ?? '-'],
            ['label' => 'Email Fornitore', 'value' => $po->supplier_email ?? '-'],
            ['label' => 'Totale Netto', 'value' => '€ ' . number_format((float) $po->total_net, 2, ',', '.')],
            ['label' => 'Consegna prevista', 'value' => $po->expected_at ?? '-'],
            ['label' => 'Data creazione', 'value' => $po->created_at],
        ], $lines->map(fn ($l) => [
            'Prodotto' => $l->product_name . ($l->flavor ? " ({$l->flavor})" : ''),
            'SKU' => $l->sku,
            'Qtà' => $l->qty,
            'Costo un.' => '€ ' . number_format((float) $l->unit_cost, 2, ',', '.'),
            'Totale' => '€ ' . number_format($l->qty * (float) $l->unit_cost, 2, ',', '.'),
        ])->all());

        return Pdf::loadHTML($html)->setPaper('A4')->output();
    }

    /**
     * Documento rettifica stock.
     */
    private function stockAdjustmentDocument(int $tenantId, int $movementId): string
    {
        $movement = DB::table('stock_movements as sm')
            ->join('product_variants as pv', 'pv.id', '=', 'sm.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('warehouses as w', 'w.id', '=', 'sm.warehouse_id')
            ->where('sm.tenant_id', $tenantId)
            ->where('sm.id', $movementId)
            ->select('sm.*', 'p.name as product_name', 'p.sku', 'w.name as warehouse_name')
            ->first();

        if (! $movement) {
            return '';
        }

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        $html = $this->renderHtml('Rettifica Stock #' . $movementId, $tenant, [
            ['label' => 'Movimento', 'value' => '#' . $movementId],
            ['label' => 'Tipo', 'value' => $movement->movement_type],
            ['label' => 'Prodotto', 'value' => $movement->product_name . ' (' . $movement->sku . ')'],
            ['label' => 'Magazzino', 'value' => $movement->warehouse_name],
            ['label' => 'Quantità', 'value' => ($movement->qty > 0 ? '+' : '') . $movement->qty],
            ['label' => 'Data', 'value' => $movement->created_at],
        ]);

        return Pdf::loadHTML($html)->setPaper('A4')->output();
    }

    /**
     * Documento chiusura sessione POS.
     */
    private function posSessionDocument(int $tenantId, int $sessionId): string
    {
        $session = DB::table('pos_sessions as ps')
            ->join('stores as s', 's.id', '=', 'ps.store_id')
            ->join('users as u', 'u.id', '=', 'ps.employee_id')
            ->where('ps.tenant_id', $tenantId)
            ->where('ps.id', $sessionId)
            ->select('ps.*', 's.name as store_name', 'u.name as employee_name')
            ->first();

        if (! $session) {
            return '';
        }

        $salesSummary = DB::table('sales_orders')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $session->store_id)
            ->where('channel', 'pos')
            ->where('created_at', '>=', $session->opened_at)
            ->when($session->closed_at, fn ($q) => $q->where('created_at', '<=', $session->closed_at))
            ->where('status', 'paid')
            ->selectRaw('COUNT(*) as total_sales, COALESCE(SUM(grand_total), 0) as total_revenue')
            ->first();

        $tenant = DB::table('tenants')->where('id', $tenantId)->first();

        $expectedCash = (float) $session->opening_cash + (float) $salesSummary->total_revenue;
        $difference = $session->closing_cash !== null
            ? round((float) $session->closing_cash - $expectedCash, 2)
            : null;

        $html = $this->renderHtml('Chiusura Cassa #' . $sessionId, $tenant, [
            ['label' => 'Sessione', 'value' => '#' . $sessionId],
            ['label' => 'Negozio', 'value' => $session->store_name],
            ['label' => 'Operatore', 'value' => $session->employee_name],
            ['label' => 'Apertura', 'value' => $session->opened_at],
            ['label' => 'Chiusura', 'value' => $session->closed_at ?? 'ANCORA APERTA'],
            ['label' => 'Cassa apertura', 'value' => '€ ' . number_format((float) $session->opening_cash, 2, ',', '.')],
            ['label' => 'Cassa chiusura', 'value' => $session->closing_cash !== null ? '€ ' . number_format((float) $session->closing_cash, 2, ',', '.') : '-'],
            ['label' => 'Vendite POS', 'value' => $salesSummary->total_sales],
            ['label' => 'Incasso totale', 'value' => '€ ' . number_format((float) $salesSummary->total_revenue, 2, ',', '.')],
            ['label' => 'Cassa attesa', 'value' => '€ ' . number_format($expectedCash, 2, ',', '.')],
            ['label' => 'Differenza', 'value' => $difference !== null ? '€ ' . number_format($difference, 2, ',', '.') : '-'],
        ]);

        return Pdf::loadHTML($html)->setPaper('A4')->output();
    }

    private function invoiceRedirect(int $tenantId, int $invoiceId): string
    {
        // Fatture usano il loro template dedicato, restituisco stringa vuota
        // Il controller userà il download diretto
        return '';
    }

    /**
     * Render HTML generico per documenti PDF.
     */
    private function renderHtml(string $title, ?object $tenant, array $fields, array $tableRows = []): string
    {
        $tenantName = $tenant->name ?? 'SvaPro';
        $tenantVat = $tenant->vat_number ?? '';

        $fieldsHtml = '';
        foreach ($fields as $field) {
            $label = htmlspecialchars((string) $field['label'], ENT_QUOTES, 'UTF-8');
            $value = htmlspecialchars((string) $field['value'], ENT_QUOTES, 'UTF-8');
            $fieldsHtml .= "<tr><td style=\"padding:4px 12px 4px 0;font-weight:bold;\">{$label}</td><td style=\"padding:4px 0;\">{$value}</td></tr>";
        }

        $tableHtml = '';
        if (! empty($tableRows)) {
            $headers = array_keys($tableRows[0]);
            $thHtml = implode('', array_map(fn ($h) => "<th style=\"padding:6px 8px;text-align:left;border-bottom:2px solid #333;\">" . htmlspecialchars($h, ENT_QUOTES, 'UTF-8') . "</th>", $headers));
            $rowsHtml = '';
            foreach ($tableRows as $row) {
                $cells = implode('', array_map(fn ($v) => "<td style=\"padding:4px 8px;border-bottom:1px solid #ddd;\">" . htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8') . "</td>", array_values($row)));
                $rowsHtml .= "<tr>{$cells}</tr>";
            }
            $tableHtml = "<table style=\"width:100%;border-collapse:collapse;margin-top:20px;\"><thead><tr>{$thHtml}</tr></thead><tbody>{$rowsHtml}</tbody></table>";
        }

        $tenantNameEsc = htmlspecialchars($tenantName, ENT_QUOTES, 'UTF-8');
        $tenantVatEsc = htmlspecialchars($tenantVat, ENT_QUOTES, 'UTF-8');
        $titleEsc = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $date = now()->format('d/m/Y H:i');

        return <<<HTML
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>{$titleEsc}</title></head>
<body style="font-family:DejaVu Sans,sans-serif;font-size:12px;color:#333;margin:30px;">
<div style="border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px;">
    <h2 style="margin:0;">{$tenantNameEsc}</h2>
    <p style="margin:2px 0;font-size:10px;">P.IVA {$tenantVatEsc}</p>
</div>
<h3 style="margin:0 0 12px;">{$titleEsc}</h3>
<p style="font-size:10px;color:#666;">Generato il {$date}</p>
<table style="margin-top:10px;">{$fieldsHtml}</table>
{$tableHtml}
<div style="margin-top:40px;border-top:1px solid #ccc;padding-top:8px;font-size:9px;color:#999;">
Documento generato automaticamente da SvaPro. Non ha valore fiscale.
</div>
</body>
</html>
HTML;
    }
}
