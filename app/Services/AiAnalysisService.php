<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiAnalysisService
{
    /**
     * Tool: Esegue una query SQL in sola lettura generata dall'AI.
     */
    private function execute_readonly_query(string $sqlQuery): array
    {
        $sql = trim($sqlQuery);

        // Blocco comandi pericolosi
        if (preg_match('/(UPDATE|DELETE|DROP|ALTER|TRUNCATE|INSERT|CREATE|REPLACE|GRANT|REVOKE)\s/i', $sql)) {
            return [['error' => 'Comandi SQL di modifica bloccati. Usa solo SELECT.']];
        }

        if (!preg_match('/^SELECT\s/i', $sql)) {
            return [['error' => 'Solo le query SELECT sono ammesse.']];
        }

        // Protezione Output: Iniezione automatica del LIMIT 15 se non presente (per risparmiare token)
        if (!preg_match('/\bLIMIT\b/i', $sql)) {
            $sql .= " LIMIT 15";
        }

        try {
            // Esecuzione query
            $results = DB::select($sql);
            $resultsArray = json_decode(json_encode($results), true);

            // Protezione Output fallback
            if (count($resultsArray) > 15) {
                $resultsArray = array_slice($resultsArray, 0, 15);
                $resultsArray[] = ['system_warning' => 'Risultato troppo lungo, mostro solo le prime 15 righe per evitare limiti di memoria.'];
            }

            return $resultsArray;
        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();
            $hint = '';
            
            if (stripos($sql, 'SHOW TABLES') !== false) {
                $hint = " Suggerimento: In PostgreSQL non esiste SHOW TABLES. Consulta lo schema che ti ho fornito (stores, products, stock_items, sales_orders...).";
            }
            
            // Error Handling: Rimanda l'errore SQL all'AI
            return [['error' => 'La query è fallita con questo errore: ' . $errorMsg . '. Riprova correggendo la sintassi.' . $hint]];
        }
    }

    /**
     * Invia il prompt a Gemini REST API con Tool Calling (Function Calling).
     */
    public function askGemini(int $tenantId, string $userQuestion, array $chatHistory = []): string|array
    {
        $apiKey = env('GROQ_API_KEY');
        if (!$apiKey) {
            return "Errore: Chiave API di Groq non configurata nel server.";
        }

        $metadataPath = storage_path('app/metadata_for_ai.txt');
        $schemaText = file_exists($metadataPath) ? file_get_contents($metadataPath) : 'Schema non disponibile.';

        $systemInstruction = <<<EOT
Tu sei il Master Controller dell'ERP SvaPro. Hai accesso completo in sola lettura ai dati tramite la funzione execute_readonly_query.
Se l'utente ti chiede degli scontrini, dei venduti o di qualsiasi dato, NON dire che non puoi. Invece:
1. Ragiona su quale query SQL servirebbe basandoti su questo schema:
$schemaText

MAPPA OBBLIGATORIA DELLE TABELLE:
- Se l'utente chiede giacenze/inventario, usa la tabella: stock_items (unita a products e stores).
- Se l'utente chiede vendite/scontrini/incassi, usa la tabella: sales_orders (e sales_order_lines per il dettaglio).
- Se l'utente chiede bolle/trasferimenti, usa la tabella: stock_transfers (e inventory_count_sessions per conteggi inventario).
- Se l'utente chiede i negozi, usa la tabella: stores.

REGOLE SINTASSI E COLONNE SQL:
- Usa ESCLUSIVAMENTE la sintassi PostgreSQL standard.
- Usa ESATTAMENTE i nomi delle colonne indicati nello schema. Ad esempio, per le vendite usa `grand_total` (NON total_amount). Non inventare MAI nomi di colonne o tabelle.
- Per la data di oggi usa CURRENT_DATE.
- Non usare MAI comandi come SHOW TABLES.

2. ESECUZIONE OBBLIGATORIA DEL TOOL:
DEVI TASSATIVAMENTE chiamare il tool `execute_readonly_query` per leggere i dati REALI dal database PRIMA di generare la risposta finale. Non inventare MAI i dati! Esegui prima la query!
Se il tool ti restituisce un errore SQL (es. colonna non trovata), NON fermarti e NON scusarti con l'utente: esegui immediatamente un'altra chiamata al tool con la query corretta!

3. Analizza i dati ricevuti dal database e POI rispondi all'utente.
NON INVENTARE MAI GLI ORDINI. DEVI PRIMA ESTRARRE I VERI DATI DAL DATABASE (es. prodotti con on_hand < 10)!

REGOLA FONDAMENTALE SULL'OUTPUT FINALE:
Quando hai i dati reali dal database, devi SEMPRE rispondere con un SINGOLO oggetto JSON valido:

OPZIONE A (Schedina di Riordino):
USA QUESTA OPZIONE SE l'utente chiede "analizza vendite", "prevedi scorte", "quali prodotti stanno finendo", o "riordino".
Metti nel JSON i VERI `product_variant_id` e `store_id` che hai trovato nel database. (L'esempio sotto usa ID finti, tu usa i veri).
{ "type": "action_card", "action": "proponi_riordino", "payload": { "motivazione": "Ho trovato X prodotti in esaurimento...", "ordini": [ { "from_store_id": 1, "to_store_id": 1, "product_variant_id": 123, "quantity": 10, "notes": "scorta bassa" } ] } }

OPZIONE B (Risposta Testuale Standard):
USA QUESTA OPZIONE per tutto il resto (es. scontrini, resoconti, chiacchiere).
{ "type": "text", "content": "La tua risposta colloquiale qui..." }
EOT;

        $messages = [
            ['role' => 'system', 'content' => $systemInstruction]
        ];

        foreach ($chatHistory as $msg) {
            $msgRole = ($msg['role'] === 'user') ? 'user' : 'assistant';
            $messages[] = [
                'role' => $msgRole,
                'content' => $msg['content']
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $userQuestion];

        $tools = [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'execute_readonly_query',
                    'description' => 'Esegue una query SQL SELECT sul database di produzione per ottenere qualsiasi dato richiesto dall\'utente.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'sql_query' => [
                                'type' => 'string',
                                'description' => 'La query SQL (solo SELECT) da eseguire sul database.'
                            ]
                        ],
                        'required' => ['sql_query']
                    ]
                ]
            ]
        ];

        $payload = [
            'model' => 'llama-3.1-8b-instant',
            'temperature' => 0,
            'max_tokens' => 800,
            'messages' => $messages,
            'tools' => $tools,
            'tool_choice' => 'auto',
            'parallel_tool_calls' => false
        ];

        // Helper function for API calls with retry
        $makeApiCall = function($payload) use ($apiKey) {
            $maxRetries = 2;
            $retryDelay = 3; // seconds
            
            for ($i = 0; $i <= $maxRetries; $i++) {
                $response = Http::withoutVerifying()->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])->timeout(30)->post("https://api.groq.com/openai/v1/chat/completions", $payload);

                if ($response->successful()) {
                    return $response;
                }
                
                if ($response->status() === 429 && $i < $maxRetries) {
                    Log::warning("Groq Rate Limit (429). Retrying in {$retryDelay}s...");
                    sleep($retryDelay);
                    $retryDelay *= 2; // Exponential backoff
                    continue;
                }
                
                return $response; // Return the failed response if not 429 or max retries reached
            }
            return null;
        };

        $response = $makeApiCall($payload);

        if (!$response || !$response->successful()) {
            $status = $response ? $response->status() : 'Timeout';
            Log::error("Errore Groq API", ['status' => $status, 'body' => $response ? $response->body() : '']);
            return "Il sistema AI è momentaneamente sovraccarico (Limite Token API). Riprova tra 10 secondi.";
        }

            $responseData = $response->json();
            $message = $responseData['choices'][0]['message'];

            // Tool Calling Loop (esegue query finché Groq non è soddisfatto o si arrende, limitato a 3 round max per evitare loop infiniti)
            $rounds = 0;
            while (isset($message['tool_calls']) && count($message['tool_calls']) > 0 && $rounds < 3) {
                Log::info("Groq ha chiamato un tool:", ['tool_calls' => $message['tool_calls']]);
                $messages[] = $message;

                foreach ($message['tool_calls'] as $toolCall) {
                    $args = json_decode($toolCall['function']['arguments'], true);
                    $resultData = [];
                    
                    if ($toolCall['function']['name'] === 'execute_readonly_query') {
                        $sqlQuery = $args['sql_query'] ?? '';
                        Log::info("L'AI sta pensando/eseguendo la query:", ['sql' => $sqlQuery]);
                        $resultData = $this->execute_readonly_query($sqlQuery);
                    }
                    
                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $toolCall['id'],
                        'name' => $toolCall['function']['name'],
                        'content' => json_encode($resultData, JSON_UNESCAPED_UNICODE)
                    ];
                }

                $payload['messages'] = $messages;
                
                // Rinviamo il risultato al modello. NON rimuoviamo i tools così può riprovare se ha sbagliato.
                $finalResponse = $makeApiCall($payload);

                if ($finalResponse && $finalResponse->successful()) {
                    $message = $finalResponse->json()['choices'][0]['message'];
                } else {
                    $status = $finalResponse ? $finalResponse->status() : 'Timeout';
                    Log::error("Errore Groq round " . $rounds, ['status' => $status, 'body' => $finalResponse ? $finalResponse->body() : '']);
                    break;
                }
                $rounds++;
            }

            $content = $message['content'] ?? '';
            Log::info("Risposta finale Groq:", ['content' => $content]);
            
            $cleanContent = trim($content);
            if (preg_match('/^```json\s*(.*?)\s*```$/s', $cleanContent, $matches)) {
                $cleanContent = trim($matches[1]);
            } elseif (preg_match('/^```\s*(.*?)\s*```$/s', $cleanContent, $matches)) {
                $cleanContent = trim($matches[1]);
            }

            $parsed = json_decode($cleanContent, true);
            if (is_array($parsed)) {
                if (isset($parsed['type']) && in_array($parsed['type'], ['action_card', 'text'])) {
                    return $parsed['type'] === 'action_card' ? $parsed : $parsed['content'];
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
            'model' => 'llama-3.3-70b-versatile',
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
