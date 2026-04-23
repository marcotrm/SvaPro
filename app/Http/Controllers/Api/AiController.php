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

        $request->validate([
            'ordini' => 'required|array',
            'ordini.*.from_store_id' => 'required|integer',
            'ordini.*.to_store_id' => 'required|integer',
            'ordini.*.product_variant_id' => 'required|integer',
            'ordini.*.quantity' => 'required|integer|min:1',
        ]);

        // Raggruppa gli ordini per [from_store_id, to_store_id]
        $groups = collect($request->input('ordini'))->groupBy(function ($item) {
            return $item['from_store_id'] . '-' . $item['to_store_id'];
        });

        $createdCount = 0;
        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            foreach ($groups as $key => $items) {
                list($fromStoreId, $toStoreId) = explode('-', $key);

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
                    'notes'           => 'Generato automaticamente tramite AI Gemini',
                    'created_by'      => $userId,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);

                foreach ($items as $item) {
                    \Illuminate\Support\Facades\DB::table('stock_transfer_items')->insert([
                        'transfer_id'        => $transferId,
                        'product_variant_id' => $item['product_variant_id'],
                        'quantity_sent'      => $item['quantity'],
                        'notes'              => $item['notes'] ?? null,
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }
                $createdCount++;
            }
            \Illuminate\Support\Facades\DB::commit();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            return response()->json(['message' => 'Errore creazione bolle AI: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Create con successo $createdCount bolle di trasferimento in stato Bozza."
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
