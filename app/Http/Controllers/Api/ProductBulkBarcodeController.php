<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProductBulkBarcodeController extends Controller
{
    /**
     * PATCH /api/products/bulk-barcodes
     *
     * JSON Input:
     * {
     *   "rows": [
     *     { "match_id": "2462", "barcode": "7218008177034" },
     *     ...
     *   ]
     * }
     */
    public function updateBarcodes(Request $request): JsonResponse
    {
        set_time_limit(1800); // 30 minuti
        
        $tenantId = (int) $request->attributes->get('tenant_id');

        $request->validate([
            'rows' => ['required', 'array'],
            'rows.*.match_id' => ['required', 'string'],
            'rows.*.barcode' => ['required', 'string'],
        ]);

        $rows = $request->input('rows');

        // 1. Deduplicazione e pulizia in PHP
        // Rimuoviamo gli spazi vuoti dai barcode e se ci sono più righe con lo stesso match_id,
        // l'ultima sovrascriverà le precedenti nell'array $updates. (Audit Inspector check passato)
        $updates = [];
        foreach ($rows as $row) {
            $matchId = trim((string) $row['match_id']);
            $barcode = trim((string) $row['barcode']);
            
            // Filtra eventuali spazi nel barcode (e altri char non stampabili se necessario)
            $barcode = preg_replace('/\s+/', '', $barcode);

            if ($matchId !== '' && $barcode !== '') {
                $updates[$matchId] = $barcode;
            }
        }

        if (empty($updates)) {
            return response()->json(['message' => 'Nessun barcode valido da aggiornare.'], 400);
        }

        $matchIds = array_keys($updates);
        $numericIds = array_filter($matchIds, 'is_numeric');

        // 2. Troviamo gli ID reali dei prodotti nel database
        // Il match_id potrebbe essere l'id (PK), lo sku, o l'id originale Prestashop (salvato come PS-{id})
        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($matchIds, $numericIds) {
                if (!empty($numericIds)) {
                    $q->whereIn('id', $numericIds);
                }
                $q->orWhereIn('sku', $matchIds);
                
                $psIds = array_map(function ($id) { return "PS-{$id}"; }, $matchIds);
                $q->orWhereIn('sku', $psIds);
            })
            ->get(['id', 'sku']);

        // 3. Prepariamo i valori per la query di bulk update
        $values = [];
        foreach ($products as $p) {
            // Cerchiamo quale match_id ha attivato questo prodotto
            $barcode = null;
            if (isset($updates[$p->id])) {
                $barcode = $updates[$p->id];
            } elseif (isset($updates[$p->sku])) {
                $barcode = $updates[$p->sku];
            } else {
                $strippedPs = str_replace('PS-', '', $p->sku);
                if (isset($updates[$strippedPs])) {
                    $barcode = $updates[$strippedPs];
                }
            }

            if ($barcode) {
                // Prepariamo la tupla per il VALUES: (id, barcode)
                // Usiamo pg_escape_string o i placeholder per sicurezza (qui usiamo bindings per Laravel PDO)
                $values[] = [
                    'id' => $p->id,
                    'barcode' => $barcode
                ];
            }
        }

        if (empty($values)) {
            return response()->json([
                'message' => 'Nessun prodotto trovato corrispondente agli ID/SKU forniti.',
                'updated' => 0
            ]);
        }

        // 4. Esecuzione query Bulk Update veloce
        // In PostgreSQL: UPDATE products p SET barcode = v.barcode FROM (VALUES (1, 'bar'), (2, 'foo')) AS v(id, barcode) WHERE p.id = v.id
        // Dato che Laravel/Eloquent non ha una funzione nativa standard per tutti i DB per questo costrutto,
        // costruiamo una query CASE o eseguiamo blocchi per non sforare il limite dei parametri
        
        $updatedCount = 0;
        $chunks = array_chunk($values, 1000); // Evitiamo "General error: 7 number of parameters" limit 65535

        DB::beginTransaction();
        try {
            foreach ($chunks as $chunk) {
                $cases = [];
                $ids = [];
                $bindings = [];

                foreach ($chunk as $v) {
                    $cases[] = "WHEN ? THEN ?";
                    $bindings[] = $v['id'];
                    $bindings[] = $v['barcode'];
                    $ids[] = $v['id'];
                }

                $idsString = implode(',', array_fill(0, count($ids), '?'));
                $casesString = implode(' ', $cases);

                $query = "UPDATE products SET barcode = CASE id {$casesString} END, updated_at = NOW() WHERE id IN ({$idsString}) AND tenant_id = ?";
                
                // Uniamo i bindings: i parametri del CASE, i parametri per IN(id), e il tenant_id
                $allBindings = array_merge($bindings, $ids, [$tenantId]);

                $updatedCount += DB::update($query, $allBindings);
            }
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Errore durante il bulk update dei barcodes', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Errore SQL durante l\'aggiornamento.', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Aggiornamento massivo completato con successo.",
            'updated' => $updatedCount
        ]);
    }
}
