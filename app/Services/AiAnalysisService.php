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
        // Vendite degli ultimi 30 giorni aggregate per prodotto e magazzino
        $sales = DB::table('stock_movements')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_movements.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->where('stock_movements.tenant_id', $tenantId)
            ->where('stock_movements.qty', '<', 0) // Uscite/Vendite
            ->where('stock_movements.occurred_at', '>=', now()->subDays(30))
            ->selectRaw('c.name as category, p.name as product, SUM(ABS(stock_movements.qty)) as total_sold')
            ->groupBy('c.name', 'p.name')
            ->orderByDesc('total_sold')
            ->limit(100) // Limitiamo ai top 100 per non eccedere il context limit
            ->get();

        // Giacenze attuali aggregate
        $stock = DB::table('stock_items')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_items.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('p.tenant_id', $tenantId)
            ->where('stock_items.on_hand', '>', 0)
            ->selectRaw('p.name as product, SUM(stock_items.on_hand) as total_stock')
            ->groupBy('p.name')
            ->orderByDesc('total_stock')
            ->limit(100)
            ->get();

        return [
            'vendite_ultimi_30_giorni_top_100' => $sales,
            'giacenze_attuali_top_100' => $stock
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
NON menzionare mai dati personali. Formula tabelle in Markdown se necessario per migliorare la leggibilità.
Dati forniti dal sistema:
$dataJson
";

        $payload = [
            'model' => 'llama3-70b-8192',
            'temperature' => 0, // Precisone chirurgica
            'messages' => [
                ['role' => 'system', 'content' => $systemInstruction],
                ['role' => 'user', 'content' => "Domanda dell'utente: $userQuestion"]
            ],
            'tools' => [
                [
                    'type' => 'function',
                    'function' => [
                        'name' => 'proponi_riordino',
                        'description' => 'Genera una proposta strutturata di riordino merce per trasferire prodotti da un negozio all\'altro.',
                        'parameters' => [
                            'type' => 'object',
                            'properties' => [
                                'motivazione' => [
                                    'type' => 'string',
                                    'description' => 'Motivazione discorsiva per cui stai proponendo questo riordino.'
                                ],
                                'ordini' => [
                                    'type' => 'array',
                                    'items' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'from_store_id' => ['type' => 'integer', 'description' => 'ID negozio mittente (es. 1 per magazzino centrale)'],
                                            'to_store_id' => ['type' => 'integer', 'description' => 'ID negozio destinatario'],
                                            'product_variant_id' => ['type' => 'integer', 'description' => 'ID variante prodotto'],
                                            'quantity' => ['type' => 'integer', 'description' => 'Quantità da trasferire'],
                                            'notes' => ['type' => 'string', 'description' => 'Note o nome prodotto']
                                        ]
                                    ]
                                ]
                            ],
                            'required' => ['motivazione', 'ordini']
                        ]
                    ]
                ]
            ],
            'tool_choice' => 'auto'
        ];

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

            if ($response->successful()) {
                $result = $response->json();
                $message = $result['choices'][0]['message'] ?? [];

                // Controlla se c'è un function call
                if (isset($message['tool_calls']) && is_array($message['tool_calls'])) {
                    foreach ($message['tool_calls'] as $toolCall) {
                        if ($toolCall['function']['name'] === 'proponi_riordino') {
                            $args = json_decode($toolCall['function']['arguments'], true);
                            return json_encode([
                                'type' => 'action_card',
                                'action' => 'proponi_riordino',
                                'payload' => $args
                            ]);
                        }
                    }
                }

                if (isset($message['content'])) {
                    return $message['content'];
                }
                return "Risposta non decifrabile dall'AI.";
            }

            Log::error('Groq API Error', ['status' => $response->status(), 'body' => $response->body()]);
            return "Errore di comunicazione con i server AI (" . $response->status() . "). Controlla il log.";
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
            'model' => 'llama3-70b-8192',
            'temperature' => 0, // Precisione per output JSON
            'messages' => [
                ['role' => 'system', 'content' => $systemInstruction],
                ['role' => 'user', 'content' => $userPrompt]
            ]
        ];

        try {
            $response = Http::withHeaders([
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
