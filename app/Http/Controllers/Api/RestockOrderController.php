<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RestockOrderController extends Controller
{
    /** GET /restock-orders */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $status   = $request->query('status');
        $storeId  = $request->query('store_id');

        $query = DB::table('restock_orders as ro')
            ->where('ro.tenant_id', $tenantId)
            ->leftJoin('stores as st', 'st.id', '=', 'ro.store_id')
            ->leftJoin('users as u', 'u.id', '=', 'ro.created_by')
            ->select('ro.*', 'st.name as store_name', 'u.name as created_by_name')
            ->orderByDesc('ro.created_at');

        if ($status)  $query->where('ro.status', $status);
        if ($storeId) $query->where('ro.store_id', $storeId);

        $orders = $query->get();

        foreach ($orders as $order) {
            $order->items_count = DB::table('restock_order_items')
                ->where('restock_order_id', $order->id)->count();
        }

        return response()->json(['data' => $orders]);
    }

    /** GET /restock-orders/:id */
    public function show(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;

        $order = DB::table('restock_orders as ro')
            ->where('ro.id', $id)
            ->where('ro.tenant_id', $tenantId)
            ->leftJoin('stores as st', 'st.id', '=', 'ro.store_id')
            ->leftJoin('users as u', 'u.id', '=', 'ro.created_by')
            ->select('ro.*', 'st.name as store_name', 'u.name as created_by_name')
            ->first();

        if (!$order) return response()->json(['message' => 'Ordine non trovato.'], 404);

        $order->items = DB::table('restock_order_items as ri')
            ->where('ri.restock_order_id', $id)
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'ri.product_variant_id')
            ->leftJoin('products as p', 'p.id', '=', 'pv.product_id')
            ->select(
                'ri.*',
                'pv.sale_price',
                'pv.on_hand',
                DB::raw("COALESCE(ri.product_name, p.name, 'Prodotto senza nome') as product_name")
            )
            ->get();

        // Aggiungi giacenza centrale per ogni articolo
        $mainWarehouse = $this->getMainWarehouse($tenantId);
        foreach ($order->items as $item) {
            if ($mainWarehouse && $item->product_variant_id) {
                $stock = DB::table('stock_items')
                    ->where('tenant_id', $tenantId)
                    ->where('warehouse_id', $mainWarehouse->id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->value('on_hand');
                $item->central_stock = $stock ?? 0;
            } else {
                $item->central_stock = 0;
            }
        }

        return response()->json(['data' => $order]);
    }

    /** POST /restock-orders — crea bozza */
    public function store(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $data = $request->validate([
            'store_id'               => 'required|integer',
            'notes'                  => 'nullable|string',
            'expected_delivery_date' => 'nullable|date',
            'items'                  => 'required|array|min:1',
            'items.*.product_variant_id' => 'nullable|integer',
            'items.*.product_name'       => 'required|string',
            'items.*.barcode'            => 'nullable|string',
            'items.*.sku'                => 'nullable|string',
            'items.*.requested_qty'      => 'required|integer|min:1',
        ]);

        $number = 'RSO-' . now()->format('Y') . '-' . strtoupper(Str::random(6));

        $orderId = DB::table('restock_orders')->insertGetId([
            'tenant_id'               => $tenantId,
            'store_id'                => $data['store_id'],
            'created_by'              => $request->user()->id,
            'order_number'            => $number,
            'status'                  => 'draft',
            'notes'                   => $data['notes'] ?? null,
            'expected_delivery_date'  => $data['expected_delivery_date'] ?? null,
            'created_at'              => now(),
            'updated_at'              => now(),
        ]);

        foreach ($data['items'] as $item) {
            DB::table('restock_order_items')->insert([
                'restock_order_id'   => $orderId,
                'product_variant_id' => $item['product_variant_id'] ?? null,
                'product_name'       => $item['product_name'],
                'barcode'            => $item['barcode'] ?? null,
                'sku'                => $item['sku'] ?? null,
                'requested_qty'      => $item['requested_qty'],
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }

        return response()->json(['data' => DB::table('restock_orders')->where('id', $orderId)->first()], 201);
    }

    /** PUT /restock-orders/:id — modifica (solo draft) */
    public function update(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $order = DB::table('restock_orders')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$order) return response()->json(['message' => 'Ordine non trovato.'], 404);
        if ($order->status !== 'draft') return response()->json(['message' => 'Solo gli ordini in bozza possono essere modificati.'], 422);

        $data = $request->validate([
            'store_id'               => 'sometimes|integer',
            'notes'                  => 'nullable|string',
            'expected_delivery_date' => 'nullable|date',
            'items'                  => 'sometimes|array|min:1',
            'items.*.product_variant_id' => 'nullable|integer',
            'items.*.product_name'       => 'required_with:items|string',
            'items.*.barcode'            => 'nullable|string',
            'items.*.sku'                => 'nullable|string',
            'items.*.requested_qty'      => 'required_with:items|integer|min:1',
        ]);

        DB::table('restock_orders')->where('id', $id)->update([
            'store_id'               => $data['store_id'] ?? $order->store_id,
            'notes'                  => $data['notes'] ?? $order->notes,
            'expected_delivery_date' => $data['expected_delivery_date'] ?? $order->expected_delivery_date,
            'updated_at'             => now(),
        ]);

        if (!empty($data['items'])) {
            DB::table('restock_order_items')->where('restock_order_id', $id)->delete();
            foreach ($data['items'] as $item) {
                DB::table('restock_order_items')->insert([
                    'restock_order_id'   => $id,
                    'product_variant_id' => $item['product_variant_id'] ?? null,
                    'product_name'       => $item['product_name'],
                    'barcode'            => $item['barcode'] ?? null,
                    'sku'                => $item['sku'] ?? null,
                    'requested_qty'      => $item['requested_qty'],
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
            }
        }

        return response()->json(['message' => 'Ordine aggiornato.']);
    }

    /** POST /restock-orders/:id/confirm — draft → confirmed */
    public function confirm(Request $request, $id)
    {
        return $this->transition($request, $id, 'draft', 'confirmed', ['confirmed_at' => now()]);
    }

    /** POST /restock-orders/:id/start-preparing — confirmed → preparing */
    public function startPreparing(Request $request, $id)
    {
        return $this->transition($request, $id, 'confirmed', 'preparing', ['preparing_at' => now()]);
    }

    /** POST /restock-orders/:id/ship — preparing → shipped + crea delivery_note */
    public function ship(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $order = DB::table('restock_orders')->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$order) return response()->json(['message' => 'Ordine non trovato.'], 404);
        if ($order->status !== 'preparing') {
            return response()->json(['message' => 'L\'ordine deve essere in stato "preparing" per essere spedito.'], 422);
        }

        $items = DB::table('restock_order_items')->where('restock_order_id', $id)->get();
        if ($items->isEmpty()) return response()->json(['message' => 'Nessun articolo nell\'ordine.'], 422);

        $trackingNumber  = $request->input('tracking_number');
        $carrierStatus   = $trackingNumber ? 'In Transito' : null;
        $noteNumber      = 'BDC-' . now()->format('Y') . '-' . strtoupper(Str::random(6));

        // Crea la bolla di scarico
        $noteId = DB::table('delivery_notes')->insertGetId([
            'tenant_id'       => $tenantId,
            'store_id'        => $order->store_id,
            'created_by'      => $request->user()->id,
            'note_number'     => $noteNumber,
            'type'            => 'scarico',
            'status'          => 'pending',
            'source'          => 'restock_order',
            'restock_order_id' => $order->id,
            'tracking_number' => $trackingNumber,
            'carrier_status'  => $carrierStatus,
            'notes'           => $order->notes,
            'expected_at'     => $order->expected_delivery_date,
            'shipped_at'      => now(),
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Articoli della bolla
        foreach ($items as $item) {
            DB::table('delivery_note_items')->insert([
                'delivery_note_id'   => $noteId,
                'product_variant_id' => $item->product_variant_id,
                'product_name'       => $item->product_name,
                'barcode'            => $item->barcode,
                'sku'                => $item->sku,
                'expected_qty'       => $item->requested_qty,
                'received_qty'       => null,
                'scanned_qty'        => 0,
                'unit_cost'          => 0,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }

        // Scala giacenze dal magazzino centrale
        $mainWarehouse = $this->getMainWarehouse($tenantId);
        if ($mainWarehouse) {
            foreach ($items as $item) {
                if (!$item->product_variant_id || $item->requested_qty <= 0) continue;

                $stock = DB::table('stock_items')
                    ->where('tenant_id', $tenantId)
                    ->where('warehouse_id', $mainWarehouse->id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->first();

                if ($stock) {
                    DB::table('stock_items')->where('id', $stock->id)->update([
                        'on_hand'    => $stock->on_hand - $item->requested_qty,
                        'updated_at' => now(),
                    ]);
                }

                // Traccia movimento
                try {
                    DB::table('stock_movements')->insert([
                        'tenant_id'          => $tenantId,
                        'warehouse_id'       => $mainWarehouse->id,
                        'product_variant_id' => $item->product_variant_id,
                        'movement_type'      => 'out',
                        'qty'                => $item->requested_qty,
                        'unit_cost'          => 0,
                        'reference_type'     => 'restock_order',
                        'reference_id'       => $id,
                        'employee_id'        => $request->user()->id,
                        'occurred_at'        => now(),
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                } catch (\Throwable) {}
            }
        }

        // Aggiorna stato ordine
        DB::table('restock_orders')->where('id', $id)->update([
            'status'           => 'shipped',
            'shipped_at'       => now(),
            'delivery_note_id' => $noteId,
            'updated_at'       => now(),
        ]);

        return response()->json([
            'message'          => 'Ordine spedito. Bolla di scarico creata.',
            'delivery_note_id' => $noteId,
            'note_number'      => $noteNumber,
        ]);
    }

    /** DELETE /restock-orders/:id — elimina solo se draft */
    public function destroy(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $order = DB::table('restock_orders')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$order) return response()->json(['message' => 'Ordine non trovato.'], 404);
        if (!in_array($order->status, ['draft', 'confirmed'])) {
            return response()->json(['message' => 'Non è possibile eliminare un ordine in preparazione o spedito.'], 422);
        }
        DB::table('restock_order_items')->where('restock_order_id', $id)->delete();
        DB::table('restock_orders')->where('id', $id)->delete();
        return response()->json(['message' => 'Ordine eliminato.']);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function transition(Request $request, $id, string $from, string $to, array $extra = [])
    {
        $tenantId = $request->user()->tenant_id;
        $order = DB::table('restock_orders')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$order) return response()->json(['message' => 'Ordine non trovato.'], 404);
        if ($order->status !== $from) {
            return response()->json(['message' => "L'ordine deve essere in stato '{$from}'."], 422);
        }
        DB::table('restock_orders')->where('id', $id)->update(array_merge([
            'status'     => $to,
            'updated_at' => now(),
        ], $extra));
        return response()->json(['message' => 'Stato aggiornato.', 'status' => $to]);
    }

    private function getMainWarehouse($tenantId)
    {
        return DB::table('warehouses')
            ->join('stores', 'stores.id', '=', 'warehouses.store_id')
            ->where('warehouses.tenant_id', $tenantId)
            ->where('stores.is_main', 1)
            ->select('warehouses.id')
            ->first();
    }
}
