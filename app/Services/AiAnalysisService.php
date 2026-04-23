<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAnalysisService
{
    /**
     * Estrae i dati storici (ultimi 30 giorni) e le giacenze per l'AI.
     * Anonimizza ed aggrega i dati per evitare perdite di info sensibili.
     */
    public function getAggregatedData(int $tenantId): array
    {
        // Vendite recenti
        $sales = DB::table('stock_movements')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_movements.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->where('stock_movements.tenant_id', $tenantId)
            ->where('stock_movements.qty', '<', 0)
            ->where('stock_movements.occurred_at', '>=', now()->subDays(30))
            ->selectRaw('c.name as category, p.name as product, SUM(ABS(stock_movements.qty)) as total_sold')
            ->groupBy('c.name', 'p.name')
            ->orderByDesc('total_sold')
            ->limit(300)
            ->get();

        // Giacenze attuali aggregate (top 300)
        $stock = DB::table('stock_items')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_items.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stores as s', 's.id', '=', 'stock_items.warehouse_id')
            ->where('p.tenant_id', $tenantId)
            ->where('stock_items.on_hand', '>', 0)
            ->selectRaw('s.name as store_name, p.name as product, SUM(stock_items.on_hand) as total_stock')
            ->groupBy('s.name', 'p.name')
            ->orderByDesc('total_stock')
            ->limit(300)
            ->get();

        // Negozi
        $stores = DB::table('stores')->where('tenant_id', $tenantId)->select('id', 'name', 'type', 'is_central')->get();

        // Fornitori
        $suppliers = DB::table('suppliers')->where('tenant_id', $tenantId)->select('id', 'name', 'lead_time_days')->get();

        // Ordini di Acquisto (Bozze o In Attesa)
        $purchaseOrders = DB::table('purchase_orders')
            ->join('suppliers as sup', 'sup.id', '=', 'purchase_orders.supplier_id')
            ->join('stores as s', 's.id', '=', 'purchase_orders.store_id')
            ->where('purchase_orders.tenant_id', $tenantId)
            ->whereIn('purchase_orders.status', ['draft', 'sent', 'partial'])
            ->select('purchase_orders.id', 'purchase_orders.status', 'sup.name as supplier', 's.name as store_name', 'purchase_orders.total_net as total_amount')
            ->get();

        // Trasferimenti Merce
        $transfers = DB::table('stock_transfers')
            ->join('stores as sf', 'sf.id', '=', 'stock_transfers.from_store_id')
            ->join('stores as st', 'st.id', '=', 'stock_transfers.to_store_id')
            ->where('stock_transfers.tenant_id', $tenantId)
            ->whereIn('stock_transfers.status', ['draft', 'shipped'])
            ->select('stock_transfers.id', 'stock_transfers.ddt_number', 'stock_transfers.status', 'sf.name as from_store', 'st.name as to_store')
            ->get();

        return [
            'negozi' => $stores,
            'fornitori' => $suppliers,
            'trasferimenti_attivi' => $transfers,
            'ordini_fornitori_attivi' => $purchaseOrders,
            'vendite_recenti' => $sales,
            'giacenze' => $stock
        ];
    }

    /**
     * Invia il prompt a Gemini REST API.
     */
    public function askGemini(int $tenantId, string $userQuestion): string
    {
        $apiKey = env('GROQ_API_KEY');
        if (!$apiKey) {
            return "Errore: Chiave API di Groq non configurata nel server.";
        }

        $data = $this->getAggregatedData($tenantId);
        $dataJson = json_encode($data, JSON_UNESCAPED_UNICODE);

        $systemInstruction = "Sei un Esperto di Logistica e Fiscalità dello Svapo (SvaPro ERP).
Conosci perfettamente la differenza tra PLI (Prodotti Liquidi da Inalazione con nicotina, soggetti a monopolio) e PL0 (senza nicotina), e l'importanza della tracciabilità dei lotti.
Il tuo compito è analizzare i dati aggregati di vendite e giacenze forniti e rispondere alla domanda dell'utente in modo professionale, conciso e orientato al business.
NON menzionare mai dati personali.

IMPORTANTE: Se l'utente chiede di 'preparare un riordino' o trasferire merce, DEVI rispondere ESCLUSIVAMENTE con un JSON strutturato che segua questo schema (NIENTE markdown, NIENTE testo fuori dal JSON):
{
  \"type\": \"action_card\",
  \"action\": \"proponi_riordino\",
  \"payload\": {
    \"motivazione\": \"stringa\",
    \"ordini\": [
      {
        \"from_store_id\": numero intero (es. 1),
        \"to_store_id\": numero intero,
        \"product_variant_id\": numero intero,
        \"quantity\": numero intero,
        \"notes\": \"stringa\"
      }
    ]
  }
}
Se invece è solo una domanda generica o un consiglio, rispondi con un JSON del genere:
{
  \"type\": \"text\",
  \"content\": \"la tua risposta testuale\"
}

Dati forniti dal sistema:
$dataJson
";

        $payload = [
            'model' => 'llama-3.3-70b-versatile',
            'temperature' => 0, // Precisone chirurgica
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                ['role' => 'system', 'content' => $systemInstruction],
                ['role' => 'user', 'content' => "Domanda dell'utente: $userQuestion"]
            ]
        ];

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

            if ($response->successful()) {
                $result = $response->json();
                $content = $result['choices'][0]['message']['content'] ?? '';
                
                $parsed = json_decode(trim($content), true);
                if (is_array($parsed)) {
                    if (isset($parsed['type']) && $parsed['type'] === 'action_card') {
                        return json_encode($parsed);
                    }
                    if (isset($parsed['type']) && $parsed['type'] === 'text') {
                        return $parsed['content'];
                    }
                }
                return $content ?: "Risposta vuota dall'AI.";
            }

            Log::error('Groq API Error', ['status' => $response->status(), 'body' => $response->body()]);
            return "Errore Groq " . $response->status() . ": " . $response->body();
        } catch (\Exception $e) {
            Log::error('Groq API Exception', ['message' => $e->getMessage()]);
            return "Errore interno durante la richiesta AI.";
        }
    }

    /**
     * Chiede a Gemini di generare motivazioni per il riordino logistico.
     * Si aspetta un array di alert generati dal Replenishment Engine e restituisce una mappa [product_variant_id => "motivazione"].
     */
    public function generateReorderMotivations(array $alerts): array
    {
        $apiKey = env('GROQ_API_KEY');
        if (!$apiKey || empty($alerts)) {
            return [];
        }

        $payloadData = array_map(function ($a) {
            return [
                'id' => $a['product_variant_id'],
                'prodotto' => $a['product_name'],
                'negozio' => $a['store_name'],
                'disp' => $a['available'],
                'venduto_30gg' => $a['sold_qty_window'] ?? 0,
                'suggerito' => $a['suggested_qty'],
            ];
        }, $alerts);

        $systemInstruction = "Sei un Esperto di Logistica e Fiscalità dello Svapo.
Devi analizzare la seguente lista di prodotti in esaurimento (formato JSON) e, per ciascuno, fornire una breve motivazione commerciale/logistica (max 10 parole) sul perché si suggerisce di riordinare quella quantità (es: 'Suggerito +20% per trend di vendita in crescita').
Importante: restituisci SOLO ed esclusivamente un oggetto JSON valido, dove la chiave è l'id (product_variant_id) e il valore è la stringa della motivazione. Nessun markdown aggiuntivo, nessun blocco di codice.";

        $userPrompt = "Analizza questi dati e fornisci il JSON: \n" . json_encode($payloadData, JSON_UNESCAPED_UNICODE);

        $payload = [
            'model' => 'llama-3.3-70b-versatile',
            'temperature' => 0, // Precisione per output JSON
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                ['role' => 'system', 'content' => $systemInstruction],
                ['role' => 'user', 'content' => $userPrompt]
            ]
        ];

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

            if ($response->successful()) {
                $result = $response->json();
                if (isset($result['choices'][0]['message']['content'])) {
                    $text = trim($result['choices'][0]['message']['content']);
                    $text = preg_replace('/^```json\s*/', '', $text);
                    $text = preg_replace('/\s*```$/', '', $text);

                    $json = json_decode($text, true);
                    if (is_array($json)) {
                        return $json;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Groq API Reorder Exception', ['message' => $e->getMessage()]);
        }

        return [];
    }
}
