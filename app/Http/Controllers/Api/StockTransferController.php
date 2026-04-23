<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockTransferController extends Controller
{
    /* ─── LIST ─────────────────────────────────────────────────── */
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $transfers = DB::table('stock_transfers as t')
            ->join('stores as fs', 'fs.id', '=', 't.from_store_id')
            ->join('stores as ts', 'ts.id', '=', 't.to_store_id')
            ->leftJoin('users as ub', 'ub.id', '=', 't.created_by')
            ->leftJoin('users as ur', 'ur.id', '=', 't.received_by')
            ->where('t.tenant_id', $tenantId)
            ->when($request->filled('status'), fn($q) => $q->where('t.status', $request->input('status')))
            ->when($request->filled('store_id'), fn($q) => $q->where(function($q2) use ($request) {
                $q2->where('t.from_store_id', $request->input('store_id'))
                   ->orWhere('t.to_store_id', $request->input('store_id'));
            }))
            ->select([
                't.*',
                'fs.name as from_store_name',
                'ts.name as to_store_name',
                'ub.name as created_by_name',
                'ur.name as received_by_name',
            ])
            ->orderByDesc('t.is_ai_generated')
            ->orderByDesc('t.created_at')
            ->limit(200)
            ->get();

        // Arricchisci ogni trasferimento con i suoi item
        $ids = $transfers->pluck('id');
        $items = DB::table('stock_transfer_items as sti')
            ->join('product_variants as pv', 'pv.id', '=', 'sti.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->whereIn('sti.transfer_id', $ids)
            ->select([
                'sti.*',
                'pv.flavor', 'pv.resistance_ohm', 'pv.sale_price',
                'p.name as product_name', 'p.sku',
            ])
            ->get()
            ->groupBy('transfer_id');

        $transfers = $transfers->map(fn($t) => array_merge(
            (array) $t,
            ['items' => $items->get($t->id, collect())->values()]
        ));

        return response()->json(['data' => $transfers]);
    }

    /* ─── CREATE (bozza DDT) ────────────────────────────────────── */
    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $userId   = $request->attributes->get('user_id');

        $request->validate([
            'from_store_id'   => 'required|integer',
            'to_store_id'     => 'required|integer|different:from_store_id',
            'items'           => 'required|array|min:1',
            'items.*.product_variant_id' => 'required|integer',
            'items.*.quantity_sent'      => 'required|integer|min:1',
            'notes'           => 'nullable|string|max:1000',
        ]);

        // Verifica negozi del tenant
        $stores = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->whereIn('id', [$request->from_store_id, $request->to_store_id])
            ->pluck('id')
            ->toArray();

        if (count($stores) < 2) {
            return response()->json(['message' => 'Negozi non validi per questo tenant.'], 422);
        }

        // Genera numero DDT progressivo
        $lastNum = DB::table('stock_transfers')
            ->where('tenant_id', $tenantId)
            ->whereYear('created_at', now()->year)
            ->count();
        $ddtNumber = 'DDT-' . now()->year . '-' . str_pad($lastNum + 1, 4, '0', STR_PAD_LEFT);

        DB::beginTransaction();
        try {
            $transferId = DB::table('stock_transfers')->insertGetId([
                'tenant_id'       => $tenantId,
                'ddt_number'      => $ddtNumber,
                'from_store_id'   => $request->from_store_id,
                'to_store_id'     => $request->to_store_id,
                'status'          => 'draft',
                'notes'           => $request->notes,
                'created_by'      => $userId,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);

            foreach ($request->items as $item) {
                DB::table('stock_transfer_items')->insert([
                    'transfer_id'        => $transferId,
                    'product_variant_id' => $item['product_variant_id'],
                    'quantity_sent'      => $item['quantity_sent'],
                    'notes'              => $item['notes'] ?? null,
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Errore creazione DDT: ' . $e->getMessage()], 500);
        }

        return response()->json(['message' => 'DDT creato', 'ddt_number' => $ddtNumber, 'id' => $transferId], 201);
    }

    /* ─── SEND (in_transit — scala da magazzino mittente) ────────── */
    public function send(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $transfer = DB::table('stock_transfers')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$transfer) return response()->json(['message' => 'DDT non trovato.'], 404);
        if ($transfer->status !== 'draft') return response()->json(['message' => 'Solo i DDT in bozza possono essere inviati.'], 422);

        // Magazzino mittente (principale del negozio)
        $fromWarehouse = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $transfer->from_store_id)
            ->first();

        if (!$fromWarehouse) {
            return response()->json(['message' => 'Magazzino mittente non trovato.'], 422);
        }

        $items = DB::table('stock_transfer_items')
            ->where('transfer_id', $id)
            ->get();

        DB::beginTransaction();
        try {
            foreach ($items as $item) {
                // Verifica stock disponibile
                $stock = DB::table('stock_items')
                    ->where('warehouse_id', $fromWarehouse->id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->first();

                $available = $stock ? ($stock->on_hand - $stock->reserved) : 0;
                if ($available < $item->quantity_sent) {
                    DB::rollBack();
                    return response()->json([
                        'message' => "Stock insufficiente per variante ID {$item->product_variant_id}. Disponibile: {$available}, richiesto: {$item->quantity_sent}."
                    ], 422);
                }

                // Scala stock dal magazzino mittente
                DB::table('stock_items')
                    ->where('warehouse_id', $fromWarehouse->id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->decrement('on_hand', $item->quantity_sent);
            }

            DB::table('stock_transfers')->where('id', $id)->update([
                'status'         => 'in_transit',
                'from_warehouse_id' => $fromWarehouse->id,
                'sent_at'        => now(),
                'updated_at'     => now(),
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Errore invio DDT: ' . $e->getMessage()], 500);
        }

        return response()->json(['message' => 'DDT inviato — stock scalato dal magazzino mittente.']);
    }

    /* ─── RECEIVE (ricevuto — aggiunge stock al magazzino destinatario) ── */
    public function receive(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $userId   = $request->attributes->get('user_id');

        $request->validate([
            'items' => 'nullable|array',
            'items.*.id'                => 'required|integer',
            'items.*.quantity_received' => 'required|integer|min:0',
        ]);

        $transfer = DB::table('stock_transfers')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$transfer) return response()->json(['message' => 'DDT non trovato.'], 404);
        if ($transfer->status !== 'in_transit') return response()->json(['message' => 'Solo i DDT in_transit possono essere ricevuti.'], 422);

        // Magazzino destinatario
        $toWarehouse = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $transfer->to_store_id)
            ->first();

        if (!$toWarehouse) {
            return response()->json(['message' => 'Magazzino destinatario non trovato.'], 422);
        }

        $itemsFromRequest = collect($request->items ?? [])->keyBy('id');
        $items = DB::table('stock_transfer_items')->where('transfer_id', $id)->get();

        DB::beginTransaction();
        try {
            foreach ($items as $item) {
                $received = $itemsFromRequest->has($item->id)
                    ? (int) $itemsFromRequest[$item->id]['quantity_received']
                    : $item->quantity_sent; // default: ricevuta tutta la quantità

                // Aggiorna quantity_received sull'item
                DB::table('stock_transfer_items')
                    ->where('id', $item->id)
                    ->update(['quantity_received' => $received, 'updated_at' => now()]);

                // Aggiunge stock al magazzino destinatario (upsert)
                $existingStock = DB::table('stock_items')
                    ->where('warehouse_id', $toWarehouse->id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->first();

                if ($existingStock) {
                    DB::table('stock_items')
                        ->where('id', $existingStock->id)
                        ->increment('on_hand', $received);
                } else {
                    DB::table('stock_items')->insert([
                        'tenant_id'          => $tenantId,
                        'warehouse_id'       => $toWarehouse->id,
                        'product_variant_id' => $item->product_variant_id,
                        'on_hand'            => $received,
                        'reserved'           => 0,
                        'reorder_point'      => 0,
                        'safety_stock'       => 0,
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }
            }

            DB::table('stock_transfers')->where('id', $id)->update([
                'status'          => 'received',
                'to_warehouse_id' => $toWarehouse->id,
                'received_by'     => $userId,
                'received_at'     => now(),
                'updated_at'      => now(),
            ]);

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Errore ricezione DDT: ' . $e->getMessage()], 500);
        }

        return response()->json(['message' => 'DDT ricevuto — stock aggiunto al magazzino destinatario.']);
    }

    /* ─── CANCEL ────────────────────────────────────────────────── */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $transfer = DB::table('stock_transfers')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$transfer) return response()->json(['message' => 'DDT non trovato.'], 404);
        if (!in_array($transfer->status, ['draft', 'in_transit'])) {
            return response()->json(['message' => 'Questo DDT non può essere annullato.'], 422);
        }

        // Se era in_transit, restituisci lo stock al mittente
        if ($transfer->status === 'in_transit' && $transfer->from_warehouse_id) {
            $items = DB::table('stock_transfer_items')->where('transfer_id', $id)->get();
            foreach ($items as $item) {
                DB::table('stock_items')
                    ->where('warehouse_id', $transfer->from_warehouse_id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->increment('on_hand', $item->quantity_sent);
            }
        }

        DB::table('stock_transfers')->where('id', $id)->update([
            'status'     => 'cancelled',
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'DDT annullato.']);
    }

    /* ─── DELETE ─────────────────────────────────────────────────── */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $transfer = DB::table('stock_transfers')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$transfer) {
            return response()->json(['message' => 'DDT non trovato.'], 404);
        }

        if (!in_array($transfer->status, ['draft', 'cancelled'])) {
            return response()->json([
                'message' => 'Puoi eliminare solo DDT in bozza o annullati. Per eliminare un DDT in transito, annullalo prima.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            DB::table('stock_transfer_items')->where('transfer_id', $id)->delete();
            DB::table('stock_transfers')->where('id', $id)->delete();
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Errore eliminazione DDT: ' . $e->getMessage()], 500);
        }

        return response()->json(['message' => 'DDT eliminato.']);
    }
}
