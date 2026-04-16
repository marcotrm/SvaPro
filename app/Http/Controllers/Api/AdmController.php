<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Helpers\NativeXlsx;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Response;

class AdmController extends Controller
{
    /**
     * Genera il report Excel ADM/PLI on-demand.
     *
     * Flusso:
     *   1. Se N8N_WEBHOOK_URL è configurato → chiama il workflow n8n.
     *   2. Altrimenti → fallback: query DB + chiamata diretta all'excel-api.
     *
     * POST /api/adm/generate-report
     * Body: { type: 'mensile'|'quindicinale', year: 2026, month: 4, half: 1|2 }
     */
    public function generateReport(Request $request): Response|JsonResponse
    {
        $validated = $request->validate([
            'type'  => ['required', 'in:mensile,quindicinale'],
            'year'  => ['required', 'digits:4', 'integer', 'min:2020', 'max:2030'],
            'month' => ['required', 'digits_between:1,2', 'integer', 'min:1', 'max:12'],
            'half'  => ['nullable', 'integer', 'in:1,2'],
        ]);

        $tenantId = (int) $request->attributes->get('tenant_id');
        $year     = (int) $validated['year'];
        $month    = (int) $validated['month'];
        $type     = $validated['type'];
        $half     = (int) ($validated['half'] ?? 1);

        // ── Calcola range date e nome file ──────────────────────────────────
        if ($type === 'mensile') {
            $startDate    = sprintf('%04d-%02d-01 00:00:00', $year, $month);
            $lastDay      = (int) date('t', mktime(0, 0, 0, $month, 1, $year));
            $endDate      = sprintf('%04d-%02d-%02d 23:59:59', $year, $month, $lastDay);
            $periodoLabel = sprintf('%02d%d', $month, $year);
            $nomeFile     = "SVAPOGROUPSRL{$periodoLabel}.xlsx";
        } else {
            if ($half === 1) {
                $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
                $endDate   = sprintf('%04d-%02d-15 23:59:59', $year, $month);
                $halfKey   = '1Q';
            } else {
                $lastDay   = (int) date('t', mktime(0, 0, 0, $month, 1, $year));
                $startDate = sprintf('%04d-%02d-16 00:00:00', $year, $month);
                $endDate   = sprintf('%04d-%02d-%02d 23:59:59', $year, $month, $lastDay);
                $halfKey   = '2Q';
            }
            $periodoLabel = sprintf('%s%02d%d', $halfKey, $month, $year);
            $nomeFile     = "SVAPOGROUPSRL{$periodoLabel}.xlsx";
        }

        $finePeriodo = \Carbon\Carbon::parse($endDate)->format('d/m/Y');

        // ── OPZIONE A — n8n webhook ──────────────────────────────────────────
        $n8nWebhookUrl = env('N8N_WEBHOOK_URL');

        if ($n8nWebhookUrl) {
            try {
                $response = Http::timeout(120)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($n8nWebhookUrl, [
                        'type'         => $type,
                        'year'         => $year,
                        'month'        => $month,
                        'half'         => $half,
                        'start_date'   => $startDate,
                        'end_date'     => $endDate,
                        'period_label' => $periodoLabel,
                        'fine_periodo' => $finePeriodo,
                        'nome_file'    => $nomeFile,
                        'tenant_id'    => $tenantId,
                    ]);

                if ($response->failed()) {
                    return response()->json([
                        'message' => 'Il workflow n8n ha restituito un errore.',
                        'detail'  => $response->body(),
                    ], 502);
                }

                $contentType = $response->header('Content-Type')
                    ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

                return response($response->body(), 200, [
                    'Content-Type'        => $contentType,
                    'Content-Disposition' => "attachment; filename=\"{$nomeFile}\"",
                    'Cache-Control'       => 'no-cache, no-store, must-revalidate',
                ]);

            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Impossibile raggiungere il workflow n8n.',
                    'detail'  => $e->getMessage(),
                ], 503);
            }
        }

        // ── OPZIONE B — Query DB ─────────────────────────────────────────────
        try {
            $tenant   = DB::table('tenants')->where('id', $tenantId)->first(['name', 'vat_number', 'settings_json']);
            $settings = json_decode($tenant?->settings_json ?? '{}', true);

            $ragioneSociale = $tenant?->name       ?? null;
            $partitaIva     = $tenant?->vat_number ?? null;
            $codiceImposta  = $settings['depositary_pli_code'] ?? null;

            // Vendite nel periodo (LEFT JOIN per product_variant_id nullable)
            $venditeRows = DB::select("
                SELECT
                    COALESCE(NULLIF(pv.flavor, ''), p.name)                         AS denominazione_prodotto,
                    NULLIF(COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku), '') AS codice_prodotto,
                    COALESCE(pv.volume_ml, p.volume_ml)::numeric                    AS capacita_confezione_ml,
                    COALESCE(pv.nicotine_strength, p.nicotine_mg::numeric)          AS nicotina_mg_ml,
                    SUM(sol.qty)::integer                                            AS numero_confezioni
                FROM sales_order_lines sol
                JOIN sales_orders so ON so.id = sol.sales_order_id
                    AND so.tenant_id = {$tenantId}
                    AND so.status = 'paid'
                    AND so.created_at >= '{$startDate}'
                    AND so.created_at <= '{$endDate}'
                LEFT JOIN product_variants pv ON pv.id = sol.product_variant_id
                LEFT JOIN products p ON p.id = pv.product_id AND p.tenant_id = {$tenantId}
                GROUP BY pv.flavor, p.name, p.pli_code,
                         pv.barcode, p.barcode, p.sku,
                         pv.volume_ml, p.volume_ml, pv.nicotine_strength, p.nicotine_mg
                HAVING SUM(sol.qty) > 0
                ORDER BY denominazione_prodotto
            ");


            // Giacenza finale
            $giacenzaRows = DB::select("
                SELECT
                    COALESCE(NULLIF(pv.flavor, ''), p.name)                         AS denominazione_prodotto,
                    NULLIF(COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku), '') AS codice_prodotto,
                    COALESCE(pv.volume_ml, p.volume_ml)::numeric                    AS capacita_confezione_ml,
                    COALESCE(pv.nicotine_strength, p.nicotine_mg::numeric)          AS nicotina_mg_ml,
                    COALESCE(SUM(si.on_hand), 0)::integer                           AS giacenza_finale
                FROM stock_items si
                JOIN product_variants pv ON pv.id = si.product_variant_id
                JOIN products p ON p.id = pv.product_id AND p.tenant_id = {$tenantId}
                WHERE si.tenant_id = {$tenantId}
                GROUP BY pv.flavor, p.name, p.pli_code, pv.barcode, p.barcode, p.sku,
                         pv.volume_ml, p.volume_ml, pv.nicotine_strength, p.nicotine_mg
                ORDER BY denominazione_prodotto
            ");

            // Resi nel periodo
            $resiRows = DB::select("
                SELECT
                    COALESCE(NULLIF(pv.flavor, ''), p.name)                         AS denominazione_prodotto,
                    NULLIF(COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku), '') AS codice_prodotto,
                    SUM(crl.quantity)::integer                                       AS quantita_resa,
                    cr.reason                                                        AS motivo_reso,
                    TO_CHAR(cr.created_at, 'DD/MM/YYYY')                            AS data_reso
                FROM customer_returns cr
                JOIN customer_return_lines crl ON crl.customer_return_id = cr.id
                JOIN product_variants pv ON pv.id = crl.product_variant_id
                JOIN products p ON p.id = pv.product_id AND p.tenant_id = {$tenantId}
                WHERE cr.tenant_id = {$tenantId}
                    AND cr.created_at >= '{$startDate}'
                    AND cr.created_at <= '{$endDate}'
                GROUP BY pv.flavor, p.name, p.pli_code, pv.barcode, p.barcode, p.sku, cr.reason, cr.created_at
                ORDER BY data_reso
            ");

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Errore nel recupero dati dal database.',
                'detail'  => $e->getMessage(),
            ], 500);
        }

        if ($type === 'mensile') {
            // /genera-excel → sheet3 (DC consumatori) + sheet2 (depositi riforniti, vuoto per retail)
            // Ordine campi = ordine colonne Excel (server.js usa Object.values())
            $sheet3 = array_map(fn($r) => [
                'ragione_sociale_depositario' => $ragioneSociale,
                'partita_iva_depositario'     => $partitaIva,
                'codice_imposta_depositario'  => $codiceImposta,
                'data_mese'                   => $finePeriodo,
                'denominazione_prodotto'      => $r->denominazione_prodotto,
                'codice_prodotto'             => $r->codice_prodotto,
                'capacita_confezione_ml'      => $r->capacita_confezione_ml,
                'nicotina_mg_ml'              => $r->nicotina_mg_ml,
                'numero_confezioni'           => $r->numero_confezioni,
                'quantita_totale_ml'          => ($r->capacita_confezione_ml !== null && $r->numero_confezioni !== null)
                    ? round((float) $r->capacita_confezione_ml * (int) $r->numero_confezioni, 2)
                    : null,
            ], $venditeRows);

            $payload  = ['sheet3' => $sheet3, 'sheet2' => []];
            $endpoint = '/genera-excel';

        } else {
            // /genera-excel-quindicinale → prospetto, giacenza, resi
            $prospetto = array_map(fn($r) => [
                'ragione_sociale_depositario' => $ragioneSociale,
                'partita_iva_depositario'     => $partitaIva,
                'codice_imposta_depositario'  => $codiceImposta,
                'data_fine_quindicina'        => $finePeriodo,
                'tipo_consumatore'            => 'DC',
                'denominazione_prodotto'      => $r->denominazione_prodotto,
                'codice_prodotto'             => $r->codice_prodotto,
                'capacita_confezione_ml'      => $r->capacita_confezione_ml,
                'nicotina_mg_ml'              => $r->nicotina_mg_ml,
                'prezzo_confezione'           => null,
                'numero_confezioni'           => $r->numero_confezioni,
                'quantita_totale_ml'          => ($r->capacita_confezione_ml !== null && $r->numero_confezioni !== null)
                    ? round((float) $r->capacita_confezione_ml * (int) $r->numero_confezioni, 2)
                    : null,
                'imposta_unitaria'            => null,
                'imposta_totale'              => null,
            ], $venditeRows);

            $giacenza = array_map(fn($r) => [
                'ragione_sociale_depositario' => $ragioneSociale,
                'partita_iva_depositario'     => $partitaIva,
                'codice_imposta_depositario'  => $codiceImposta,
                'data_fine_quindicina'        => $finePeriodo,
                'denominazione_prodotto'      => $r->denominazione_prodotto,
                'codice_prodotto'             => $r->codice_prodotto,
                'capacita_confezione_ml'      => $r->capacita_confezione_ml,
                'nicotina_mg_ml'              => $r->nicotina_mg_ml,
                'giacenza_finale'             => $r->giacenza_finale,
            ], $giacenzaRows);

            $resi = array_map(fn($r) => [
                'denominazione_prodotto' => $r->denominazione_prodotto,
                'codice_prodotto'        => $r->codice_prodotto,
                'quantita_resa'          => $r->quantita_resa,
                'motivo_reso'            => $r->motivo_reso,
                'data_reso'              => $r->data_reso,
            ], $resiRows);

            $payload  = ['prospetto' => $prospetto, 'giacenza' => $giacenza, 'resi' => $resi];
            $endpoint = '/genera-excel-quindicinale';
        }

        // ── OPZIONE B — excel-api diretta (se configurata) ───────────────────
        $excelApiUrl = rtrim(env('EXCEL_API_URL', ''), '/');

        // Solo se EXCEL_API_URL è esplicitamente configurato (non localhost default)
        if ($excelApiUrl && !str_contains($excelApiUrl, 'localhost')) {
            try {
                $response = Http::timeout(90)->post($excelApiUrl . $endpoint, $payload);

                if ($response->successful()) {
                    return response($response->body(), 200, [
                        'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'Content-Disposition' => "attachment; filename=\"{$nomeFile}\"",
                        'Cache-Control'       => 'no-cache, no-store, must-revalidate',
                    ]);
                }
                // Se fallisce, continua con generazione nativa
            } catch (\Throwable) {
                // Continua con generazione nativa
            }
        }

        // ── OPZIONE C — Generazione nativa PHP (fallback definitivo) ─────────
        // Funziona sempre, senza dipendenze esterne.
        try {
            $xlsx = new NativeXlsx();

            if ($type === 'mensile') {
                // Foglio Vendite (Sheet3 ADM = DC Consumatori)
                $headers3 = [
                    'Ragione Sociale Depositario', 'Partita IVA', 'Codice Imposta',
                    'Data Mese', 'Denominazione Prodotto', 'Codice Prodotto',
                    'Capacità Confezione (ml)', 'Nicotina (mg/ml)',
                    'N° Confezioni', 'Quantità Totale (ml)',
                ];
                $rows3 = array_map(fn($r) => array_values($r), $payload['sheet3']);
                $xlsx->addSheet('DC Consumatori', $headers3, $rows3);

                if (!empty($payload['sheet2'])) {
                    $headers2 = [
                        'Ragione Sociale Depositario', 'Partita IVA', 'Codice Imposta',
                        'Data Mese', 'Denominazione Prodotto', 'Codice Prodotto',
                        'Capacità Confezione (ml)', 'Nicotina (mg/ml)',
                        'N° Confezioni', 'Quantità Totale (ml)',
                    ];
                    $rows2 = array_map(fn($r) => array_values($r), $payload['sheet2']);
                    $xlsx->addSheet('Depositi Riforniti', $headers2, $rows2);
                }
            } else {
                // Quindicinale: 3 fogli
                $hPros = [
                    'Ragione Sociale', 'Partita IVA', 'Codice Imposta', 'Data Fine Quindicina',
                    'Tipo Consumatore', 'Denominazione Prodotto', 'Codice Prodotto',
                    'Capacità (ml)', 'Nicotina (mg/ml)', 'Prezzo Confezione',
                    'N° Confezioni', 'Quantità Totale (ml)', 'Imposta Unitaria', 'Imposta Totale',
                ];
                $xlsx->addSheet('Prospetto Vendite', $hPros,
                    array_map(fn($r) => array_values($r), $payload['prospetto']));

                $hGiac = [
                    'Ragione Sociale', 'Partita IVA', 'Codice Imposta', 'Data Fine Quindicina',
                    'Denominazione Prodotto', 'Codice Prodotto',
                    'Capacità (ml)', 'Nicotina (mg/ml)', 'Giacenza Finale',
                ];
                $xlsx->addSheet('Giacenza Finale', $hGiac,
                    array_map(fn($r) => array_values($r), $payload['giacenza']));

                $hResi = [
                    'Denominazione Prodotto', 'Codice Prodotto',
                    'Quantità Resa', 'Motivo Reso', 'Data Reso',
                ];
                $xlsx->addSheet('Resi', $hResi,
                    array_map(fn($r) => array_values($r), $payload['resi']));
            }

            $bytes = $xlsx->generate();

            return response($bytes, 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => "attachment; filename=\"{$nomeFile}\"",
                'Cache-Control'       => 'no-cache, no-store, must-revalidate',
                'Content-Length'      => strlen($bytes),
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Errore nella generazione del file Excel.',
                'detail'  => $e->getMessage(),
            ], 500);
        }
    }

    public function getHistory(Request $request): JsonResponse
    {
        return response()->json(['data' => []]);
    }
}
