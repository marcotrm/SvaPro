<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SmartReorderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmartInventoryController extends Controller
{
    public function __construct(private readonly SmartReorderService $service)
    {
    }

    public function preview(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json($this->service->previewForTenant($tenantId));
    }

    public function run(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json($this->service->runForTenant($tenantId));
    }

    public function runAutoToCentral(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json($this->service->runAutoToCentralForTenant($tenantId));
    }
}
