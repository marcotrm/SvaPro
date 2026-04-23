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
        // Vendite recenti (aggregate)
        $sales = DB::table('stock_movements')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_movements.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stores as s', 's.id', '=', 'stock_movements.warehouse_id')
            ->where('stock_movements.tenant_id', $tenantId)
            ->where('stock_movements.qty', '<', 0)
            ->where('stock_movements.occurred_at', '>=', now()->subDays(30))
            ->selectRaw('s.name as store, p.name as prod, SUM(ABS(stock_movements.qty)) as sold')
            ->groupBy('s.name', 'p.name')
            ->orderByDesc('sold')
            ->limit(100)
            ->get();

        // Giacenze attuali aggregate
        $stock = DB::table('stock_items')
            ->join('product_variants as pv', 'pv.id', '=', 'stock_items.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stores as s', 's.id', '=', 'stock_items.warehouse_id')
            ->where('p.tenant_id', $tenantId)
            ->where('stock_items.on_hand', '>', 0)
            ->selectRaw('s.name as store, p.name as prod, SUM(stock_items.on_hand) as qty')
            ->groupBy('s.name', 'p.name')
            ->orderByDesc('qty')
            ->limit(100)
            ->get();

        // Negozi (ridotti)
        $stores = DB::table('stores')->where('tenant_id', $tenantId)->select('id', 'name')->get();

        // Fornitori (ridotti)
        $suppliers = DB::table('suppliers')->where('tenant_id', $tenantId)->select('id', 'name', 'lead_time_days as lt')->get();

        // Ordini di Acquisto (Bozze o In Attesa)
        $purchaseOrders = DB::table('purchase_orders')
            ->join('suppliers as sup', 'sup.id', '=', 'purchase_orders.supplier_id')
            ->join('stores as s', 's.id', '=', 'purchase_orders.store_id')
            ->where('purchase_orders.tenant_id', $tenantId)
            ->whereIn('purchase_orders.status', ['draft', 'sent', 'partial'])
            ->select('purchase_orders.id', 'purchase_orders.status', 'sup.name as sup', 's.name as store', 'purchase_orders.total_net as tot')
            ->get();

        // Trasferimenti Merce
        $transfers = DB::table('stock_transfers')
            ->join('stores as sf', 'sf.id', '=', 'stock_transfers.from_store_id')
            ->join('stores as st', 'st.id', '=', 'stock_transfers.to_store_id')
            ->where('stock_transfers.tenant_id', $tenantId)
            ->whereIn('stock_transfers.status', ['draft', 'shipped'])
            ->select('stock_transfers.id', 'stock_transfers.status', 'sf.name as from', 'st.name as to')
            ->get();

        // Sessioni di inventario recenti
        $inventories = DB::table('inventory_count_sessions')
            ->join('stores as s', 's.id', '=', 'inventory_count_sessions.warehouse_id')
            ->where('inventory_count_sessions.tenant_id', $tenantId)
            ->select('inventory_count_sessions.id', 's.name as store', 'inventory_count_sessions.status')
            ->orderByDesc('inventory_count_sessions.created_at')
            ->limit(10)
            ->get();

        // Resi recenti
        $returns = DB::table('customer_returns')
            ->where('tenant_id', $tenantId)
            ->select('id', 'status', 'reason')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        // Promozioni attive
        $promotions = DB::table('promotions')
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->where('starts_at', '<=', now())
            ->where(function($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->select('id', 'name', 'type', 'value')
            ->limit(10)
            ->get();

        return [
            'negozi' => $stores,
            'fornitori' => $suppliers,
            'trasferimenti' => $transfers,
            'ordini_fornitore' => $purchaseOrders,
            'vendite_30gg' => $sales,
            'giacenze' => $stock,
            'inventari' => $inventories,
            'resi' => $returns,
            'promo' => $promotions
        ];
    }

    /**
     * Esegue una query SQL in sola lettura in modo sicuro.
     */
    private function executeReadOnlyQuery(string $query): array|string
    {
        // Controllo di sicurezza base per consentire solo SELECT
        if (!preg_match('/^\s*SELECT/i', $query)) {
            return "ERRORE: Sono consentite solo query di tipo SELECT per motivi di sicurezza.";
        }

        try {
            $results = DB::select($query);
            return $results;
        } catch (\Exception $e) {
            return "ERRORE SQL: " . $e->getMessage();
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

        $dictionaryPath = storage_path('app/data_dictionary.json');
        $dictionary = file_exists($dictionaryPath) ? file_get_contents($dictionaryPath) : '{}';

        $systemInstruction = "Tu sei un analista dati integrato in un ERP (SvaPro).
La Regola d'Oro: Niente Documenti, Niente Risposta.
Rispondi SOLO basandoti sui dati forniti nel contesto o ottenuti tramite le tue funzioni (tools). Se la risposta non è deducibile dai dati, rispondi: 'Dato non disponibile nel sistema'. Non stimare, non inventare e non usare conoscenze esterne per i numeri di magazzino.
Inoltre, mostra sempre il Chain of Thought (Ragionamento a catena) per i calcoli prima di dare il suggerimento finale.

Hai a disposizione la funzione 'run_sql_query' per interrogare il database reale dell'ERP.
Questo è il Data Dictionary (schema) del database:
$dictionary

Usa la funzione run_sql_query per interrogare i dati prima di rispondere all'utente.
Se l'utente chiede di 'preparare un riordino', restituisci alla fine un JSON strutturato così:
{
  \"type\": \"action_card\",
  \"action\": \"proponi_riordino\",
  \"payload\": { \"motivazione\": \"...\", \"ordini\": [ ... ] }
}
Altrimenti rispondi SEMPRE con un JSON: { \"type\": \"text\", \"content\": \"...\" }";

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
                    'name' => 'run_sql_query',
                    'description' => 'Esegue una query SQL SELECT in sola lettura sul database ERP per recuperare i dati richiesti.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'query' => [
                                'type' => 'string',
                                'description' => 'La query SQL SELECT da eseguire. Es: SELECT sum(on_hand) FROM stock_items WHERE warehouse_id=1'
                            ]
                        ],
                        'required' => ['query']
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
            // Primo round: chiamata all'API
            $response = Http::withoutVerifying()->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post("https://api.groq.com/openai/v1/chat/completions", $payload);

            if (!$response->successful()) {
                return "Errore Groq: " . $response->status();
            }

            $responseData = $response->json();
            $message = $responseData['choices'][0]['message'];

            // Se l'AI decide di chiamare la funzione
            if (isset($message['tool_calls']) && count($message['tool_calls']) > 0) {
                $messages[] = $message; // Aggiunge il tool_call all'history

                foreach ($message['tool_calls'] as $toolCall) {
                    if ($toolCall['function']['name'] === 'run_sql_query') {
                        $args = json_decode($toolCall['function']['arguments'], true);
                        $sqlQuery = $args['query'] ?? '';
                        $sqlResult = $this->executeReadOnlyQuery($sqlQuery);

                        $messages[] = [
                            'role' => 'tool',
                            'tool_call_id' => $toolCall['id'],
                            'name' => 'run_sql_query',
                            'content' => json_encode($sqlResult, JSON_UNESCAPED_UNICODE)
                        ];
                    }
                }

                // Secondo round: invia i risultati del database all'AI
                $payload['messages'] = $messages;
                unset($payload['tools']); // Per evitare loop infiniti omettiamo i tools al secondo giro
                unset($payload['tool_choice']);
                $payload['response_format'] = ['type' => 'json_object'];

                $finalResponse = Http::withoutVerifying()->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

                if ($finalResponse->successful()) {
                    $message = $finalResponse->json()['choices'][0]['message'];
                }
            }

            $content = $message['content'] ?? '';
            
            // Prova a estrarre un JSON se l'AI lo ha formattato in markdown
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
