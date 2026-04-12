<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InventoryCountController extends Controller
{
    public function sessions(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $sessions = DB::table('inventory_count_sessions as ics')
            ->leftJoin('warehouses as w', 'w.id', '=', 'ics.warehouse_id')
            ->leftJoin('users as u1', 'u1.id', '=', 'ics.started_by')
            ->leftJoin('users as u2', 'u2.id', '=', 'ics.finalized_by')
            ->where('ics.tenant_id', $tenantId)
            ->select([
                'ics.*',
                'w.name as warehouse_name',
                'u1.name as started_by_name',
                'u2.name as finalized_by_name',
            ])
            ->orderByDesc('ics.id')
            ->get();

        // Attach line counts
        $sessionIds = $sessions->pluck('id')->toArray();
        $lineCounts = DB::table('inventory_count_lines')
            ->whereIn('session_id', $sessionIds)
            ->groupBy('session_id')
            ->selectRaw('session_id, COUNT(*) as line_count, SUM(ABS(difference)) as total_variance')
            ->get()
            ->keyBy('session_id');

        $sessions = $sessions->map(function ($s) use ($lineCounts) {
            $lc = $lineCounts->get($s->id);
            $s->line_count = $lc ? (int) $lc->line_count : 0;
            $s->total_variance = $lc ? (int) $lc->total_variance : 0;
            return $s;
        });

        return response()->json(['data' => $sessions]);
    }

    public function sessionDetail(Request $request, int $sessionId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $session = DB::table('inventory_count_sessions')
            ->where('tenant_id', $tenantId)
            ->where('id', $sessionId)
            ->first();

        if (! $session) {
            return response()->json(['message' => 'Sessione non trovata.'], 404);
        }

        $lines = DB::table('inventory_count_lines as icl')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'icl.product_variant_id')
            ->leftJoin('products as p', 'p.id', '=', 'pv.product_id')
            ->where('icl.session_id', $sessionId)
            ->select([
                'icl.*',
                'p.name as product_name',
                'p.sku as product_sku',
                'pv.flavor as variant_flavor',
            ])
            ->orderByDesc('icl.id')
            ->get();

        return response()->json(['session' => $session, 'lines' => $lines]);
    }

    public function createSession(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'warehouse_id' => ['required', 'integer'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $warehouseExists = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('id', $request->integer('warehouse_id'))
            ->exists();

        if (! $warehouseExists) {
            return response()->json(['message' => 'Magazzino non valido per il tenant.'], 422);
        }

        $sessionId = DB::table('inventory_count_sessions')->insertGetId([
            'tenant_id' => $tenantId,
            'warehouse_id' => $request->integer('warehouse_id'),
            'status' => 'open',
            'notes' => $request->input('notes'),
            'started_by' => $request->user()?->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'create', 'inventory_count', $sessionId, 'Sessione conteggio avviata');

        return response()->json(['message' => 'Sessione creata.', 'session_id' => $sessionId], 201);
    }

    public function addCount(Request $request, int $sessionId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $session = DB::table('inventory_count_sessions')
            ->where('tenant_id', $tenantId)
            ->where('id', $sessionId)
            ->first();

        if (! $session) {
            return response()->json(['message' => 'Sessione non trovata.'], 404);
        }

        if ($session->status !== 'open') {
            return response()->json(['message' => 'Sessione non più aperta.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'barcode' => ['required_without:product_variant_id', 'nullable', 'string', 'max:100'],
            'product_variant_id' => ['required_without:barcode', 'nullable', 'integer'],
            'counted_qty' => ['required', 'integer', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Resolve variant from barcode if needed
        $variantId = $request->input('product_variant_id');
        $barcodeScanned = $request->input('barcode');

        if (! $variantId && $barcodeScanned) {
            // Cerca per: barcode variante, barcode prodotto, SKU prodotto, ID variante numerico
            $isNumeric = ctype_digit((string) $barcodeScanned);

            $variant = DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('p.tenant_id', $tenantId)
                ->where(function ($q) use ($barcodeScanned, $isNumeric) {
                    $q->where('pv.barcode', $barcodeScanned)
                      ->orWhere('p.barcode', $barcodeScanned)
                      ->orWhere('p.sku', $barcodeScanned);
                    if ($isNumeric) {
                        $q->orWhere('pv.id', (int) $barcodeScanned);
                    }
                })
                ->select('pv.id')
                ->first();

            if (! $variant) {
                return response()->json(['message' => 'Prodotto non trovato. Verifica barcode, SKU o ID nel catalogo.'], 422);
            }

            $variantId = $variant->id;
        }

        // Retrieve current system qty
        $systemQty = (int) DB::table('stock_items')
            ->where('warehouse_id', $session->warehouse_id)
            ->where('product_variant_id', $variantId)
            ->value('on_hand');

        $countedQty = (int) $request->integer('counted_qty');

        // Upsert line
        $existing = DB::table('inventory_count_lines')
            ->where('session_id', $sessionId)
            ->where('product_variant_id', $variantId)
            ->first();

        if ($existing) {
            DB::table('inventory_count_lines')
                ->where('id', $existing->id)
                ->update([
                    'counted_qty' => $countedQty,
                    'system_qty' => $systemQty,
                    'difference' => $countedQty - $systemQty,
                    'barcode_scanned' => $barcodeScanned ?? $existing->barcode_scanned,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('inventory_count_lines')->insert([
                'session_id' => $sessionId,
                'product_variant_id' => $variantId,
                'barcode_scanned' => $barcodeScanned,
                'counted_qty' => $countedQty,
                'system_qty' => $systemQty,
                'difference' => $countedQty - $systemQty,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json([
            'message' => 'Conteggio registrato.',
            'product_variant_id' => $variantId,
            'counted_qty' => $countedQty,
            'system_qty' => $systemQty,
            'difference' => $countedQty - $systemQty,
        ]);
    }

    public function finalize(Request $request, int $sessionId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $session = DB::table('inventory_count_sessions')
            ->where('tenant_id', $tenantId)
            ->where('id', $sessionId)
            ->first();

        if (! $session) {
            return response()->json(['message' => 'Sessione non trovata.'], 404);
        }

        if ($session->status !== 'open') {
            return response()->json(['message' => 'Sessione già finalizzata.'], 422);
        }

        $applyAdjustments = $request->boolean('apply_adjustments', false);

        if ($applyAdjustments) {
            $lines = DB::table('inventory_count_lines')
                ->where('session_id', $sessionId)
                ->where('difference', '!=', 0)
                ->get();

            foreach ($lines as $line) {
                DB::table('stock_items')
                    ->where('warehouse_id', $session->warehouse_id)
                    ->where('product_variant_id', $line->product_variant_id)
                    ->update([
                        'on_hand' => DB::raw("on_hand + ({$line->difference})"),
                        'updated_at' => now(),
                    ]);

                DB::table('stock_movements')->insert([
                    'tenant_id' => $tenantId,
                    'warehouse_id' => $session->warehouse_id,
                    'product_variant_id' => $line->product_variant_id,
                    'movement_type' => 'inventory_count',
                    'qty' => $line->difference,
                    'reference_type' => 'inventory_count_session',
                    'reference_id' => $sessionId,
                    'occurred_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        DB::table('inventory_count_sessions')
            ->where('id', $sessionId)
            ->update([
                'status' => 'finalized',
                'finalized_by' => $request->user()?->id,
                'finalized_at' => now(),
                'updated_at' => now(),
            ]);

        AuditLogger::log($request, 'finalize', 'inventory_count', $sessionId, 'Sessione finalizzata' . ($applyAdjustments ? ' con rettifiche' : ''));

        return response()->json(['message' => 'Sessione finalizzata.' . ($applyAdjustments ? ' Giacenze aggiornate.' : '')]);
    }
}
