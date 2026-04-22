<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReplenishmentEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReplenishmentController extends Controller
{
    public function __construct(private ReplenishmentEngine $engine) {}

    /**
     * GET /api/trigger-replenishment/preview
     * Simula DRP + MRP senza scrivere nulla (dry-run).
     */
    public function preview(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $result   = $this->engine->run($tenantId, dryRun: true);

        return response()->json($result);
    }

    /**
     * POST /api/trigger-replenishment
     * Esegue DRP + MRP in produzione.
     */
    public function trigger(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $result   = $this->engine->run($tenantId, dryRun: false);

        $drpCount = count($result['drp']['transfers_created'] ?? []);
        $mrpCount = count($result['mrp']['orders_created'] ?? []);

        return response()->json([
            ...$result,
            'summary' => "DRP: {$drpCount} trasferimenti creati — MRP: {$mrpCount} ordini d'acquisto creati",
        ]);
    }
}
