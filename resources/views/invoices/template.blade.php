<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.5; }
  .page { padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .brand { font-size: 22px; font-weight: 700; color: #080d18; letter-spacing: -0.5px; }
  .brand span { color: #c9a227; }
  .meta { text-align: right; }
  .meta h2 { font-size: 16px; color: #c9a227; margin-bottom: 4px; }
  .meta p { font-size: 11px; color: #555; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .party { width: 48%; }
  .party-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 700; margin-bottom: 6px; }
  .party-name { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #0e1726; color: #e8edf5; padding: 8px 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  .totals { width: 300px; margin-left: auto; margin-bottom: 24px; }
  .totals tr td { padding: 4px 10px; border: none; }
  .totals .grand td { font-size: 14px; font-weight: 700; border-top: 2px solid #0e1726; padding-top: 8px; }
  .footer { text-align: center; font-size: 9px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 12px; }
</style>
</head>
<body>
<div class="page">
  <table style="width:100%; margin-bottom: 30px; border: none;">
    <tr>
      <td style="border:none; padding:0;">
        <div class="brand">Sva<span>Pro</span></div>
        @if($tenant)
        <div style="margin-top:4px; font-size:11px; color:#555;">{{ $tenant->name }}</div>
        @if($tenant->vat_number)<div style="font-size:10px; color:#888;">P.IVA: {{ $tenant->vat_number }}</div>@endif
        @endif
      </td>
      <td style="border:none; padding:0; text-align:right;">
        <div style="font-size:16px; font-weight:700; color:#c9a227;">FATTURA</div>
        <div style="font-size:12px; color:#555; margin-top:2px;">{{ $invoice->invoice_number }}</div>
        <div style="font-size:10px; color:#888; margin-top:2px;">Data: {{ \Carbon\Carbon::parse($invoice->issued_at)->format('d/m/Y') }}</div>
      </td>
    </tr>
  </table>

  @if($customer)
  <table style="width:100%; margin-bottom: 24px; border: none;">
    <tr>
      <td style="border:none; padding:0; width:50%;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#888; font-weight:700; margin-bottom:6px;">Cliente</div>
        <div style="font-size:13px; font-weight:700;">{{ $customer->first_name }} {{ $customer->last_name }}</div>
        @if($customer->email)<div style="font-size:10px; color:#555;">{{ $customer->email }}</div>@endif
        @if($customer->line1)<div style="font-size:10px; color:#555;">{{ $customer->line1 }}, {{ $customer->zip ?? '' }} {{ $customer->city ?? '' }}</div>@endif
      </td>
      <td style="border:none; padding:0; width:50%; text-align:right;">
        <div style="font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#888; font-weight:700; margin-bottom:6px;">Ordine</div>
        <div style="font-size:11px; color:#555;">#{{ str_pad($order->id, 4, '0', STR_PAD_LEFT) }}</div>
        <div style="font-size:10px; color:#888;">{{ \Carbon\Carbon::parse($order->created_at)->format('d/m/Y H:i') }}</div>
      </td>
    </tr>
  </table>
  @endif

  <table>
    <thead>
      <tr>
        <th>Prodotto</th>
        <th>SKU</th>
        <th style="text-align:center;">Qtà</th>
        <th style="text-align:right;">Prezzo unit.</th>
        <th style="text-align:right;">Sconto</th>
        <th style="text-align:right;">IVA</th>
        <th style="text-align:right;">Totale</th>
      </tr>
    </thead>
    <tbody>
      @foreach($lines as $line)
      <tr>
        <td>{{ $line->product_name }}</td>
        <td style="font-family:monospace; font-size:10px;">{{ $line->sku }}</td>
        <td style="text-align:center;">{{ $line->qty }}</td>
        <td style="text-align:right;">€{{ number_format($line->unit_price, 2, ',', '.') }}</td>
        <td style="text-align:right;">€{{ number_format($line->discount_amount, 2, ',', '.') }}</td>
        <td style="text-align:right;">€{{ number_format($line->tax_amount, 2, ',', '.') }}</td>
        <td style="text-align:right; font-weight:600;">€{{ number_format($line->line_total, 2, ',', '.') }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotale</td><td>€{{ number_format($invoice->subtotal, 2, ',', '.') }}</td></tr>
    @if($invoice->discount_total > 0)
    <tr><td>Sconti</td><td>-€{{ number_format($invoice->discount_total, 2, ',', '.') }}</td></tr>
    @endif
    <tr><td>IVA</td><td>€{{ number_format($invoice->tax_total, 2, ',', '.') }}</td></tr>
    @if($invoice->excise_total > 0)
    <tr><td>Accise</td><td>€{{ number_format($invoice->excise_total, 2, ',', '.') }}</td></tr>
    @endif
    <tr class="grand">
      <td>Totale</td>
      <td>€{{ number_format($invoice->grand_total, 2, ',', '.') }}</td>
    </tr>
  </table>

  <div class="footer">
    Documento generato da SvaPro &mdash; {{ \Carbon\Carbon::parse($invoice->issued_at)->format('d/m/Y') }}
    @if($tenant) &mdash; {{ $tenant->name }} @endif
  </div>
</div>
</body>
</html>
