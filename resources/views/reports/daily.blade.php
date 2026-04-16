<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Report Giornaliero</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
        h1 { color: #5B50B0; margin-bottom: 5px; font-size: 24px; }
        h2 { color: #555; font-size: 16px; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 13px; }
        th { background: #f9fafb; color: #374151; font-weight: bold; text-transform: uppercase; font-size: 11px; }
        .text-right { text-align: right; }
        .total-box { background: #5B50B0; color: #fff; padding: 20px; border-radius: 8px; width: 300px; margin-left: auto; }
        .total-box > div { margin-bottom: 8px; }
        .amount { font-weight: bold; font-size: 22px; margin-top: 10px; }
        .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #888; }
    </style>
</head>
<body>
    <h1>SvaPro - Report di Chiusura Serale</h1>
    <h2>{{ $tenant_name }} - Riferimento: {{ $date }}</h2>

    <table>
        <thead>
            <tr>
                <th>Negozio</th>
                <th class="text-right">Scontrini Emessi</th>
                <th class="text-right">Resi Effettuati</th>
                <th>Miglior Dipendente</th>
                <th class="text-right">Incasso</th>
            </tr>
        </thead>
        <tbody>
            @foreach($store_stats as $stat)
            <tr>
                <td><strong>{{ $stat['name'] }}</strong></td>
                <td class="text-right">{{ $stat['scontrini'] }}</td>
                <td class="text-right">{{ $stat['resi'] }}</td>
                <td>{{ $stat['top_employee'] }}</td>
                <td class="text-right" style="font-weight: bold;">€ {{ number_format($stat['incasso'], 2, ',', '.') }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="total-box">
        <div>Totale Scontrini del gruppo: <strong>{{ $total_scontrini }}</strong></div>
        <div>Totale Resi registrati: <strong>{{ $total_resi }}</strong></div>
        <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 15px; padding-top: 15px; font-size: 12px;">Incasso Netto della giornata</div>
        <div class="amount">€ {{ number_format($total_incasso, 2, ',', '.') }}</div>
    </div>
    
    <div style="clear: both;"></div>

    <div class="footer">
        Generato automaticamente dal gestionale SvaPro in data {{ date('d/m/Y H:i') }}.
    </div>
</body>
</html>
