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

        try {
            // Esecuzione query
            $results = DB::select($sql);
            $resultsArray = json_decode(json_encode($results), true);

            // Protezione Output: Limite 50 righe
            if (count($resultsArray) > 50) {
                $resultsArray = array_slice($resultsArray, 0, 50);
                $resultsArray[] = ['system_warning' => 'Risultato troppo lungo, mostro solo le prime 50 righe. Specifica meglio la query se serve altro'];
            }

            return $resultsArray;

        } catch (\Exception $e) {
            // Error Handling: Rimanda l'errore SQL all'AI
            return [['error' => 'La query è fallita con questo errore: ' . $e->getMessage() . '. Riprova correggendo la sintassi.']];
        }
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

        $metadataPath = storage_path('app/metadata_for_ai.txt');
        $schemaText = file_exists($metadataPath) ? file_get_contents($metadataPath) : 'Schema non disponibile.';

        $systemInstruction = "Tu sei il Master Controller dell'ERP SvaPro. Hai accesso completo in sola lettura ai dati tramite la funzione execute_readonly_query.
Se l'utente ti chiede degli scontrini, dei venduti o di qualsiasi dato, NON dire che non puoi. Invece:
1. Ragiona su quale query SQL servirebbe basandoti su questo schema:
$schemaText
2. Esegui la query tramite il tool execute_readonly_query.
3. Analizza i dati ricevuti e rispondi all'utente in un italiano colloquiale chiaro.
Se non trovi una tabella, chiedi prima di elencare le tabelle disponibili.
Se la query restituisce un errore, riprova correggendo la sintassi SQL.
Se l'utente chiede un riordino, restituisci alla fine un JSON strutturato così:
{ \"type\": \"action_card\", \"action\": \"proponi_riordino\", \"payload\": { \"motivazione\": \"...\", \"ordini\": [ ... ] } }
Altrimenti rispondi SEMPRE con questo formato JSON: { \"type\": \"text\", \"content\": \"La tua risposta qui...\" }";

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
            'messages' => $messages,
            'tools' => $tools,
            'tool_choice' => 'auto'
        ];

        // Log del JSON esatto inviato a Groq
        Log::info("Invio payload a Groq:", ['payload' => json_encode($payload)]);

        try {
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post("https://api.groq.com/openai/v1/chat/completions", $payload);

            if (!$response->successful()) {
                Log::error("Errore Groq API", ['status' => $response->status(), 'body' => $response->body()]);
                return "Errore Groq: " . $response->status();
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
                unset($payload['tools']);
                unset($payload['tool_choice']);
                
                // Rinviamo il risultato al modello
                $finalResponse = Http::withoutVerifying()->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

                if ($finalResponse->successful()) {
                    $message = $finalResponse->json()['choices'][0]['message'];
                } else {
                    Log::error("Errore Groq round " . $rounds, ['status' => $finalResponse->status()]);
                    break;
                }
                $rounds++;
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
