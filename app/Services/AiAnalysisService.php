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
     * Invia il prompt a Gemini REST API.
     */
    public function askGemini(int $tenantId, string $userQuestion, array $chatHistory = []): string
    {
        $apiKey = env('GROQ_API_KEY');
        if (!$apiKey) {
            return "Errore: Chiave API di Groq non configurata nel server.";
        }

        $data = $this->getAggregatedData($tenantId);
        $dataJson = json_encode($data, JSON_UNESCAPED_UNICODE);

        $systemInstruction = "Sei SvaPro AI, l'esperto di Logistica e Fiscalità dello Svapo (SvaPro ERP).
Il tuo compito è analizzare i dati aggregati forniti (giacenze, vendite, resi, promo) e rispondere alla domanda.
NON menzionare mai dati personali. Sii conciso, professionale e diretto al punto.

Se l'utente chiede di 'preparare un riordino', restituisci ESCLUSIVAMENTE un JSON strutturato così (niente markdown fuori):
{
  \"type\": \"action_card\",
  \"action\": \"proponi_riordino\",
  \"payload\": {
    \"motivazione\": \"stringa\",
    \"ordini\": [ { \"from_store_id\": 1, \"to_store_id\": 2, \"product_variant_id\": 1, \"quantity\": 10, \"notes\": \"\" } ]
  }
}
Altrimenti rispondi SEMPRE con un JSON:
{
  \"type\": \"text\",
  \"content\": \"la tua risposta qui...\"
}

Dati:
$dataJson";

        $messages = [
            ['role' => 'system', 'content' => $systemInstruction]
        ];

        // Aggiungi gli ultimi messaggi per il contesto (limitato a 5 dal frontend)
        foreach ($chatHistory as $msg) {
            $messages[] = [
                'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
                'content' => $msg['content']
            ];
        }

        $messages[] = ['role' => 'user', 'content' => "Domanda: $userQuestion"];

        $payload = [
            'model' => 'llama-3.1-8b-instant', // Modello veloce per le query del widget
            'temperature' => 0,
            'response_format' => ['type' => 'json_object'],
            'messages' => $messages
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
            return "Errore Groq " . $response->status();
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
