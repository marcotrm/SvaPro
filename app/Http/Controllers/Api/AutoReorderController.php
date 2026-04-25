<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AutoReorderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AutoReorderController extends Controller
{
    public function __construct(private readonly AutoReorderService $service) {}

    // POST /api/reorder-drafts/generate
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'supplier_ids'   => ['nullable', 'array'],
            'supplier_ids.*' => ['integer', 'min:1'],
            'dry_run'        => ['boolean'],
        ]);

        $tenantId    = (int) $request->attributes->get('tenant_id');
        $supplierIds = $request->input('supplier_ids');
        $dryRun      = (bool) $request->input('dry_run', false);

        $result = $this->service->generate($tenantId, $supplierIds, $dryRun);

        return response()->json($result, 201);
    }

    // GET /api/reorder-drafts
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $drafts = DB::table('purchase_orders as po')
            ->join('suppliers as sup', 'sup.id', '=', 'po.supplier_id')
            ->join('stores as s', 's.id', '=', 'po.store_id')
            ->where('po.tenant_id', $tenantId)
            ->where('po.source', 'auto_reorder')
            ->whereIn('po.status', ['draft', 'confirmed'])
            ->selectRaw("
                po.id,
                po.supplier_id,
                sup.name   AS supplier_name,
                po.store_id,
                s.name     AS store_name,
                po.status,
                po.total_net,
                po.created_at,
                (SELECT COUNT(*) FROM purchase_order_lines WHERE purchase_order_id = po.id) AS lines_count
            ")
            ->orderByDesc('po.created_at')
            ->paginate(20);

        return response()->json($drafts);
    }

    // GET /api/reorder-drafts/{id}
    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $po = DB::table('purchase_orders')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->where('source', 'auto_reorder')
            ->first();

        if (!$po) {
            return response()->json(['message' => 'Bozza non trovata'], 404);
        }

        $lines = DB::table('purchase_order_lines as pol')
            ->join('product_variants as pv', 'pv.id', '=', 'pol.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pol.purchase_order_id', $id)
            ->select([
                'pol.id',
                'pol.product_variant_id',
                'p.name as product_name',
                'pol.qty',
                'pol.unit_cost',
                DB::raw('pol.qty * pol.unit_cost AS line_total'),
                'pol.updated_at',
            ])
            ->get();

        return response()->json(['data' => $po, 'lines' => $lines]);
    }

    // PATCH /api/reorder-drafts/{id}/lines/{lineId}
    public function updateLine(Request $request, int $id, int $lineId): JsonResponse
    {
        $request->validate([
            'qty'             => ['required', 'integer', 'min:1'],
            'override_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $tenantId = (int) $request->attributes->get('tenant_id');

        // Verifica ownership tramite tenant
        $po = DB::table('purchase_orders')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->where('source', 'auto_reorder')
            ->where('status', 'draft')
            ->first();

        if (!$po) {
            return response()->json(['message' => 'Bozza non trovata o non modificabile'], 404);
        }

        $line = DB::table('purchase_order_lines')
            ->where('id', $lineId)
            ->where('purchase_order_id', $id)
            ->first();

        if (!$line) {
            return response()->json(['message' => 'Riga non trovata'], 404);
        }

        DB::transaction(function () use ($lineId, $id, $request) {
            $newQty = (int) $request->input('qty');

            DB::table('purchase_order_lines')
                ->where('id', $lineId)
                ->update([
                    'qty'        => $newQty,
                    'updated_at' => now(),
                ]);

            // Ricalcola totale PO lato server (NON nel frontend)
            $newTotal = DB::table('purchase_order_lines')
                ->where('purchase_order_id', $id)
                ->selectRaw('SUM(qty * unit_cost) AS total')
                ->value('total');

            // Note: PHP-side concat per evitare SQL injection da DB::raw
            $currentNotes = DB::table('purchase_orders')->where('id', $id)->value('notes') ?? '';
            $reason       = $request->input('override_reason', '');
            $updatedNotes = $currentNotes . "\n[Override] " . now()->format('Y-m-d H:i') . ": {$reason}";

            DB::table('purchase_orders')
                ->where('id', $id)
                ->update([
                    'total_net'  => round((float) $newTotal, 2),
                    'notes'      => $updatedNotes,
                    'updated_at' => now(),
                ]);
        });

        return response()->json(['message' => 'Riga aggiornata']);
    }

    // POST /api/reorder-drafts/{id}/approve
    public function approve(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $userId   = $request->user()->id;

        $po = DB::table('purchase_orders')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->where('source', 'auto_reorder')
            ->where('status', 'draft')
            ->first();

        if (!$po) {
            return response()->json(['message' => 'Bozza non trovata o già approvata'], 404);
        }

        DB::transaction(function () use ($id, $userId) {
            $currentNotes = DB::table('purchase_orders')->where('id', $id)->value('notes') ?? '';
            $updatedNotes = $currentNotes . "\nApprovato da utente #{$userId} il " . now()->format('d/m/Y H:i');

            DB::table('purchase_orders')->where('id', $id)->update([
                'status'     => 'confirmed',
                'notes'      => $updatedNotes,
                'updated_at' => now(),
            ]);
        });

        return response()->json([
            'purchase_order_id' => $id,
            'status'            => 'confirmed',
            'approved_by'       => $userId,
            'approved_at'       => now()->toIso8601String(),
        ]);
    }

    // DELETE (soft): POST /api/reorder-drafts/{id}/discard
    public function discard(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $updated = DB::table('purchase_orders')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->where('source', 'auto_reorder')
            ->where('status', 'draft')
            ->update(['status' => 'cancelled', 'updated_at' => now()]);

        if (!$updated) {
            return response()->json(['message' => 'Bozza non trovata o non cancellabile'], 404);
        }

        return response()->json(['message' => 'Bozza scartata (soft delete)']);
    }
}
