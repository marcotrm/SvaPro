<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\AiAnalysisService;

class AiController extends Controller
{
    protected AiAnalysisService $aiService;

    public function __construct(AiAnalysisService $aiService)
    {
        $this->aiService = $aiService;
    }

    public function askAdvice(Request $request)
    {
        $tenantId = (int)$request->attributes->get('tenant_id');
        
        $request->validate([
            'question' => 'required|string|max:1000',
            'context_url' => 'nullable|string',
            'page_data' => 'nullable|array' // opzionale se il frontend passa dati
        ]);

        $question = $request->input('question');
        $contextUrl = $request->input('context_url');
        
        if ($contextUrl) {
            $question = "[CONTESTO: L'utente si trova attualmente nella rotta: $contextUrl]\nDomanda: " . $question;
        }

        $answer = $this->aiService->askGemini($tenantId, $question);

        return response()->json([
            'answer' => $answer
        ]);
    }

    public function acceptReorder(Request $request)
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $userId   = $request->attributes->get('user_id');

        \Illuminate\Support\Facades\Log::info("Dati ricevuti dall'AI per la bolla:", $request->all());

        try {
            // Pulizia dei dati se arrivano "sporchi"
            $ordiniRaw = $request->input('ordini', []);
            $ordiniPuliti = array_map(function($item) {
                $fromId = !empty($item['from_store_id']) ? (int) $item['from_store_id'] : 1;
                $toId = !empty($item['to_store_id']) ? (int) $item['to_store_id'] : 1;
                // Previene l'errore del DB se il DB non ha id 0 per il magazzino centrale
                if ($fromId === 0) $fromId = 1;
                if ($toId === 0) $toId = 1;

                return [
                    'from_store_id' => $fromId,
                    'to_store_id' => $toId,
                    'product_variant_id' => !empty($item['product_variant_id']) ? (int) $item['product_variant_id'] : 0,
                    'quantity' => !empty($item['quantity']) ? (int) $item['quantity'] : 1,
                    'notes' => !empty($item['notes']) ? $item['notes'] : 'Proposta AI',
                ];
            }, $ordiniRaw);

            // Filtra ordini non validi (es. product_variant_id a 0)
            $ordiniPuliti = array_filter($ordiniPuliti, fn($o) => $o['product_variant_id'] > 0);

            if (empty($ordiniPuliti)) {
                return response()->json(['message' => 'Nessun ordine valido trovato nei dati AI.'], 400);
            }

            // Recupera il fornitore e i prezzi per ogni prodotto
            $variantIds = array_column($ordiniPuliti, 'product_variant_id');
            $variantsInfo = \Illuminate\Support\Facades\DB::table('product_variants')
                ->join('products', 'products.id', '=', 'product_variants.product_id')
                ->whereIn('product_variants.id', $variantIds)
                ->select('product_variants.id', 'product_variants.cost_price', 'products.default_supplier_id')
                ->get()
                ->keyBy('id');

            // Trova un supplier di fallback se alcuni prodotti non ne hanno uno (es. il primo fornitore disponibile)
            $fallbackSupplier = \Illuminate\Support\Facades\DB::table('suppliers')
                ->where('tenant_id', $tenantId)
                ->first();
            $fallbackSupplierId = $fallbackSupplier ? $fallbackSupplier->id : 1; // 1 come ultimate fallback

            // Raggruppa gli ordini per supplier_id
            foreach ($ordiniPuliti as &$item) {
                $info = $variantsInfo->get($item['product_variant_id']);
                $item['supplier_id'] = ($info && $info->default_supplier_id) ? $info->default_supplier_id : $fallbackSupplierId;
                $item['unit_cost'] = $info ? ($info->cost_price ?: 0) : 0;
            }

            $groups = collect($ordiniPuliti)->groupBy('supplier_id');

            $createdCount = 0;
            $createdIds = [];
            \Illuminate\Support\Facades\DB::beginTransaction();

            foreach ($groups as $supplierId => $items) {
                // Calcola il totale netto dell'ordine
                $totalNet = $items->sum(function ($item) {
                    return $item['quantity'] * $item['unit_cost'];
                });

                $orderId = \Illuminate\Support\Facades\DB::table('purchase_orders')->insertGetId([
                    'tenant_id'       => $tenantId,
                    'supplier_id'     => $supplierId,
                    'status'          => 'draft',
                    'total_net'       => $totalNet,
                    'is_ai_generated' => true,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);

                $createdIds[] = $orderId;

                foreach ($items as $item) {
                    \Illuminate\Support\Facades\DB::table('purchase_order_lines')->insert([
                        'purchase_order_id'  => $orderId,
                        'product_variant_id' => $item['product_variant_id'],
                        'qty'                => $item['quantity'],
                        'unit_cost'          => $item['unit_cost'],
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }
                $createdCount++;
            }
            \Illuminate\Support\Facades\DB::commit();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            \Illuminate\Support\Facades\Log::error('Errore creazione PO AI: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json(['message' => 'Errore creazione PO AI: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Creati con successo $createdCount ordini di acquisto.",
            'created_ids' => $createdIds
        ]);
    }

    public function testSemplice()
    {
        $apiKey = env('GROQ_API_KEY');
        if (!$apiKey) {
            return response()->json(['error' => 'Chiave API mancante in .env'], 500);
        }

        $payload = [
            'model' => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'user', 'content' => 'Ciao']
            ]
        ];

        $response = \Illuminate\Support\Facades\Http::withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ])->post("https://api.groq.com/openai/v1/chat/completions", $payload);

        return response()->json([
            'status' => $response->status(),
            'body' => $response->json(),
            'raw_error' => $response->body()
        ]);
    }
}
