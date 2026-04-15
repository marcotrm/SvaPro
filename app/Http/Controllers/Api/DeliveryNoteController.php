<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class DeliveryNoteController extends Controller
{
    /** GET /delivery-notes — lista bolle per il tenant (admin) o per il negozio (dipendente) */
    public function index(Request $request)
    {
        try {
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

            foreach ($notes as $note) {
                $note->items_count = DB::table('delivery_note_items')
                    ->where('delivery_note_id', $note->id)->count();

                // Calcola tempo verifica
                $note->verification_duration_minutes = null;
                if ($note->verification_started_at && $note->verification_completed_at) {
                    $start = new \DateTime($note->verification_started_at);
                    $end   = new \DateTime($note->verification_completed_at);
                    $note->verification_duration_minutes = round(($end->getTimestamp() - $start->getTimestamp()) / 60, 1);
                }

                // Conteggio discrepanze aperte
                $note->open_discrepancies = DB::table('inventory_discrepancies')
                    ->where('delivery_note_id', $note->id)
                    ->where('status', 'open')
                    ->count();
            }

            return response()->json(['data' => $notes]);
        } catch (\Throwable $e) {
            \Log::warning('delivery_notes table not ready: ' . $e->getMessage());
            return response()->json(['data' => [], 'warning' => 'Sistema in aggiornamento, riprovare tra poco.']);
        }
    }

    /** GET /delivery-notes/:id — dettaglio con articoli */
    public function show(Request $request, $id)
    {
        try {
            $tenantId = $request->user()->tenant_id;
            $note = DB::table('delivery_notes as dn')
                ->where('dn.id', $id)
                ->where('dn.tenant_id', $tenantId)
                ->leftJoin('stores as st', 'st.id', '=', 'dn.store_id')
                ->leftJoin('users as creator', 'creator.id', '=', 'dn.created_by')
                ->select('dn.*', 'st.name as store_name', 'creator.name as created_by_name')
                ->first();

            if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);

            $note->items = DB::table('delivery_note_items')
                ->where('delivery_note_id', $id)
                ->get();

            // Aggiunge colore semaforo per ogni articolo
            foreach ($note->items as $item) {
                $item->scan_status = $this->getScanStatus($item);
            }

            $note->open_discrepancies = DB::table('inventory_discrepancies')
                ->where('delivery_note_id', $id)->where('status', 'open')->count();

            $note->verification_duration_minutes = null;
            if ($note->verification_started_at && $note->verification_completed_at) {
                $start = new \DateTime($note->verification_started_at);
                $end   = new \DateTime($note->verification_completed_at);
                $note->verification_duration_minutes = round(($end->getTimestamp() - $start->getTimestamp()) / 60, 1);
            }

            return response()->json(['data' => $note]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Funzionalità in aggiornamento sul server. Riprovare tra qualche minuto.'], 503);
        }
    }

    /** POST /delivery-notes — crea nuova bolla (admin, manuale) */
    public function store(Request $request)
    {
        try {
            $data = $request->validate([
                'store_id'    => 'required|integer',
                'type'        => 'in:carico,scarico,trasferimento',
                'notes'       => 'nullable|string',
                'expected_at' => 'nullable|date',
                'tracking_number' => 'nullable|string',
                'items'       => 'required|array|min:1',
                'items.*.product_variant_id' => 'nullable|integer',
                'items.*.product_name'       => 'required|string',
                'items.*.barcode'            => 'nullable|string',
                'items.*.sku'                => 'nullable|string',
                'items.*.expected_qty'       => 'required|integer|min:1',
                'items.*.unit_cost'          => 'nullable|numeric',
            ]);

            $tenantId   = $request->user()->tenant_id;
            $noteNumber = 'BDC-' . now()->format('Y') . '-' . strtoupper(Str::random(6));

            $noteId = DB::table('delivery_notes')->insertGetId([
                'tenant_id'       => $tenantId,
                'store_id'        => $data['store_id'],
                'created_by'      => $request->user()->id,
                'note_number'     => $noteNumber,
                'type'            => $data['type'] ?? 'scarico',
                'status'          => 'pending',
                'source'          => 'manual',
                'tracking_number' => $data['tracking_number'] ?? null,
                'notes'           => $data['notes'] ?? null,
                'expected_at'     => $data['expected_at'] ?? null,
                'shipped_at'      => now(),
                'created_at'      => now(),
                'updated_at'      => now(),
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
                    'scanned_qty'        => 0,
                    'unit_cost'          => $item['unit_cost'] ?? 0,
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
            }

            // Scala giacenze dal magazzino centrale
            $mainWarehouse = $this->getMainWarehouse($tenantId);
            if ($mainWarehouse) {
                foreach ($data['items'] as $item) {
                    if (empty($item['product_variant_id']) || ($item['expected_qty'] ?? 0) <= 0) continue;
                    $existing = DB::table('stock_items')
                        ->where('tenant_id', $tenantId)
                        ->where('warehouse_id', $mainWarehouse->id)
                        ->where('product_variant_id', $item['product_variant_id'])
                        ->first();

                    if ($existing) {
                        DB::table('stock_items')->where('id', $existing->id)->update([
                            'on_hand' => $existing->on_hand - $item['expected_qty'],
                            'updated_at' => now(),
                        ]);
                    }

                    try {
                        DB::table('stock_movements')->insert([
                            'tenant_id'          => $tenantId,
                            'warehouse_id'       => $mainWarehouse->id,
                            'product_variant_id' => $item['product_variant_id'],
                            'movement_type'      => 'out',
                            'qty'                => $item['expected_qty'],
                            'unit_cost'          => $item['unit_cost'] ?? 0,
                            'reference_type'     => 'delivery_note',
                            'reference_id'       => $noteId,
                            'employee_id'        => $request->user()->id,
                            'occurred_at'        => now(),
                            'created_at'         => now(),
                            'updated_at'         => now(),
                        ]);
                    } catch (\Throwable) {}
                }
            }

            $note = DB::table('delivery_notes')->where('id', $noteId)->first();
            $note->items = DB::table('delivery_note_items')->where('delivery_note_id', $noteId)->get();

            return response()->json(['data' => $note], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Funzionalità in aggiornamento sul server. Riprovare tra qualche minuto.'], 503);
        }
    }

    /** POST /delivery-notes/:id/items/:itemId/scan — scansione singolo articolo */
    public function scanItem(Request $request, $id, $itemId)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);

        if (!in_array($note->status, ['pending', 'in_progress'])) {
            return response()->json(['message' => 'La bolla non è in stato di ricezione.'], 422);
        }

        $item = DB::table('delivery_note_items')
            ->where('id', $itemId)->where('delivery_note_id', $id)->first();
        if (!$item) return response()->json(['message' => 'Articolo non trovato.'], 404);

        $qty = max(0, (int) $request->input('qty', 1));
        $newScanned = $item->scanned_qty + $qty;

        DB::table('delivery_note_items')->where('id', $itemId)->update([
            'scanned_qty' => $newScanned,
            'updated_at'  => now(),
        ]);

        // Aggiorna stato bolla a in_progress se era pending, e avvia timer verifica
        if ($note->status === 'pending') {
            DB::table('delivery_notes')->where('id', $id)->update([
                'status'                  => 'in_progress',
                'verification_started_at' => now(),
                'updated_at'              => now(),
            ]);
        }

        $updatedItem = DB::table('delivery_note_items')->where('id', $itemId)->first();
        $updatedItem->scan_status = $this->getScanStatus($updatedItem);

        return response()->json(['data' => $updatedItem]);
    }

    /** POST /delivery-notes/:id/scan-by-barcode */
    public function scanByBarcode(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);

        $barcode = $request->input('barcode');
        if (!$barcode) return response()->json(['message' => 'Barcode richiesto.'], 422);

        // 1) Cerca articolo nella bolla per barcode, SKU, o variant
        $item = DB::table('delivery_note_items')
            ->where('delivery_note_id', $id)
            ->where(function ($q) use ($barcode) {
                $q->where('barcode', $barcode)
                  ->orWhere('sku', $barcode)
                  ->orWhereIn('product_variant_id', function ($sub) use ($barcode) {
                      $sub->select('id')->from('product_variants')
                          ->where('barcode', $barcode)
                          ->orWhere('sku', $barcode);
                  });
            })
            ->first();

        // 2) Fallback: cerca nel catalogo e aggiunge come articolo extra non atteso
        if (!$item) {
            $variant = DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('p.tenant_id', $tenantId)
                ->where(function ($q) use ($barcode) {
                    $q->where('pv.barcode', $barcode)->orWhere('pv.sku', $barcode);
                })
                ->select('pv.id', 'pv.barcode', 'pv.sku', 'p.name as product_name')
                ->first();

            if ($variant) {
                $newItemId = DB::table('delivery_note_items')->insertGetId([
                    'delivery_note_id'   => $id,
                    'product_variant_id' => $variant->id,
                    'product_name'       => $variant->product_name . ' (NON ATTESO)',
                    'barcode'            => $variant->barcode,
                    'sku'                => $variant->sku,
                    'expected_qty'       => 0,
                    'scanned_qty'        => 1,
                    'received_qty'       => null,
                    'unit_cost'          => 0,
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);
                $updatedItem = DB::table('delivery_note_items')->where('id', $newItemId)->first();
                $updatedItem->scan_status = $this->getScanStatus($updatedItem);

                if ($note->status === 'pending') {
                    DB::table('delivery_notes')->where('id', $id)->update([
                        'status' => 'in_progress', 'verification_started_at' => now(), 'updated_at' => now(),
                    ]);
                }
                return response()->json(['data' => $updatedItem, 'found' => true, 'extra' => true]);
            }

            return response()->json([
                'message' => 'Articolo non trovato in bolla ne\'nel catalogo per: ' . $barcode,
                'found'   => false,
            ], 404);
        }

        // 3) Articolo trovato nella bolla → incrementa scansione
        DB::table('delivery_note_items')->where('id', $item->id)->update([
            'scanned_qty' => $item->scanned_qty + 1,
            'updated_at'  => now(),
        ]);

        if ($note->status === 'pending') {
            DB::table('delivery_notes')->where('id', $id)->update([
                'status' => 'in_progress', 'verification_started_at' => now(), 'updated_at' => now(),
            ]);
        }

        $updatedItem = DB::table('delivery_note_items')->where('id', $item->id)->first();
        $updatedItem->scan_status = $this->getScanStatus($updatedItem);

        return response()->json(['data' => $updatedItem, 'found' => true]);
    }

    /** POST /delivery-notes/:id/complete-verification — conclude riscontro */
    public function completeVerification(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);
        if (!in_array($note->status, ['pending', 'in_progress'])) {
            return response()->json(['message' => 'La bolla non è in stato di ricezione.'], 422);
        }

        $items = DB::table('delivery_note_items')->where('delivery_note_id', $id)->get();
        $hasDiscrepancy = false;
        $discrepancies  = [];

        foreach ($items as $item) {
            // Aggiorna received_qty con quanto scansionato
            $receivedQty = $item->scanned_qty;
            DB::table('delivery_note_items')->where('id', $item->id)->update([
                'received_qty' => $receivedQty,
                'updated_at'   => now(),
            ]);

            $diff = $receivedQty - $item->expected_qty;
            if ($diff !== 0) {
                $hasDiscrepancy = true;
                $discrepancies[] = [
                    'tenant_id'          => $tenantId,
                    'store_id'           => $note->store_id,
                    'delivery_note_id'   => $id,
                    'product_variant_id' => $item->product_variant_id,
                    'product_name'       => $item->product_name,
                    'expected_qty'       => $item->expected_qty,
                    'received_qty'       => $receivedQty,
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

        // Aggiorna stock del negozio con quanto EFFETTIVAMENTE ricevuto
        $warehouse = DB::table('warehouses')
            ->where('store_id', $note->store_id)
            ->where('tenant_id', $tenantId)
            ->orderBy('id')->first();

        // Auto-crea il warehouse del negozio destinazione se non esiste ancora
        if (!$warehouse && $note->store_id) {
            $storeName = DB::table('stores')->where('id', $note->store_id)->value('name');
            $warehouseId = DB::table('warehouses')->insertGetId([
                'tenant_id'  => $tenantId,
                'store_id'   => $note->store_id,
                'name'       => ($storeName ?? 'Negozio') . ' – Magazzino',
                'type'       => 'store',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $warehouse = DB::table('warehouses')->where('id', $warehouseId)->first();
        }

        if ($warehouse) {
            foreach ($items as $item) {
                if (!$item->product_variant_id || $item->scanned_qty <= 0) continue;

                $existing = DB::table('stock_items')
                    ->where('tenant_id', $tenantId)
                    ->where('warehouse_id', $warehouse->id)
                    ->where('product_variant_id', $item->product_variant_id)
                    ->first();

                if ($existing) {
                    DB::table('stock_items')->where('id', $existing->id)->update([
                        'on_hand'    => $existing->on_hand + $item->scanned_qty,
                        'updated_at' => now(),
                    ]);
                } else {
                    DB::table('stock_items')->insert([
                        'tenant_id'          => $tenantId,
                        'warehouse_id'       => $warehouse->id,
                        'product_variant_id' => $item->product_variant_id,
                        'on_hand'            => $item->scanned_qty,
                        'reserved'           => 0,
                        'reorder_point'      => 0,
                        'safety_stock'       => 0,
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                }

                try {
                    DB::table('stock_movements')->insert([
                        'tenant_id'          => $tenantId,
                        'warehouse_id'       => $warehouse->id,
                        'product_variant_id' => $item->product_variant_id,
                        'movement_type'      => 'in',
                        'qty'                => $item->scanned_qty,
                        'unit_cost'          => $item->unit_cost ?? 0,
                        'reference_type'     => 'delivery_note',
                        'reference_id'       => $id,
                        'employee_id'        => $request->user()->id,
                        'occurred_at'        => now(),
                        'created_at'         => now(),
                        'updated_at'         => now(),
                    ]);
                } catch (\Throwable) {}
            }
        }

        $newStatus = $hasDiscrepancy ? 'discrepancy' : 'received';
        DB::table('delivery_notes')->where('id', $id)->update([
            'status'                     => $newStatus,
            'has_discrepancy'            => $hasDiscrepancy,
            'received_by'                => $request->user()->id,
            'received_at'                => now(),
            'verification_completed_at'  => now(),
            'updated_at'                 => now(),
        ]);

        return response()->json([
            'data' => [
                'status'         => $newStatus,
                'has_discrepancy' => $hasDiscrepancy,
                'discrepancies'  => count($discrepancies),
            ]
        ]);
    }

    /** POST /delivery-notes/:id/items/:itemId/adjust-stock — admin corregge giacenza dopo discrepanza */
    public function adjustStock(Request $request, $id, $itemId)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);

        $item = DB::table('delivery_note_items')
            ->where('id', $itemId)->where('delivery_note_id', $id)->first();
        if (!$item) return response()->json(['message' => 'Articolo non trovato.'], 404);

        $data = $request->validate([
            'corrected_qty' => 'required|integer|min:0',
            'notes'         => 'nullable|string',
        ]);

        // Calcola differenza da applicare a stock
        $currentReceived = $item->received_qty ?? 0;
        $delta = $data['corrected_qty'] - $currentReceived;

        $warehouse = DB::table('warehouses')
            ->where('store_id', $note->store_id)
            ->where('tenant_id', $tenantId)
            ->orderBy('id')->first();

        // Auto-crea il warehouse del negozio se non esiste ancora
        if (!$warehouse && $note->store_id) {
            $storeName = DB::table('stores')->where('id', $note->store_id)->value('name');
            $warehouseId = DB::table('warehouses')->insertGetId([
                'tenant_id'  => $tenantId,
                'store_id'   => $note->store_id,
                'name'       => ($storeName ?? 'Negozio') . ' – Magazzino',
                'type'       => 'store',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $warehouse = DB::table('warehouses')->where('id', $warehouseId)->first();
        }

        if ($warehouse && $item->product_variant_id && $delta !== 0) {
            $stock = DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->where('warehouse_id', $warehouse->id)
                ->where('product_variant_id', $item->product_variant_id)
                ->first();

            if ($stock) {
                DB::table('stock_items')->where('id', $stock->id)->update([
                    'on_hand'    => max(0, $stock->on_hand + $delta),
                    'updated_at' => now(),
                ]);
            }
        }

        // Aggiorna l'articolo e chiudi la discrepanza
        DB::table('delivery_note_items')->where('id', $itemId)->update([
            'received_qty' => $data['corrected_qty'],
            'scanned_qty'  => $data['corrected_qty'],
            'updated_at'   => now(),
        ]);

        DB::table('inventory_discrepancies')
            ->where('delivery_note_id', $id)
            ->where('product_variant_id', $item->product_variant_id)
            ->where('status', 'open')
            ->update([
                'status'      => 'resolved',
                'notes'       => $data['notes'] ?? 'Corretto da admin',
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
                'updated_at'  => now(),
            ]);

        // Controlla se ci sono ancora discrepanze aperte
        $stillOpen = DB::table('inventory_discrepancies')
            ->where('delivery_note_id', $id)->where('status', 'open')->count();

        if ($stillOpen === 0) {
            DB::table('delivery_notes')->where('id', $id)->update([
                'status'          => 'received',
                'has_discrepancy' => false,
                'updated_at'      => now(),
            ]);
        }

        return response()->json(['message' => 'Giacenza corretta con successo.']);
    }

    /** POST /delivery-notes/:id/receive — ricevimento legacy (mantenuto per retrocompatibilità) */
    public function receive(Request $request, $id)
    {
        // Delega a completeVerification se ci sono item con scanned_qty,
        // altrimenti usa il vecchio flusso con received_qty espliciti
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);
        if ($note->status === 'received') return response()->json(['message' => 'Bolla già ricevuta.'], 409);

        // Se il client passa gli items con received_qty, imposta scanned_qty di conseguenza
        $items = $request->input('items', []);
        foreach ($items as $item) {
            if (!empty($item['id']) && isset($item['received_qty'])) {
                DB::table('delivery_note_items')->where('id', $item['id'])
                    ->where('delivery_note_id', $id)
                    ->update([
                        'scanned_qty' => (int) $item['received_qty'],
                        'updated_at'  => now(),
                    ]);
            }
        }

        return $this->completeVerification($request, $id);
    }

    /** GET /delivery-notes/discrepancies */
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
            ->where('tenant_id', $tenantId)->where('status', 'open')->count();

        return response()->json(['data' => $items, 'open_count' => $openCount]);
    }

    /** POST /delivery-notes/discrepancies/:id/resolve */
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

    /** POST /delivery-notes/:id/brt-sync — integrazione BRT reale */
    public function syncBrt(Request $request, $id)
    {
        $tenantId = $request->user()->tenant_id;
        $note = DB::table('delivery_notes')->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$note) return response()->json(['message' => 'Bolla non trovata.'], 404);

        // Leggi credenziali BRT dal tenant
        $settings = DB::table('tenant_settings')->where('tenant_id', $tenantId)->first();
        $brtUserId    = $settings->brt_user_id ?? null;
        $brtPassword  = $settings->brt_password ?? null;
        $brtSenderId  = $settings->brt_numeric_sender_id ?? null;

        $trackingNumber = $note->tracking_number;

        // Se credenziali BRT disponibili + tracking number, chiama API reale
        if ($brtUserId && $brtPassword && $trackingNumber) {
            try {
                $response = Http::timeout(10)
                    ->withBasicAuth($brtUserId, $brtPassword)
                    ->get('https://api.brt.it/rest/v1/parcelTracking/' . $trackingNumber, [
                        'senderCode' => $brtSenderId,
                    ]);

                if ($response->successful()) {
                    $brtData = $response->json();
                    $lastEvent = collect($brtData['events'] ?? [])->last();
                    $carrierStatus = $lastEvent['description'] ?? ($brtData['status'] ?? 'In Aggiornamento');

                    DB::table('delivery_notes')->where('id', $id)->update([
                        'carrier_status'   => $carrierStatus,
                        'brt_api_response' => json_encode($brtData),
                        'updated_at'       => now(),
                    ]);

                    return response()->json([
                        'message'        => 'Stato BRT aggiornato.',
                        'data'           => [
                            'tracking_number' => $trackingNumber,
                            'carrier_status'  => $carrierStatus,
                            'events'          => $brtData['events'] ?? [],
                            'real_api'        => true,
                        ]
                    ]);
                }
            } catch (\Throwable $e) {
                \Log::warning("BRT API call failed for note {$id}: " . $e->getMessage());
                // Fallback alla simulazione se l'API BRT non risponde
            }
        }

        // Simulazione (nessuna credenziale o API non risponde)
        $tracking = $trackingNumber ?: 'BRT-' . strtoupper(Str::random(10));
        $statuses = ['In Hub BRT', 'In Consegna', 'Consegnato', 'In Transito'];
        $status   = $statuses[array_rand($statuses)];

        DB::table('delivery_notes')->where('id', $id)->update([
            'tracking_number' => $tracking,
            'carrier_status'  => $status,
            'updated_at'      => now(),
        ]);

        return response()->json([
            'message' => 'Sincronizzazione BRT (simulata — configura le credenziali BRT nelle impostazioni)',
            'data'    => [
                'tracking_number' => $tracking,
                'carrier_status'  => $status,
                'real_api'        => false,
            ]
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Ritorna 'red' | 'orange' | 'green' in base alla scansione */
    private function getScanStatus($item): string
    {
        $scanned  = (int) ($item->scanned_qty ?? 0);
        $expected = (int) ($item->expected_qty ?? 1);
        if ($scanned <= 0) return 'red';
        if ($scanned < $expected) return 'orange';
        return 'green';
    }

    private function getMainWarehouse($tenantId)
    {
        $mainStore = DB::table('stores')
            ->where('tenant_id', $tenantId)
            ->where('is_main', true)
            ->first(['id', 'name']);

        if (!$mainStore) return null;

        $warehouse = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->where('store_id', $mainStore->id)
            ->first('id');

        // Auto-crea il warehouse del magazzino centrale se non esiste ancora
        if (!$warehouse) {
            $warehouseId = DB::table('warehouses')->insertGetId([
                'tenant_id'  => $tenantId,
                'store_id'   => $mainStore->id,
                'name'       => $mainStore->name . ' – Magazzino Centrale',
                'type'       => 'store',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $warehouse = DB::table('warehouses')->where('id', $warehouseId)->first('id');
        }

        return $warehouse;
    }
}
