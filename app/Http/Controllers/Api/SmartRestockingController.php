<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SmartRestockingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SmartRestockingController extends Controller
{
    public function __construct(private readonly SmartRestockingService $service) {}

    /* ─── GET /api/smart-restocking/status ─────────────────────────────── */
    public function status(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $lastRun = $this->service->getLastRun($tenantId);
            return response()->json([
                'last_run' => $lastRun,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['last_run' => null, '_error' => $e->getMessage()]);
        }
    }

    /* ─── POST /api/smart-restocking/calculate ──────────────────────────── */
    /**
     * Forza il calcolo fabbisogno manualmente.
     * Genera bozze DDT (Flusso A) e bozze PO (Flusso B).
     */
    public function calculate(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $result = $this->service->calculate($tenantId, 'manual');
            return response()->json(['ok' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('SmartRestocking calculate error: ' . $e->getMessage());
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 200);
        }
    }

    /* ─── GET /api/smart-restocking/network-needs ───────────────────────── */
    /**
     * Legge i dati di fabbisogno della rete negozi (Flusso A).
     * Non genera nulla — solo visualizzazione.
     */
    public function networkNeeds(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $data = $this->service->getNetworkNeeds($tenantId);
            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return response()->json(['data' => ['stores' => [], 'total_stores' => 0], '_error' => $e->getMessage()]);
        }
    }

    /* ─── GET /api/smart-restocking/depot-needs ─────────────────────────── */
    /**
     * Legge i dati di fabbisogno del deposito centrale (Flusso B).
     * Non genera nulla — solo visualizzazione.
     */
    public function depotNeeds(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $data = $this->service->getDepotNeeds($tenantId);
            return response()->json(['data' => $data]);
        } catch (\Throwable $e) {
            return response()->json(['data' => ['suppliers' => [], 'total_suppliers' => 0], '_error' => $e->getMessage()]);
        }
    }

    /* ─── POST /api/smart-restocking/approve-ddt/{transferId} ──────────── */
    /**
     * Approva un DDT bozza e lo invia in stato "in_transit".
     * Sblocca il picking per il magazziniere.
     */
    public function approveDdt(Request $request, int $transferId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $transfer = DB::table('stock_transfers')
                ->where('id', $transferId)
                ->where('tenant_id', $tenantId)
                ->where('status', 'draft')
                ->first();

            if (!$transfer) {
                return response()->json(['ok' => false, 'error' => 'DDT non trovato o già confermato'], 404);
            }

            DB::table('stock_transfers')
                ->where('id', $transferId)
                ->update([
                    'status'     => 'in_transit',
                    'sent_at'    => now(),
                    'updated_at' => now(),
                ]);

            return response()->json(['ok' => true, 'transfer_id' => $transferId]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /* ─── POST /api/smart-restocking/generate-po ───────────────────────── */
    /**
     * Genera (o aggiorna) una bozza PO per un fornitore,
     * con le quantità modificate manualmente dal frontend.
     */
    public function generatePo(Request $request): JsonResponse
    {
        $tenantId   = (int) $request->attributes->get('tenant_id');
        $supplierId = (int) $request->input('supplier_id');
        $lines      = $request->input('lines', []);

        if (!$supplierId || empty($lines)) {
            return response()->json(['ok' => false, 'error' => 'supplier_id e lines sono obbligatori'], 422);
        }

        try {
            $result = DB::transaction(function () use ($tenantId, $supplierId, $lines) {
                // Elimina eventuale bozza smart_restocking esistente per questo fornitore
                $existing = DB::table('purchase_orders')
                    ->where('tenant_id', $tenantId)
                    ->where('supplier_id', $supplierId)
                    ->where('status', 'draft')
                    ->where('auto_generated_by', 'smart_restocking')
                    ->first();

                if ($existing) {
                    DB::table('purchase_order_lines')->where('purchase_order_id', $existing->id)->delete();
                    DB::table('purchase_orders')->where('id', $existing->id)->delete();
                }

                $totalNet = collect($lines)->sum(fn($l) => ($l['qty'] ?? 0) * ($l['unit_cost'] ?? 0));

                $poId = DB::table('purchase_orders')->insertGetId([
                    'tenant_id'         => $tenantId,
                    'supplier_id'       => $supplierId,
                    'status'            => 'draft',
                    'total_net'         => round($totalNet, 2),
                    'auto_generated_at' => now(),
                    'auto_generated_by' => 'smart_restocking',
                    'created_at'        => now(),
                    'updated_at'        => now(),
                ]);

                foreach ($lines as $line) {
                    $qty  = (int) ($line['qty'] ?? 0);
                    if ($qty <= 0) continue;

                    DB::table('purchase_order_lines')->insert([
                        'purchase_order_id'  => $poId,
                        'product_variant_id' => (int) $line['product_variant_id'],
                        'qty'                => $qty,
                        'unit_cost'          => (float) ($line['unit_cost'] ?? 0),
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }

                return $poId;
            });

            return response()->json(['ok' => true, 'purchase_order_id' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /* ─── GET /api/smart-restocking/brand-matrix ────────────────────────── */
    public function brandMatrix(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $matrix = $this->service->getBrandSupplierMatrix($tenantId);
            return response()->json(['data' => $matrix]);
        } catch (\Throwable $e) {
            return response()->json(['data' => [], '_error' => $e->getMessage()]);
        }
    }

    /* ─── PUT /api/smart-restocking/brand-matrix ─────────────────────────── */
    public function upsertBrandMatrix(Request $request): JsonResponse
    {
        $tenantId   = (int) $request->attributes->get('tenant_id');
        $brandId    = (int) $request->input('brand_id');
        $supplierId = (int) $request->input('supplier_id');
        $isPrimario = (bool) $request->input('is_primario', true);

        if (!$brandId || !$supplierId) {
            return response()->json(['ok' => false, 'error' => 'brand_id e supplier_id obbligatori'], 422);
        }

        try {
            $this->service->upsertBrandSupplier($tenantId, $brandId, $supplierId, $isPrimario);
            return response()->json(['ok' => true]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }

    /* ─── DELETE /api/smart-restocking/brand-matrix ──────────────────────── */
    public function removeBrandMatrix(Request $request): JsonResponse
    {
        $tenantId   = (int) $request->attributes->get('tenant_id');
        $brandId    = (int) $request->input('brand_id');
        $supplierId = (int) $request->input('supplier_id');

        try {
            $this->service->removeBrandSupplier($tenantId, $brandId, $supplierId);
            return response()->json(['ok' => true]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
