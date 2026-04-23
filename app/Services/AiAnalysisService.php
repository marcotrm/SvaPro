<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAnalysisService
{
    /**
     * Estrae i dati storici di base (Negozi, Fornitori) per dare contesto generale all'AI.
     */
    public function getBasicContext(int $tenantId): array
    {
        $stores = DB::table('stores')->where('tenant_id', $tenantId)->select('id', 'name')->get();
        $suppliers = DB::table('suppliers')->where('tenant_id', $tenantId)->select('id', 'name')->get();
        
        return [
            'negozi_registrati' => $stores,
            'fornitori_registrati' => $suppliers
        ];
    }

    /**
     * Tool: Ottiene la giacenza di un prodotto.
     */
    private function get_stock_data(string $productName = null, string $storeName = null): array
    {
        $query = DB::table('stock_items')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_items.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stores as s', 's.id', '=', 'stock_items.warehouse_id');
            
        if ($productName) {
            $query->where('p.name', 'like', '%' . $productName . '%');
        }
        if ($storeName) {
            $query->where('s.name', 'like', '%' . $storeName . '%');
        }

        return $query->select('s.name as store', 'p.name as product', 'stock_items.on_hand')
                     ->limit(50)->get()->toArray();
    }

    /**
     * Tool: Ottiene i dati di vendita recenti.
     */
    private function get_sales_data(string $productName = null, string $storeName = null, int $days = 30): array
    {
        $query = DB::table('stock_movements')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_movements.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stores as s', 's.id', '=', 'stock_movements.warehouse_id')
            ->where('stock_movements.qty', '<', 0)
            ->where('stock_movements.occurred_at', '>=', now()->subDays($days));

        if ($productName) {
            $query->where('p.name', 'like', '%' . $productName . '%');
        }
        if ($storeName) {
            $query->where('s.name', 'like', '%' . $storeName . '%');
        }

        return $query->selectRaw('s.name as store, p.name as product, SUM(ABS(stock_movements.qty)) as sold')
                     ->groupBy('s.name', 'p.name')
                     ->orderByDesc('sold')
                     ->limit(50)->get()->toArray();
    }

    /**
     * Tool: Ottiene le bolle di inventario (sessioni di conteggio).
     */
    private function get_inventory_sessions(string $storeName = null): array
    {
        $query = DB::table('inventory_count_sessions')
            ->join('stores as s', 's.id', '=', 'inventory_count_sessions.warehouse_id');

        if ($storeName) {
            $query->where('s.name', 'like', '%' . $storeName . '%');
        }

        return $query->select('inventory_count_sessions.id as numero_bolla', 's.name as store', 'inventory_count_sessions.status', 'inventory_count_sessions.created_at')
                     ->orderByDesc('inventory_count_sessions.created_at')
                     ->limit(10)->get()->toArray();
    }

    /**
     * Tool: Ottiene le bolle di trasferimento merce.
     */
    private function get_stock_transfers(string $storeName = null): array
    {
        $query = DB::table('stock_transfers')
            ->join('stores as sf', 'sf.id', '=', 'stock_transfers.from_store_id')
            ->join('stores as st', 'st.id', '=', 'stock_transfers.to_store_id');

        if ($storeName) {
            $query->where(function($q) use ($storeName) {
                $q->where('sf.name', 'like', '%' . $storeName . '%')
                  ->orWhere('st.name', 'like', '%' . $storeName . '%');
            });
        }

        return $query->select('stock_transfers.id as numero_bolla', 'sf.name as from_store', 'st.name as to_store', 'stock_transfers.status')
                     ->orderByDesc('stock_transfers.created_at')
                     ->limit(10)->get()->toArray();
    }

    /**
     * Invia il prompt a Gemini REST API con Tool Calling (Function Calling).
     */
    public function askGemini(int $tenantId, string $userQuestion, array $chatHistory = []): string
    {
        $apiKey = env('GROQ_API_KEY');
        if (!$apiKey) {
            return "Errore: Chiave API di Groq non configurata nel server.";
        }

        // Recuperiamo il contesto base per l'AI
        $basicContext = json_encode($this->getBasicContext($tenantId), JSON_UNESCAPED_UNICODE);

        $systemInstruction = "Tu sei un analista dati integrato in un ERP (SvaPro).
La Regola d'Oro: Niente Documenti, Niente Risposta.
Rispondi SOLO basandoti sui dati ottenuti tramite le tue funzioni (tools) o forniti nel Contesto Base.
Quando usi una funzione, trasforma il JSON restituito in una frase colloquiale in italiano. Non restituire mai JSON grezzo all'utente.
NON devi MAI rispondere a domande sui numeri di magazzino o vendite senza prima chiamare una delle funzioni di database.
Se la risposta non è deducibile, rispondi: 'Dato non disponibile nel sistema'. Non stimare o inventare nulla.

[Contesto Base di SvaPro (Usa queste info per rispondere a domande generiche su quali negozi o fornitori esistono)]
$basicContext

Hai a disposizione queste funzioni sicure:
1. get_stock_data: per conoscere le giacenze attuali di un prodotto o negozio.
2. get_sales_data: per conoscere le vendite di un prodotto in un arco di tempo.
3. get_inventory_sessions: per conoscere le 'bolle inventario' (sessioni di conteggio e stato).
4. get_stock_transfers: per conoscere le 'bolle di trasferimento' tra negozi.

Se l'utente chiede di 'preparare un riordino', restituisci alla fine un JSON strutturato così:
{
  \"type\": \"action_card\",
  \"action\": \"proponi_riordino\",
  \"payload\": { \"motivazione\": \"...\", \"ordini\": [ ... ] }
}
Altrimenti rispondi SEMPRE con questo formato JSON: { \"type\": \"text\", \"content\": \"La tua risposta colloquiale e discorsiva qui...\" }";

        $messages = [
            ['role' => 'system', 'content' => $systemInstruction]
        ];

        foreach ($chatHistory as $msg) {
            $messages[] = [
                'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
                'content' => $msg['content']
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $userQuestion];

        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_stock_data',
                    'description' => 'Usa questa funzione per ottenere la giacenza reale di un prodotto in un determinato negozio.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'product_name' => ['type' => 'string', 'description' => 'Nome opzionale del prodotto da cercare'],
                            'store_name' => ['type' => 'string', 'description' => 'Nome opzionale del negozio da cercare']
                        ]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_sales_data',
                    'description' => 'Usa questa funzione per ottenere i dati di vendita di un prodotto in un determinato negozio.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'product_name' => ['type' => 'string', 'description' => 'Nome opzionale del prodotto'],
                            'store_name' => ['type' => 'string', 'description' => 'Nome opzionale del negozio'],
                            'days' => ['type' => 'integer', 'description' => 'Giorni indietro da controllare (es. 30)']
                        ]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_inventory_sessions',
                    'description' => 'Usa questa funzione per ottenere le bolle inventario (sessioni di conteggio in negozio) e il loro stato.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'store_name' => ['type' => 'string', 'description' => 'Nome opzionale del negozio da filtrare']
                        ]
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_stock_transfers',
                    'description' => 'Usa questa funzione per ottenere le bolle di trasferimento merce tra negozi.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'store_name' => ['type' => 'string', 'description' => 'Nome opzionale del negozio da filtrare (mittente o destinatario)']
                        ]
                    ]
                ]
            ]
        ];

        $payload = [
            'model' => 'llama-3.1-8b-instant',
            'temperature' => 0,
            'messages' => $messages,
            'tools' => $tools,
            'tool_choice' => 'auto'
        ];

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post("https://api.groq.com/openai/v1/chat/completions", $payload);

            if (!$response->successful()) {
                return "Errore Groq: " . $response->status();
            }

            $responseData = $response->json();
            $message = $responseData['choices'][0]['message'];

            // Tool Calling
            if (isset($message['tool_calls']) && count($message['tool_calls']) > 0) {
                Log::info("Groq ha chiamato dei tools!", ['tool_calls' => $message['tool_calls']]);
                $messages[] = $message;

                foreach ($message['tool_calls'] as $toolCall) {
                    $args = json_decode($toolCall['function']['arguments'], true);
                    $resultData = [];
                    
                    if ($toolCall['function']['name'] === 'get_stock_data') {
                        $resultData = $this->get_stock_data($args['product_name'] ?? null, $args['store_name'] ?? null);
                    } elseif ($toolCall['function']['name'] === 'get_sales_data') {
                        $resultData = $this->get_sales_data($args['product_name'] ?? null, $args['store_name'] ?? null, $args['days'] ?? 30);
                    } elseif ($toolCall['function']['name'] === 'get_inventory_sessions') {
                        $resultData = $this->get_inventory_sessions($args['store_name'] ?? null);
                    } elseif ($toolCall['function']['name'] === 'get_stock_transfers') {
                        $resultData = $this->get_stock_transfers($args['store_name'] ?? null);
                    }
                    
                    Log::info("Tool eseguito: " . $toolCall['function']['name'], ['args' => $args, 'results_count' => count($resultData)]);

                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $toolCall['id'],
                        'name' => $toolCall['function']['name'],
                        'content' => json_encode($resultData, JSON_UNESCAPED_UNICODE)
                    ];
                }

                $payload['messages'] = $messages;
                unset($payload['tools']);
                unset($payload['tool_choice']);
                $payload['response_format'] = ['type' => 'json_object'];

                $finalResponse = Http::withoutVerifying()->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

                if ($finalResponse->successful()) {
                    $message = $finalResponse->json()['choices'][0]['message'];
                    Log::info("Risposta finale Groq:", ['message' => $message]);
                } else {
                    Log::error("Errore secondo round Groq", ['status' => $finalResponse->status(), 'body' => $finalResponse->body()]);
                }
            } else {
                Log::info("Groq NON ha chiamato tools. Ha risposto:", ['content' => $message['content']]);
            }

            $content = $message['content'] ?? '';
            
            $cleanContent = trim($content);
            if (preg_match('/^```json\s*(.*?)\s*```$/s', $cleanContent, $matches)) {
                $cleanContent = trim($matches[1]);
            } elseif (preg_match('/^```\s*(.*?)\s*```$/s', $cleanContent, $matches)) {
                $cleanContent = trim($matches[1]);
            }

            $parsed = json_decode($cleanContent, true);
            if (is_array($parsed)) {
                if (isset($parsed['type']) && in_array($parsed['type'], ['action_card', 'text'])) {
                    return $parsed['type'] === 'action_card' ? json_encode($parsed) : $parsed['content'];
                }
            }
            return $content ?: "Dato non disponibile nel sistema.";
            
        } catch (\Exception $e) {
            Log::error('Groq API Exception', ['message' => $e->getMessage()]);
            return "Errore interno durante la richiesta AI.";
        }
    }

    /**
     * Chiede a Gemini di generare motivazioni per il riordino logistico.
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
Analizza i prodotti in JSON e fornisci una motivazione di max 10 parole per ogni riordino.
Restituisci SOLO un JSON: { \"id_prodotto\": \"motivazione\" }.";

        $userPrompt = "Dati: " . json_encode($payloadData, JSON_UNESCAPED_UNICODE);

        $payload = [
            'model' => 'llama-3.3-70b-versatile', // Modello pesante per analisi logiche
            'temperature' => 0,
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
                    $json = json_decode($text, true);
                    if (is_array($json)) return $json;
                }
            }
        } catch (\Exception $e) {
            Log::error('Groq API Reorder Exception', ['message' => $e->getMessage()]);
        }

        return [];
    }
}
