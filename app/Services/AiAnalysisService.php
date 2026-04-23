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
        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey) {
            return "Errore: Chiave API di Gemini non configurata nel server.";
        }

        $data = $this->getAggregatedData($tenantId);
        $dataJson = json_encode($data, JSON_UNESCAPED_UNICODE);

        $systemInstruction = "Sei un Esperto di Logica e Fiscalità dello Svapo (SvaPro ERP).
Conosci perfettamente la differenza tra PLI (Prodotti Liquidi da Inalazione con nicotina, soggetti a monopolio) e PL0 (senza nicotina), e l'importanza della tracciabilità dei lotti.
Il tuo compito è analizzare i dati aggregati di vendite e giacenze forniti e rispondere alla domanda dell'utente in modo professionale, conciso e orientato al business.
NON menzionare mai dati personali (che non ti sono stati comunque forniti). Formula tabelle in Markdown se necessario per migliorare la leggibilità.

Dati forniti dal sistema:
$dataJson
";

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => "Domanda dell'utente: $userQuestion"]
                    ]
                ]
            ],
            'systemInstruction' => [
                'role' => 'system',
                'parts' => [
                    ['text' => $systemInstruction]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.4,
                'maxOutputTokens' => 1024,
            ],
            'tools' => [
                [
                    'functionDeclarations' => [
                        [
                            'name' => 'proponi_riordino',
                            'description' => 'Genera una proposta strutturata di riordino merce. Usa questa funzione quando vuoi proporre all\'utente di creare bolle di trasferimento o ordini. L\'utente vedrà la proposta e potrà accettarla.',
                            'parameters' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'motivazione' => [
                                        'type' => 'STRING',
                                        'description' => 'Motivazione discorsiva per cui stai proponendo questo riordino.'
                                    ],
                                    'ordini' => [
                                        'type' => 'ARRAY',
                                        'items' => [
                                            'type' => 'OBJECT',
                                            'properties' => [
                                                'from_store_id' => ['type' => 'INTEGER', 'description' => 'ID negozio mittente (es. 1 per magazzino centrale)'],
                                                'to_store_id' => ['type' => 'INTEGER', 'description' => 'ID negozio destinatario'],
                                                'product_variant_id' => ['type' => 'INTEGER', 'description' => 'ID variante prodotto'],
                                                'quantity' => ['type' => 'INTEGER', 'description' => 'Quantità da trasferire'],
                                                'notes' => ['type' => 'STRING', 'description' => 'Note o nome prodotto']
                                            ]
                                        ]
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ];

        $maxRetries = 2;
        $attempt = 0;

        while ($attempt < $maxRetries) {
            $attempt++;
            try {
                $response = Http::withHeaders([
                    'Content-Type' => 'application/json',
                ])->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", $payload);

                if ($response->successful()) {
                    $result = $response->json();
                    $parts = $result['candidates'][0]['content']['parts'] ?? [];
                    
                    // Controlla se c'è un functionCall
                    foreach ($parts as $part) {
                        if (isset($part['functionCall'])) {
                            $call = $part['functionCall'];
                            if ($call['name'] === 'proponi_riordino') {
                                return json_encode([
                                    'type' => 'action_card',
                                    'action' => 'proponi_riordino',
                                    'payload' => $call['args']
                                ]);
                            }
                        }
                    }

                    if (isset($parts[0]['text'])) {
                        return $parts[0]['text'];
                    }
                    return "Risposta non decifrabile dall'AI.";
                }

                if ($response->status() === 429) {
                    return "Limite di richieste AI superato (Too Many Requests). Attendi un minuto e riprova.";
                }

                if ($response->status() === 503) {
                    if ($attempt < $maxRetries) {
                        sleep(2); // Attendi 2 secondi prima di riprovare
                        continue;
                    }
                    return "I server AI di Google sono momentaneamente sovraccarichi (503). Riprova tra poco.";
                }

                Log::error('Gemini API Error', ['status' => $response->status(), 'body' => $response->body()]);
                return "Errore di comunicazione con i server AI (" . $response->status() . ").";
            } catch (\Exception $e) {
                Log::error('Gemini API Exception', ['message' => $e->getMessage()]);
                return "Errore interno durante la richiesta AI.";
            }
        }
        return "Errore imprevisto durante la comunicazione con l'AI.";
    }

    /**
     * Chiede a Gemini di generare motivazioni per il riordino logistico.
     * Si aspetta un array di alert generati dal Replenishment Engine e restituisce una mappa [product_variant_id => "motivazione"].
     */
    public function generateReorderMotivations(array $alerts): array
    {
        $apiKey = env('GEMINI_API_KEY');
        if (!$apiKey || empty($alerts)) {
            return [];
        }

        // Estrae solo i campi rilevanti per non saturare il token limit
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
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $userPrompt]
                    ]
                ]
            ],
            'systemInstruction' => [
                'role' => 'system',
                'parts' => [
                    ['text' => $systemInstruction]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.2,
                'maxOutputTokens' => 1024,
            ]
        ];

        $maxRetries = 2;
        $attempt = 0;

        while ($attempt < $maxRetries) {
            $attempt++;
            try {
                $response = Http::withHeaders([
                    'Content-Type' => 'application/json',
                ])->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", $payload);

                if ($response->successful()) {
                    $result = $response->json();
                    if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
                        $text = trim($result['candidates'][0]['content']['parts'][0]['text']);
                        // Pulisci eventuale backtick markdown ```json ... ```
                        $text = preg_replace('/^```json\s*/', '', $text);
                        $text = preg_replace('/\s*```$/', '', $text);

                        $json = json_decode($text, true);
                        if (is_array($json)) {
                            return $json;
                        }
                    }
                    return []; // Success but bad json
                }

                if ($response->status() === 503) {
                    if ($attempt < $maxRetries) {
                        sleep(2);
                        continue;
                    }
                }
                
                // Break on other errors (like 429)
                break;
            } catch (\Exception $e) {
                Log::error('Gemini API Reorder Exception', ['message' => $e->getMessage()]);
                break;
            }
        }

        return [];
    }
}
