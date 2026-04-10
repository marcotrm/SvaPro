<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CustomerReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $query = DB::table('customer_returns as cr')
            ->join('sales_orders as so', 'so.id', '=', 'cr.order_id')
            ->leftJoin('customers as c', 'c.id', '=', 'cr.customer_id')
            ->where('cr.tenant_id', $tenantId)
            ->when($request->query('status'), fn ($q, $v) => $q->where('cr.status', $v))
            ->when($request->query('reason'), fn ($q, $v) => $q->where('cr.reason', $v))
            ->when($request->query('customer_id'), fn ($q, $v) => $q->where('cr.customer_id', $v))
            ->when($request->query('from'), fn ($q, $v) => $q->whereDate('cr.created_at', '>=', $v))
            ->when($request->query('to'), fn ($q, $v) => $q->whereDate('cr.created_at', '<=', $v))
            ->when($request->query('search'), function ($q, $v) {
                $q->where(function ($sub) use ($v) {
                    $sub->where('cr.rma_number', 'like', "%{$v}%")
                        ->orWhere('c.first_name', 'like', "%{$v}%")
                        ->orWhere('c.last_name', 'like', "%{$v}%");
                });
            })
            ->select([
                'cr.*',
                'so.order_number',
                DB::raw("COALESCE(c.first_name || ' ' || c.last_name, 'Cliente non registrato') as customer_name"),
            ])
            ->orderByDesc('cr.created_at');

        $returns = $query->paginate($request->query('per_page', 25));

        return response()->json($returns);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $return = DB::table('customer_returns as cr')
            ->join('sales_orders as so', 'so.id', '=', 'cr.order_id')
            ->leftJoin('customers as c', 'c.id', '=', 'cr.customer_id')
            ->leftJoin('users as u', 'u.id', '=', 'cr.processed_by')
            ->where('cr.tenant_id', $tenantId)
            ->where('cr.id', $id)
            ->select([
                'cr.*',
                'so.order_number',
                DB::raw("COALESCE(c.first_name || ' ' || c.last_name, 'Cliente non registrato') as customer_name"),
                'u.name as processed_by_name',
            ])
            ->first();

        if (! $return) {
            return response()->json(['message' => 'Reso non trovato.'], 404);
        }

        $lines = DB::table('customer_return_lines as crl')
            ->join('product_variants as pv', 'pv.id', '=', 'crl.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('crl.customer_return_id', $id)
            ->select(['crl.*', 'pv.sku', 'pv.name as variant_name', 'p.name as product_name'])
            ->get();

        $return->lines = $lines;

        return response()->json($return);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        // Normalize: accetta sia 'order_id' che 'original_order_id' (POS)
        $input = $request->all();
        if (!isset($input['order_id']) && isset($input['original_order_id'])) {
            $input['order_id'] = $input['original_order_id'];
        }
        // Normalize lines: accetta sia 'quantity'/'unit_price' che 'qty'/'unit_refund_amount' (POS)
        if (!empty($input['lines'])) {
            $input['lines'] = array_map(function ($l) {
                if (!isset($l['quantity']) && isset($l['qty'])) {
                    $l['quantity'] = $l['qty'];
                }
                if (!isset($l['unit_price']) && isset($l['unit_refund_amount'])) {
                    $l['unit_price'] = $l['unit_refund_amount'];
                }
                return $l;
            }, $input['lines']);
        }

        $validator = Validator::make($input, [
            'order_id'      => 'required|integer',
            'customer_id'   => 'nullable|integer',
            'reason'        => 'required|in:customer_request,defective,wrong_item,damaged,changed_mind,other',
            'notes'         => 'nullable|string|max:2000',
            'refund_method' => 'nullable|in:credit,cash,bank_transfer,store_credit',
            'lines'         => 'required|array|min:1',
            'lines.*.product_variant_id' => 'required|integer',
            'lines.*.quantity'           => 'required|integer|min:1',
            'lines.*.unit_price'         => 'required|numeric|min:0',
            'lines.*.condition_notes'    => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors(), 'message' => $validator->errors()->first()], 422);
        }

        $data = $validator->validated();

        // Verify order belongs to tenant
        $order = DB::table('sales_orders')
            ->where('id', $data['order_id'])
            ->where('tenant_id', $tenantId)
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Ordine non trovato.'], 404);
        }

        // Recupera customer_id dall'ordine se non fornito
        $customerId = $data['customer_id'] ?? $order->customer_id ?? null;

        $rma = 'RMA-' . strtoupper(Str::random(8));
        $now = now();
        $refundAmount = collect($data['lines'])->sum(fn ($l) => $l['quantity'] * $l['unit_price']);

        $returnId = DB::table('customer_returns')->insertGetId([
            'tenant_id'     => $tenantId,
            'order_id'      => $data['order_id'],
            'customer_id'   => $customerId,
            'processed_by'  => null,
            'rma_number'    => $rma,
            'status'        => 'pending',
            'reason'        => $data['reason'],
            'notes'         => $data['notes'] ?? null,
            'refund_method' => $data['refund_method'] ?? null,
            'refund_amount' => $refundAmount,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);

        $lines = [];
        foreach ($data['lines'] as $line) {
            $lines[] = [
                'customer_return_id'  => $returnId,
                'product_variant_id'  => $line['product_variant_id'],
                'quantity'            => $line['quantity'],
                'unit_price'          => $line['unit_price'],
                'condition_notes'     => $line['condition_notes'] ?? null,
            ];
        }
        DB::table('customer_return_lines')->insert($lines);

        $pdfUrl = null;
        try {
            $html = "<h1>Reso Merci (RMA: {$rma})</h1><p>Totale Rimborso Stimato: EUR " . number_format($refundAmount, 2) . "</p>";
            $pdfContent = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->output();
            $path = "returns/{$tenantId}/{$rma}.pdf";
            \Illuminate\Support\Facades\Storage::disk('public')->put($path, $pdfContent);
            $pdfUrl = '/storage/' . $path;
        } catch (\Throwable $e) {}

        AuditLogger::log($request, 'customer_return.created', 'customer_returns', $returnId, "RMA {$rma}", [
            'rma_number' => $rma,
            'order_id'   => $data['order_id'],
            'reason'     => $data['reason'],
        ], $pdfUrl);

        return response()->json(['id' => $returnId, 'rma_number' => $rma], 201);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'status'        => 'required|in:approved,denied,received,refunded',
            'refund_method' => 'nullable|in:credit,cash,bank_transfer,store_credit',
            'notes'         => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $return = DB::table('customer_returns')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (! $return) {
            return response()->json(['message' => 'Reso non trovato.'], 404);
        }

        $data = $validator->validated();
        $update = [
            'status'       => $data['status'],
            'processed_by' => $request->user()->id,
            'updated_at'   => now(),
        ];

        if ($data['status'] === 'approved') {
            $update['approved_at'] = now();
        }
        if ($data['status'] === 'received') {
            $update['received_at'] = now();
        }
        if ($data['status'] === 'refunded') {
            $update['refunded_at'] = now();
            if (! empty($data['refund_method'])) {
                $update['refund_method'] = $data['refund_method'];
            }
        }
        if (! empty($data['notes'])) {
            $update['notes'] = $data['notes'];
        }

        DB::table('customer_returns')->where('id', $id)->update($update);

        // If received, restock inventory
        if ($data['status'] === 'received') {
            $this->restockItems($return, $tenantId);
        }

        AuditLogger::log($request, 'customer_return.status_changed', 'customer_returns', $id, "RMA Status: {$return->status}", $update);

        return response()->json(['message' => 'Stato reso aggiornato.']);
    }

    public function analytics(Request $request): JsonResponse
    {
        $tenantId = $request->attributes->get('tenant_id');

        $totals = DB::table('customer_returns')
            ->where('tenant_id', $tenantId)
            ->selectRaw("
                COUNT(*) as total_returns,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
                SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
                SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded,
                SUM(refund_amount) as total_refund_amount,
                SUM(CASE WHEN status = 'refunded' THEN refund_amount ELSE 0 END) as actual_refunded
            ")->first();

        $byReason = DB::table('customer_returns')
            ->where('tenant_id', $tenantId)
            ->groupBy('reason')
            ->selectRaw('reason, COUNT(*) as count, SUM(refund_amount) as amount')
            ->get();

        $topReturners = DB::table('customer_returns as cr')
            ->join('customers as c', 'c.id', '=', 'cr.customer_id')
            ->where('cr.tenant_id', $tenantId)
            ->groupBy('cr.customer_id', 'c.first_name', 'c.last_name')
            ->selectRaw("cr.customer_id, c.first_name || ' ' || c.last_name as name, COUNT(*) as return_count, SUM(cr.refund_amount) as total_amount")
            ->orderByDesc('return_count')
            ->limit(10)
            ->get();

        $monthlyTrend = DB::table('customer_returns')
            ->where('tenant_id', $tenantId)
            ->whereNotNull('created_at')
            ->selectRaw("strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(refund_amount) as amount")
            ->groupByRaw("strftime('%Y-%m', created_at)")
            ->orderBy('month')
            ->limit(12)
            ->get();

        // Return rate vs orders
        $totalOrders = DB::table('sales_orders')->where('tenant_id', $tenantId)->count();
        $returnRate = $totalOrders > 0 ? round(($totals->total_returns / $totalOrders) * 100, 2) : 0;

        return response()->json([
            'totals'        => $totals,
            'return_rate'   => $returnRate,
            'by_reason'     => $byReason,
            'top_returners' => $topReturners,
            'monthly_trend' => $monthlyTrend,
        ]);
    }

    private function restockItems(object $return, int $tenantId): void
    {
        $lines = DB::table('customer_return_lines')
            ->where('customer_return_id', $return->id)
            ->get();

        // Find the main warehouse for the tenant
        $warehouse = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('is_central', true)
            ->first();

        if (! $warehouse) {
            return;
        }

        foreach ($lines as $line) {
            DB::table('inventory_movements')->insert([
                'tenant_id'          => $tenantId,
                'product_variant_id' => $line->product_variant_id,
                'warehouse_id'       => $warehouse->id,
                'quantity'           => $line->quantity,
                'type'               => 'return',
                'reference'          => $return->rma_number,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);

            DB::table('inventory_stock')
                ->where('tenant_id', $tenantId)
                ->where('product_variant_id', $line->product_variant_id)
                ->where('warehouse_id', $warehouse->id)
                ->increment('quantity', $line->quantity);
        }
    }
}
