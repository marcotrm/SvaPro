<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
     *   1. Se N8N_WEBHOOK_URL è configurato → chiama il workflow n8n e restituisce il file che n8n restituisce.
     *   2. Altrimenti → fallback: query DB + chiamata diretta all'excel-api.
     *
     * POST /api/{tenant}/adm/generate-report
     * Body: { type: 'mensile'|'quindicinale', year: '2025', month: '07', half: 1|2 }
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

        // Calcola range date e nome file
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

        // ──────────────────────────────────────────────────────────────────────
        // OPZIONE A — Chiama il workflow n8n se N8N_WEBHOOK_URL è configurato
        // ──────────────────────────────────────────────────────────────────────
        $n8nWebhookUrl = env('N8N_WEBHOOK_URL');

        if ($n8nWebhookUrl) {
            try {
                $response = Http::timeout(120) // n8n può impiegare qualche secondo
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
                        'message' => 'Il workflow n8n ha restituito un errore. Controlla il log n8n su Railway.',
                        'detail'  => $response->body(),
                    ], 502);
                }

                // n8n deve restituire il file Excel direttamente
                $contentType = $response->header('Content-Type')
                    ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

                return response($response->body(), 200, [
                    'Content-Type'        => $contentType,
                    'Content-Disposition' => "attachment; filename=\"{$nomeFile}\"",
                    'Cache-Control'       => 'no-cache, no-store, must-revalidate',
                ]);

            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Impossibile raggiungere il workflow n8n. Controlla la variabile N8N_WEBHOOK_URL.',
                    'detail'  => $e->getMessage(),
                ], 503);
            }
        }

        // ──────────────────────────────────────────────────────────────────────
        // OPZIONE B — Fallback: query DB + excel-api diretta
        // ──────────────────────────────────────────────────────────────────────
        $tenant   = DB::table('tenants')->where('id', $tenantId)->first(['name', 'vat_number', 'settings_json']);
        $settings = json_decode($tenant?->settings_json ?? '{}', true);

        $tenantInfo = [
            'ragione_sociale' => $tenant?->name       ?? 'N/D',
            'partita_iva'     => $tenant?->vat_number ?? 'N/D',
            'codice_imposta'  => $settings['depositary_pli_code'] ?? 'N/D',
        ];

        $prospettoRows = DB::select("
            SELECT
                '{$tenantInfo['ragione_sociale']}' AS ragione_sociale_depositario,
                '{$tenantInfo['partita_iva']}' AS partita_iva_depositario,
                '{$tenantInfo['codice_imposta']}' AS codice_imposta_depositario,
                '{$finePeriodo}' AS data_fine_periodo,
                'DC' AS tipo_consumatore,
                COALESCE(NULLIF(pv.flavor, ''), p.name) AS denominazione_prodotto,
                COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku) AS codice_prodotto,
                COALESCE(pv.volume_ml, p.volume_ml, 0)::numeric AS capacita_confezione_ml,
                COALESCE(pv.nicotine_strength, p.nicotine_mg::numeric, 0) AS nicotina_mg_per_ml,
                SUM(sol.qty)::integer AS totale_pezzi_venduti,
                1 AS valore_soglia_nicotina
            FROM sales_order_lines sol
            JOIN sales_orders so ON so.id = sol.sales_order_id
                AND so.tenant_id = {$tenantId}
                AND so.status = 'paid'
                AND so.created_at >= '{$startDate}'
                AND so.created_at <= '{$endDate}'
            JOIN product_variants pv ON pv.id = sol.product_variant_id
            JOIN products p ON p.id = pv.product_id AND p.tenant_id = {$tenantId}
            WHERE (
                (p.pli_code IS NOT NULL AND p.pli_code != '')
                OR (pv.nicotine_strength IS NOT NULL AND pv.nicotine_strength > 0)
                OR (p.nicotine_mg IS NOT NULL AND p.nicotine_mg > 0)
                OR p.product_type IN ('liquid', 'e-liquid', 'eliquid', 'nicotine')
            )
            GROUP BY pv.flavor, p.name, p.pli_code, pv.barcode, p.barcode, p.sku,
                     pv.volume_ml, p.volume_ml, pv.nicotine_strength, p.nicotine_mg
            HAVING SUM(sol.qty) > 0
            ORDER BY denominazione_prodotto
        ");

        $giacenzaRows = DB::select("
            SELECT
                COALESCE(NULLIF(pv.flavor, ''), p.name) AS denominazione_prodotto,
                COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku) AS codice_prodotto,
                COALESCE(pv.volume_ml, p.volume_ml, 0)::numeric AS capacita_confezione_ml,
                COALESCE(pv.nicotine_strength, p.nicotine_mg::numeric, 0) AS nicotina_mg_per_ml,
                COALESCE(SUM(si.on_hand), 0)::integer AS giacenza_finale
            FROM stock_items si
            JOIN product_variants pv ON pv.id = si.product_variant_id
            JOIN products p ON p.id = pv.product_id AND p.tenant_id = {$tenantId}
            WHERE si.tenant_id = {$tenantId}
            AND (
                (p.pli_code IS NOT NULL AND p.pli_code != '')
                OR (pv.nicotine_strength IS NOT NULL AND pv.nicotine_strength > 0)
                OR (p.nicotine_mg IS NOT NULL AND p.nicotine_mg > 0)
                OR p.product_type IN ('liquid', 'e-liquid', 'eliquid', 'nicotine')
            )
            GROUP BY pv.flavor, p.name, p.pli_code, pv.barcode, p.barcode, p.sku,
                     pv.volume_ml, p.volume_ml, pv.nicotine_strength, p.nicotine_mg
            ORDER BY denominazione_prodotto
        ");

        $resiRows = DB::select("
            SELECT
                COALESCE(NULLIF(pv.flavor, ''), p.name) AS denominazione_prodotto,
                COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku) AS codice_prodotto,
                SUM(crl.quantity)::integer AS quantita_resa,
                cr.reason AS motivo_reso,
                TO_CHAR(cr.created_at, 'DD/MM/YYYY') AS data_reso
            FROM customer_returns cr
            JOIN customer_return_lines crl ON crl.customer_return_id = cr.id
            JOIN product_variants pv ON pv.id = crl.product_variant_id
            JOIN products p ON p.id = pv.product_id AND p.tenant_id = {$tenantId}
            WHERE cr.tenant_id = {$tenantId}
                AND cr.created_at >= '{$startDate}'
                AND cr.created_at <= '{$endDate}'
            AND (
                (p.pli_code IS NOT NULL AND p.pli_code != '')
                OR (pv.nicotine_strength IS NOT NULL AND pv.nicotine_strength > 0)
                OR p.product_type IN ('liquid', 'e-liquid', 'eliquid', 'nicotine')
            )
            GROUP BY pv.flavor, p.name, p.pli_code, pv.barcode, p.barcode, p.sku, cr.reason, cr.created_at
            ORDER BY data_reso
        ");

        // Chiama excel-api direttamente
        $excelApiUrl = rtrim(env('EXCEL_API_URL', 'http://localhost:3001'), '/');
        $endpoint    = $type === 'quindicinale' ? '/genera-excel-quindicinale' : '/genera-excel';

        try {
            $response = Http::timeout(60)
                ->post($excelApiUrl . $endpoint, [
                    'prospetto' => array_map(fn($r) => (array) $r, $prospettoRows),
                    'giacenza'  => array_map(fn($r) => (array) $r, $giacenzaRows),
                    'resi'      => array_map(fn($r) => (array) $r, $resiRows),
                    'periodo'   => $periodoLabel,
                    'tipo'      => $type,
                    'nome_file' => $nomeFile,
                ]);

            if ($response->failed()) {
                return response()->json([
                    'message' => 'Errore durante la generazione Excel. Configura N8N_WEBHOOK_URL o EXCEL_API_URL su Railway.',
                    'detail'  => $response->body(),
                ], 502);
            }

            return response($response->body(), 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => "attachment; filename=\"{$nomeFile}\"",
                'Cache-Control'       => 'no-cache, no-store, must-revalidate',
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Impossibile contattare il servizio di generazione Excel. Configura N8N_WEBHOOK_URL su Railway.',
                'detail'  => $e->getMessage(),
            ], 503);
        }
    }

    public function getHistory(Request $request): JsonResponse
    {
        return response()->json(['data' => []]);
    }
}
