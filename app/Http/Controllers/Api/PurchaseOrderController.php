<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'status' => ['nullable', 'in:all,draft,sent,partial,received,cancelled'],
            'supplier_id' => ['nullable', 'integer'],
            'product_type' => ['nullable', 'string', 'max:50'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $status = (string) ($request->input('status') ?: 'all');
        $limit = (int) ($request->input('limit') ?: 80);

        $rows = DB::table('purchase_orders as po')
            ->join('suppliers as s', function ($join) use ($tenantId) {
                $join->on('s.id', '=', 'po.supplier_id')
                    ->where('s.tenant_id', '=', $tenantId);
            })
            ->where('po.tenant_id', $tenantId)
            ->when($status !== 'all', fn ($q) => $q->where('po.status', $status))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('po.supplier_id', (int) $request->integer('supplier_id')))
            ->when($request->filled('product_type'), function ($query) use ($request, $tenantId) {
                $productType = (string) $request->input('product_type');
                $query->whereExists(function ($sub) use ($productType, $tenantId) {
                    $sub->select(DB::raw(1))
                        ->from('purchase_order_lines as pol')
                        ->join('product_variants as pv_t', 'pv_t.id', '=', 'pol.product_variant_id')
                        ->join('products as p_t', 'p_t.id', '=', 'pv_t.product_id')
                        ->whereColumn('pol.purchase_order_id', 'po.id')
                        ->where('p_t.tenant_id', $tenantId)
                        ->where('p_t.product_type', $productType);
                });
            })
            ->select([
                'po.id',
                'po.supplier_id',
                's.name as supplier_name',
                'po.status',
                'po.fulfillment_status',
                'po.expected_at',
                'po.total_net',
                'po.created_at',
                'po.updated_at',
            ])
            ->orderByDesc('po.created_at')
            ->limit($limit)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, int $poId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $po = DB::table('purchase_orders as po')
            ->join('suppliers as s', function ($join) use ($tenantId) {
                $join->on('s.id', '=', 'po.supplier_id')
                    ->where('s.tenant_id', '=', $tenantId);
            })
            ->where('po.tenant_id', $tenantId)
            ->where('po.id', $poId)
            ->select([
                'po.id',
                'po.supplier_id',
                's.name as supplier_name',
                's.email as supplier_email',
                'po.status',
                'po.expected_at',
                'po.total_net',
                'po.created_at',
                'po.updated_at',
            ])
            ->first();

        if (! $po) {
            return response()->json(['message' => 'Ordine di acquisto non trovato.'], 404);
        }

        $lines = DB::table('purchase_order_lines as pol')
            ->join('product_variants as pv', 'pv.id', '=', 'pol.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pol.purchase_order_id', $poId)
            ->select([
                'pol.id',
                'pol.product_variant_id',
                'pol.qty',
                'pol.unit_cost',
                'p.sku',
                'p.name as product_name',
                'pv.flavor',
            ])
            ->get();

        $po->lines = $lines;

        return response()->json(['data' => $po]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'supplier_id' => ['required', 'integer'],
            'expected_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Verifica fornitore
        if (! DB::table('suppliers')->where('tenant_id', $tenantId)->where('id', (int) $request->input('supplier_id'))->exists()) {
            return response()->json(['message' => 'Fornitore non valido per il tenant.'], 422);
        }

        // Verifica varianti
        $variantIds = collect((array) $request->input('lines'))->pluck('product_variant_id')->map(fn ($v) => (int) $v)->unique()->all();
        $validVariants = DB::table('product_variants')->where('tenant_id', $tenantId)->whereIn('id', $variantIds)->count();
        if ($validVariants !== count($variantIds)) {
            return response()->json(['message' => 'Una o piu varianti non valide per il tenant.'], 422);
        }

        $now = now();
        $totalNet = 0;
        $lineRows = [];

        foreach ((array) $request->input('lines') as $line) {
            $lineTotal = (int) $line['qty'] * (float) $line['unit_cost'];
            $totalNet += $lineTotal;

            $lineRows[] = [
                'product_variant_id' => (int) $line['product_variant_id'],
                'qty' => (int) $line['qty'],
                'unit_cost' => (float) $line['unit_cost'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $poId = DB::transaction(function () use ($tenantId, $request, $totalNet, $lineRows, $now): int {
            $poId = DB::table('purchase_orders')->insertGetId([
                'tenant_id' => $tenantId,
                'supplier_id' => (int) $request->input('supplier_id'),
                'status' => 'draft',
                'expected_at' => $request->input('expected_at'),
                'total_net' => round($totalNet, 2),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($lineRows as &$row) {
                $row['purchase_order_id'] = $poId;
            }
            unset($row);

            DB::table('purchase_order_lines')->insert($lineRows);

            return $poId;
        });

        AuditLogger::log($request, 'create', 'purchase_order', $poId, 'PO #' . $poId);

        return response()->json([
            'message' => 'Ordine di acquisto creato.',
            'purchase_order_id' => $poId,
        ], 201);
    }

    public function update(Request $request, int $poId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $po = DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('id', $poId)
            ->first();

        if (! $po) {
            return response()->json(['message' => 'Ordine di acquisto non trovato.'], 404);
        }

        if ($po->status !== 'draft') {
            return response()->json(['message' => 'Solo ordini in bozza possono essere modificati.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => ['required', 'integer'],
            'expected_at' => ['nullable', 'date'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (! DB::table('suppliers')->where('tenant_id', $tenantId)->where('id', (int) $request->input('supplier_id'))->exists()) {
            return response()->json(['message' => 'Fornitore non valido per il tenant.'], 422);
        }

        $variantIds = collect((array) $request->input('lines'))->pluck('product_variant_id')->map(fn ($v) => (int) $v)->unique()->all();
        $validVariants = DB::table('product_variants')->where('tenant_id', $tenantId)->whereIn('id', $variantIds)->count();
        if ($validVariants !== count($variantIds)) {
            return response()->json(['message' => 'Una o piu varianti non valide per il tenant.'], 422);
        }

        $now = now();
        $totalNet = 0;
        $lineRows = [];

        foreach ((array) $request->input('lines') as $line) {
            $lineTotal = (int) $line['qty'] * (float) $line['unit_cost'];
            $totalNet += $lineTotal;

            $lineRows[] = [
                'purchase_order_id' => $poId,
                'product_variant_id' => (int) $line['product_variant_id'],
                'qty' => (int) $line['qty'],
                'unit_cost' => (float) $line['unit_cost'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::transaction(function () use ($tenantId, $request, $poId, $totalNet, $lineRows, $now) {
            DB::table('purchase_orders')
                ->where('tenant_id', $tenantId)
                ->where('id', $poId)
                ->update([
                    'supplier_id' => (int) $request->input('supplier_id'),
                    'expected_at' => $request->input('expected_at'),
                    'total_net' => round($totalNet, 2),
                    'updated_at' => $now,
                ]);

            DB::table('purchase_order_lines')->where('purchase_order_id', $poId)->delete();
            DB::table('purchase_order_lines')->insert($lineRows);
        });

        AuditLogger::log($request, 'update', 'purchase_order', $poId, 'PO #' . $poId);

        return response()->json(['message' => 'Ordine di acquisto aggiornato.']);
    }

    public function send(Request $request, int $poId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $po = DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('id', $poId)
            ->first();

        if (! $po) {
            return response()->json(['message' => 'Ordine di acquisto non trovato.'], 404);
        }

        if ($po->status !== 'draft') {
            return response()->json(['message' => 'Solo ordini in bozza possono essere inviati.'], 422);
        }

        DB::table('purchase_orders')
            ->where('id', $poId)
            ->update(['status' => 'sent', 'updated_at' => now()]);

        AuditLogger::log($request, 'send', 'purchase_order', $poId, 'PO #' . $poId);

        return response()->json(['message' => 'Ordine inviato al fornitore.']);
    }

    public function receive(Request $request, int $poId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $po = DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('id', $poId)
            ->first();

        if (! $po) {
            return response()->json(['message' => 'Ordine di acquisto non trovato.'], 404);
        }

        if (! in_array($po->status, ['sent', 'partial'], true)) {
            return response()->json(['message' => 'Solo ordini inviati o parziali possono essere ricevuti.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'warehouse_id' => ['required', 'integer'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.purchase_order_line_id' => ['required', 'integer'],
            'lines.*.qty_received' => ['required', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (! DB::table('warehouses')->where('tenant_id', $tenantId)->where('id', (int) $request->input('warehouse_id'))->exists()) {
            return response()->json(['message' => 'Magazzino non valido per il tenant.'], 422);
        }

        $poLines = DB::table('purchase_order_lines')
            ->where('purchase_order_id', $poId)
            ->get()
            ->keyBy('id');

        $now = now();
        $totalReceived = 0;
        $totalExpected = $poLines->sum('qty');

        DB::transaction(function () use ($tenantId, $request, $poLines, $poId, $now, &$totalReceived) {
            $warehouseId = (int) $request->input('warehouse_id');

            foreach ((array) $request->input('lines') as $receiveLine) {
                $lineId = (int) $receiveLine['purchase_order_line_id'];
                $qtyReceived = (int) $receiveLine['qty_received'];

                $poLine = $poLines->get($lineId);
                if (! $poLine) {
                    continue;
                }

                $totalReceived += $qtyReceived;

                // Aggiorna stock
                $existing = DB::table('stock_items')
                    ->where('tenant_id', $tenantId)
                    ->where('warehouse_id', $warehouseId)
                    ->where('product_variant_id', $poLine->product_variant_id)
                    ->first();

                if ($existing) {
                    DB::table('stock_items')
                        ->where('id', $existing->id)
                        ->update([
                            'qty_on_hand' => $existing->qty_on_hand + $qtyReceived,
                            'updated_at' => $now,
                        ]);
                } else {
                    DB::table('stock_items')->insert([
                        'tenant_id' => $tenantId,
                        'warehouse_id' => $warehouseId,
                        'product_variant_id' => $poLine->product_variant_id,
                        'qty_on_hand' => $qtyReceived,
                        'qty_reserved' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                // Registra movimento
                DB::table('stock_movements')->insert([
                    'tenant_id' => $tenantId,
                    'warehouse_id' => $warehouseId,
                    'product_variant_id' => $poLine->product_variant_id,
                    'movement_type' => 'purchase_receive',
                    'qty' => $qtyReceived,
                    'reference_type' => 'purchase_order',
                    'reference_id' => $poId,
                    'created_at' => $now,
                ]);
            }
        });

        // Determina stato finale
        $newStatus = $totalReceived >= $totalExpected ? 'received' : 'partial';

        DB::table('purchase_orders')
            ->where('id', $poId)
            ->update(['status' => $newStatus, 'updated_at' => now()]);

        AuditLogger::log($request, 'receive', 'purchase_order', $poId, 'PO #' . $poId . ' → ' . $newStatus);

        return response()->json([
            'message' => $newStatus === 'received' ? 'Ordine completamente ricevuto.' : 'Ricezione parziale registrata.',
            'status' => $newStatus,
        ]);
    }

    public function cancel(Request $request, int $poId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $po = DB::table('purchase_orders')
            ->where('tenant_id', $tenantId)
            ->where('id', $poId)
            ->first();

        if (! $po) {
            return response()->json(['message' => 'Ordine di acquisto non trovato.'], 404);
        }

        if ($po->status === 'received') {
            return response()->json(['message' => 'Ordini gia ricevuti non possono essere annullati.'], 422);
        }

        DB::table('purchase_orders')
            ->where('id', $poId)
            ->update(['status' => 'cancelled', 'updated_at' => now()]);

        AuditLogger::log($request, 'cancel', 'purchase_order', $poId, 'PO #' . $poId);

        return response()->json(['message' => 'Ordine annullato.']);
    }

    /**
     * Aggiorna lo stato di lavorazione (fulfillment_status) senza cambiare lo status principale.
     * PATCH /purchase-orders/{id}/fulfillment
     */
    public function patchFulfillment(Request $request, int $poId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $allowed  = ['none', 'scaricato', 'controllato', 'pagato'];

        $request->validate([
            'fulfillment_status' => ['required', 'in:' . implode(',', $allowed)],
        ]);

        $po = DB::table('purchase_orders')->where('tenant_id', $tenantId)->where('id', $poId)->first();
        if (!$po) return response()->json(['message' => 'Ordine non trovato.'], 404);

        DB::table('purchase_orders')->where('id', $poId)->update([
            'fulfillment_status' => $request->input('fulfillment_status'),
            'updated_at'         => now(),
        ]);

        AuditLogger::log($request, 'update', 'purchase_order', $poId,
            "Lavorazione PO #{$poId} → {$request->input('fulfillment_status')}");

        return response()->json(['message' => 'Stato lavorazione aggiornato.']);
    }

    /**
     * Suggerisce un ordine automatico basato sui prodotti con stock < reorder_point.
     * GET /purchase-orders/auto-suggest?store_id=X&supplier_id=Y
     */
    public function autoSuggest(Request $request): JsonResponse
    {
        $tenantId   = (int) $request->attributes->get('tenant_id');
        $storeId    = $request->input('store_id');
        $supplierId = $request->input('supplier_id');

        // Risolve warehouse dal store_id (prova sia store_id che name/id diretto)
        $warehouseId = null;
        if ($storeId) {
            $warehouseId = DB::table('warehouses')
                ->where('tenant_id', $tenantId)
                ->where(function ($q) use ($storeId) {
                    $q->where('store_id', $storeId)
                      ->orWhere('id', $storeId);
                })
                ->value('id');
        }

        // LEFT JOIN: include anche varianti senza stock_items (qty = 0)
        $q = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->leftJoin('stock_items as si', function ($j) use ($tenantId, $warehouseId) {
                $j->on('si.product_variant_id', '=', 'pv.id')
                  ->where('si.tenant_id', $tenantId);
                if ($warehouseId) {
                    $j->where('si.warehouse_id', $warehouseId);
                }
            })
            ->where('p.tenant_id', $tenantId)
            ->where('p.is_active', true)
            ->whereRaw('COALESCE(si.on_hand, 0) <= COALESCE(si.reorder_point, p.min_stock_qty, 5)')
            ->select([
                'pv.id as variant_id',
                'p.name as product_name',
                'pv.flavor',
                'p.sku',
                DB::raw('COALESCE(si.on_hand, 0) as qty_on_hand'),
                DB::raw('COALESCE(si.reorder_point, p.min_stock_qty, 5) as reorder_point'),
                DB::raw('GREATEST(COALESCE(si.reorder_point, p.min_stock_qty, 5) - COALESCE(si.on_hand, 0), 1) as suggested_qty'),
                DB::raw('COALESCE(pv.cost_price, 0) as unit_cost'),
                'p.supplier_id',
            ]);

        if ($supplierId) {
            $q->where('p.supplier_id', (int) $supplierId);
        }

        $items = $q->orderByRaw('COALESCE(si.on_hand, 0) ASC')->get();

        return response()->json(['data' => $items]);
    }
}
