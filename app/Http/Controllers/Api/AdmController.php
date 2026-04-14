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
     * Chiama direttamente l'excel-api su Railway con i dati del DB.
     *
     * POST /api/adm/generate-report
     * Body: { type: 'mensile'|'quindicinale', year: '2025', month: '07', half: 1|2 }
     */
    public function generateReport(Request $request): Response|JsonResponse
    {
        $validated = $request->validate([
            'type'  => ['required', 'in:mensile,quindicinale'],
            'year'  => ['required', 'digits:4', 'integer', 'min:2020', 'max:2030'],
            'month' => ['required', 'digits_between:1,2', 'integer', 'min:1', 'max:12'],
            'half'  => ['nullable', 'integer', 'in:1,2'], // solo per quindicinale
        ]);

        $tenantId = (int) $request->attributes->get('tenant_id');
        $year  = (int) $validated['year'];
        $month = (int) $validated['month'];
        $type  = $validated['type'];
        $half  = (int) ($validated['half'] ?? 1);

        // Calcola range date
        if ($type === 'mensile') {
            $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
            $lastDay   = cal_days_in_month(CAL_GREGORIAN, $month, $year);
            $endDate   = sprintf('%04d-%02d-%02d 23:59:59', $year, $month, $lastDay);
            $periodoLabel = sprintf('%02d/%d', $month, $year);
            $tipoFile = 'mensile';
        } else {
            if ($half === 1) {
                $startDate = sprintf('%04d-%02d-01 00:00:00', $year, $month);
                $endDate   = sprintf('%04d-%02d-15 23:59:59', $year, $month);
                $halfNum   = '1Q';
            } else {
                $lastDay  = cal_days_in_month(CAL_GREGORIAN, $month, $year);
                $startDate = sprintf('%04d-%02d-16 00:00:00', $year, $month);
                $endDate   = sprintf('%04d-%02d-%02d 23:59:59', $year, $month, $lastDay);
                $halfNum   = '2Q';
            }
            $periodoLabel = sprintf('%s%02d%d', $halfNum, $month, $year);
            $tipoFile = 'quindicinale';
        }

        // ─── Tenant info ─────────────────────────────────────────────
        $tenant = DB::table('tenants')
            ->where('id', $tenantId)
            ->first(['name', 'vat_number', 'settings_json']);

        $settings = json_decode($tenant?->settings_json ?? '{}', true);
        $tenantInfo = [
            'ragione_sociale' => $tenant?->name ?? 'N/D',
            'partita_iva'     => $tenant?->vat_number ?? 'N/D',
            'codice_imposta'  => $settings['depositary_pli_code'] ?? 'N/D',
        ];

        // ─── Prospetto: vendite aggregati per prodotto ───────────────
        $finePeriodo = $type === 'mensile'
            ? \Carbon\Carbon::parse($endDate)->format('d/m/Y')
            : \Carbon\Carbon::parse($endDate)->format('d/m/Y');

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

        // ─── Giacenza: stock finale per variante ─────────────────────
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

        // ─── Resi: resi nel periodo ───────────────────────────────────
        $resiRows = DB::select("
            SELECT
                COALESCE(NULLIF(pv.flavor, ''), p.name) AS denominazione_prodotto,
                COALESCE(NULLIF(p.pli_code, ''), pv.barcode, p.barcode, p.sku) AS codice_prodotto,
                SUM(crl.qty)::integer AS quantita_resa,
                cr.reason AS motivo_reso,
                TO_CHAR(cr.created_at, 'DD/MM/YYYY') AS data_reso
            FROM customer_returns cr
            JOIN customer_return_lines crl ON crl.return_id = cr.id
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

        // Determina nome file
        $nomeFile = 'SVAPOGROUPSRL' . $periodoLabel . '.xlsx';

        // ─── Chiama excel-api su Railway ─────────────────────────────
        $excelApiUrl = rtrim(config('services.excel_api.url', env('EXCEL_API_URL', 'http://localhost:3001')), '/');
        $endpoint    = $type === 'quindicinale' ? '/genera-excel-quindicinale' : '/genera-excel';

        try {
            $response = Http::timeout(60)
                ->withHeaders(['Content-Type' => 'application/json'])
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
                    'message' => 'Errore durante la generazione del file Excel. Verifica che il servizio excel-api sia online.',
                    'detail'  => $response->body(),
                ], 502);
            }

            // Stream the Excel file back to browser
            return response($response->body(), 200, [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $nomeFile . '"',
                'Cache-Control'       => 'no-cache, no-store, must-revalidate',
                'Pragma'              => 'no-cache',
                'Expires'             => '0',
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Impossibile contattare il servizio di generazione Excel.',
                'detail'  => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Restituisce l'elenco degli ultimi report generati (da un log o tabella).
     * Per ora restituisce un placeholder.
     */
    public function getHistory(Request $request): JsonResponse
    {
        // TODO: implementare una tabella adm_report_history per storico
        return response()->json(['data' => []]);
    }
}
