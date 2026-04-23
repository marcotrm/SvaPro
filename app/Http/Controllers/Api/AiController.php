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
}
