<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryNoteController extends Controller
{
    /** GET /delivery-notes — lista bolle per il tenant (admin) o per il negozio (dipendente) */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $storeId  = $request->query('store_id');
        $status   = $request->query('status');

        $query = DB::table('delivery_notes as dn')
            ->where('dn.tenant_id', $tenantId)
            ->leftJoin('users as creator', 'creator.id', '=', 'dn.created_by')
            ->leftJoin('users as receiver', 'receiver.id', '=', 'dn.received_by')
            ->leftJoin('stores as st', 'st.id', '=', 'dn.store_id')
            ->select(
                'dn.*',
                'creator.name as created_by_name',
                'receiver.name as received_by_name',
                'st.name as store_name'
            )
            ->orderByDesc('dn.created_at');

        if ($storeId) $query->where('dn.store_id', $storeId);
        if ($status)  $query->where('dn.status', $status);

        $notes = $query->get();

        // Aggiungi conteggio articoli
        foreach ($notes as $note) {
            $note->items_count = DB::table('delivery_note_items')
                ->where('delivery_note_id', $note->id)->count();
        }

        return response()->json(['data' => $notes]);
    }

    /** GET /delivery-notes/:id — dettaglio con articoli */
    public function show(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);

        $note->items = DB::table('delivery_note_items')
            ->where('delivery_note_id', $id)
            ->get();

        return response()->json(['data' => $note]);
    }

    /** POST /delivery-notes — crea nuova bolla (admin) */
    public function store(Request $request)
    {
        $data = $request->validate([
            'store_id'    => 'required|integer',
            'type'        => 'in:carico,scarico,trasferimento',
            'notes'       => 'nullable|string',
            'expected_at' => 'nullable|date',
            'items'       => 'required|array|min:1',
            'items.*.product_variant_id' => 'nullable|integer',
            'items.*.product_name'       => 'required|string',
            'items.*.barcode'            => 'nullable|string',
            'items.*.sku'                => 'nullable|string',
            'items.*.expected_qty'       => 'required|integer|min:1',
            'items.*.unit_cost'          => 'nullable|numeric',
        ]);

        $tenantId = $request->user()->tenant_id;
        $noteNumber = 'BDC-' . strtoupper(Str::random(6));

        $noteId = DB::table('delivery_notes')->insertGetId([
            'tenant_id'   => $tenantId,
            'store_id'    => $data['store_id'],
            'created_by'  => $request->user()->id,
            'note_number' => $noteNumber,
            'type'        => $data['type'] ?? 'carico',
            'status'      => 'pending',
            'notes'       => $data['notes'] ?? null,
            'expected_at' => $data['expected_at'] ?? null,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        foreach ($data['items'] as $item) {
            DB::table('delivery_note_items')->insert([
                'delivery_note_id'   => $noteId,
                'product_variant_id' => $item['product_variant_id'] ?? null,
                'product_name'       => $item['product_name'],
                'barcode'            => $item['barcode'] ?? null,
                'sku'                => $item['sku'] ?? null,
                'expected_qty'       => $item['expected_qty'],
                'received_qty'       => null,
                'unit_cost'          => $item['unit_cost'] ?? 0,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }

        $note = DB::table('delivery_notes')->where('id', $noteId)->first();
        $note->items = DB::table('delivery_note_items')->where('delivery_note_id', $noteId)->get();

        return response()->json(['data' => $note], 201);
    }

    /** POST /delivery-notes/:id/receive — dipendente registra ricezione */
    public function receive(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);
        if ($note->status === 'received') return response()->json(['message' => 'Bolla già ricevuta.'], 409);

        $items = $request->validate([
            'items'                => 'required|array',
            'items.*.id'           => 'required|integer',
            'items.*.received_qty' => 'required|integer|min:0',
        ])['items'];

        $hasDiscrepancy = false;
        $discrepancies  = [];

        foreach ($items as $item) {
            $noteItem = DB::table('delivery_note_items')
                ->where('id', $item['id'])
                ->where('delivery_note_id', $id)
                ->first();
            if (!$noteItem) continue;

            DB::table('delivery_note_items')
                ->where('id', $item['id'])
                ->update(['received_qty' => $item['received_qty'], 'updated_at' => now()]);

            $diff = $item['received_qty'] - $noteItem->expected_qty;
            if ($diff !== 0) {
                $hasDiscrepancy = true;
                $discrepancies[] = [
                    'tenant_id'          => $tenantId,
                    'store_id'           => $note->store_id,
                    'delivery_note_id'   => $id,
                    'product_variant_id' => $noteItem->product_variant_id,
                    'product_name'       => $noteItem->product_name,
                    'expected_qty'       => $noteItem->expected_qty,
                    'received_qty'       => $item['received_qty'],
                    'difference'         => $diff,
                    'status'             => 'open',
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ];
            }
        }

        if (!empty($discrepancies)) {
            DB::table('inventory_discrepancies')->insert($discrepancies);
        }

        DB::table('delivery_notes')->where('id', $id)->update([
            'status'      => $hasDiscrepancy ? 'discrepancy' : 'received',
            'received_by' => $request->user()->id,
            'received_at' => now(),
            'updated_at'  => now(),
        ]);

        return response()->json([
            'data' => [
                'status'       => $hasDiscrepancy ? 'discrepancy' : 'received',
                'discrepancies' => count($discrepancies),
            ]
        ]);
    }

    /** GET /delivery-notes/discrepancies — elenco discrepanze aperte (admin) */
    public function discrepancies(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $storeId  = $request->query('store_id');

        $query = DB::table('inventory_discrepancies as d')
            ->where('d.tenant_id', $tenantId)
            ->leftJoin('stores as st', 'st.id', '=', 'd.store_id')
            ->leftJoin('delivery_notes as dn', 'dn.id', '=', 'd.delivery_note_id')
            ->select('d.*', 'st.name as store_name', 'dn.note_number')
            ->orderByDesc('d.created_at');

        if ($storeId) $query->where('d.store_id', $storeId);

        $items = $query->get();
        $openCount = DB::table('inventory_discrepancies')
            ->where('tenant_id', $tenantId)
            ->where('status', 'open')
            ->count();

        return response()->json(['data' => $items, 'open_count' => $openCount]);
    }

    /** POST /delivery-notes/discrepancies/:id/resolve — admin chiude discrepanza */
    public function resolveDiscrepancy(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate(['status' => 'required|in:resolved,accepted', 'notes' => 'nullable|string']);

        DB::table('inventory_discrepancies')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->update([
                'status'      => $data['status'],
                'notes'       => $data['notes'] ?? null,
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'updated_at'  => now(),
            ]);

        return response()->json(['message' => 'Discrepanza aggiornata.']);
    }
}
