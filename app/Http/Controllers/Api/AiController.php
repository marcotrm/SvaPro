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
            'question' => 'required|string|max:1000'
        ]);

        $question = $request->input('question');
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

            // Recupera il fornitore (default_supplier_id) per ogni prodotto
            $variantIds = array_column($ordiniPuliti, 'product_variant_id');
            $variantsSuppliers = \Illuminate\Support\Facades\DB::table('product_variants')
                ->join('products', 'products.id', '=', 'product_variants.product_id')
                ->whereIn('product_variants.id', $variantIds)
                ->pluck('products.default_supplier_id', 'product_variants.id')
                ->toArray();

            // Raggruppa gli ordini per [from_store_id, to_store_id, supplier_id]
            foreach ($ordiniPuliti as &$item) {
                $supplierId = $variantsSuppliers[$item['product_variant_id']] ?? 0;
                $item['group_key'] = $item['from_store_id'] . '-' . $item['to_store_id'] . '-' . $supplierId;
            }

            $groups = collect($ordiniPuliti)->groupBy('group_key');

            $createdCount = 0;
            $createdIds = [];
            \Illuminate\Support\Facades\DB::beginTransaction();

            foreach ($groups as $key => $items) {
                list($fromStoreId, $toStoreId, $supplierId) = explode('-', $key);

                $lastNum = \Illuminate\Support\Facades\DB::table('stock_transfers')
                    ->where('tenant_id', $tenantId)
                    ->whereYear('created_at', now()->year)
                    ->count();
                $ddtNumber = 'AI-DDT-' . now()->year . '-' . str_pad($lastNum + 1, 4, '0', STR_PAD_LEFT);

                $transferId = \Illuminate\Support\Facades\DB::table('stock_transfers')->insertGetId([
                    'tenant_id'       => $tenantId,
                    'ddt_number'      => $ddtNumber,
                    'from_store_id'   => $fromStoreId,
                    'to_store_id'     => $toStoreId,
                    'status'          => 'draft',
                    'notes'           => 'Generato automaticamente tramite AI Groq' . ($supplierId ? " (Fornitore ID: $supplierId)" : ''),
                    'created_by'      => $userId,
                    'is_ai_generated' => true,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);

                $createdIds[] = $transferId;

                foreach ($items as $item) {
                    \Illuminate\Support\Facades\DB::table('stock_transfer_items')->insert([
                        'transfer_id'        => $transferId,
                        'product_variant_id' => $item['product_variant_id'],
                        'quantity_sent'      => $item['quantity'],
                        'notes'              => $item['notes'],
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }
                $createdCount++;
            }
            \Illuminate\Support\Facades\DB::commit();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            \Illuminate\Support\Facades\Log::error('Errore creazione bolle AI: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json(['message' => 'Errore creazione bolle AI: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Create con successo $createdCount bolle di trasferimento.",
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
