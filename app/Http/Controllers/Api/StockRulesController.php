<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StockRulesController extends Controller
{
    /**
     * Ritorna i gruppi di negozi configurati.
     */
    public function getStoreGroups(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        
        $groups = DB::table('store_groups')
            ->where('tenant_id', $tenantId)
            ->get();
            
        $pivot = DB::table('store_group_store')
            ->whereIn('store_group_id', $groups->pluck('id'))
            ->get();
            
        foreach($groups as $g) {
            $g->store_ids = $pivot->where('store_group_id', $g->id)->pluck('store_id')->all();
        }

        return response()->json(['data' => $groups]);
    }

    /**
     * Salva o aggiorna un gruppo di negozi.
     */
    public function saveStoreGroup(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $request->validate([
            'name'      => 'required|string',
            'store_ids' => 'array'
        ]);

        $id = $request->input('id');
        if (!$id) {
            $id = DB::table('store_groups')->insertGetId([
                'tenant_id'  => $tenantId,
                'name'       => $request->name,
                'created_at' => now(),
                'updated_at' => now()
            ]);
        } else {
            DB::table('store_groups')->where('id', $id)->where('tenant_id', $tenantId)->update([
                'name'       => $request->name,
                'updated_at' => now()
            ]);
            DB::table('store_group_store')->where('store_group_id', $id)->delete();
        }

        $pivots = [];
        foreach($request->input('store_ids', []) as $storeId) {
            $pivots[] = [
                'store_group_id' => $id,
                'store_id'       => $storeId
            ];
        }
        
        if (!empty($pivots)) {
            DB::table('store_group_store')->insert($pivots);
        }

        return response()->json(['message' => 'Gruppo salvato con successo', 'id' => $id]);
    }

    /**
     * Elimina un gruppo.
     */
    public function deleteStoreGroup(Request $request, $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        
        DB::table('store_groups')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->delete(); // I vincoli ON DELETE CASCADE cancelleranno la pivot

        return response()->json(['message' => 'Gruppo eliminato']);
    }

    /**
     * Ritorna lo storico delle regole di stock applicate.
     */
    public function getRules(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $rules = DB::table('stock_rules as sr')
            ->leftJoin('categories as c', 'c.id', '=', 'sr.category_id')
            ->leftJoin('brands as b', 'b.id', '=', 'sr.brand_id')
            ->where('sr.tenant_id', $tenantId)
            ->orderByDesc('sr.id')
            ->select([
                'sr.*',
                'c.name as category_name',
                'b.name as brand_name',
            ])
            ->get();

        foreach ($rules as $r) {
            if ($r->target_type === 'warehouse') {
                $r->target_name = DB::table('warehouses')->where('id', $r->target_id)->value('name');
            } elseif ($r->target_type === 'store_group') {
                $r->target_name = DB::table('store_groups')->where('id', $r->target_id)->value('name');
            } else {
                $r->target_name = 'Tutti i Negozi Retail';
            }
        }

        return response()->json(['data' => $rules]);
    }

    /**
     * Salva e Applica massivamente una regola.
     */
    public function saveAndApplyRule(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        
        $data = $request->validate([
            'category_id' => 'nullable|integer',
            'brand_id'    => 'nullable|integer',
            'target_type' => 'required|string|in:all_stores,store_group,warehouse',
            'target_id'   => 'nullable|integer', // null se target_type == 'all_stores'
            'min_stock'   => 'required|integer|min:0',
            'max_stock'   => 'required|integer|min:0',
        ]);

        $ruleId = DB::table('stock_rules')->insertGetId([
            'tenant_id'   => $tenantId,
            'category_id' => $data['category_id'] ?? null,
            'brand_id'    => $data['brand_id'] ?? null,
            'target_type' => $data['target_type'],
            'target_id'   => $data['target_id'] ?? null,
            'min_stock'   => $data['min_stock'],
            'max_stock'   => $data['max_stock'],
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // ==========================
        // APPLY LOGIC MASSIvA
        // ==========================

        // 1. Troviamo gli ID delle varianti coinvolte
        $query = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pv.tenant_id', $tenantId);
            
        if (!empty($data['category_id'])) {
            $query->where('p.category_id', $data['category_id']);
        }
        if (!empty($data['brand_id'])) {
            $query->where('p.brand_id', $data['brand_id']);
        }
        $variantIds = $query->pluck('pv.id')->all();

        if (empty($variantIds)) {
            return response()->json([
                'message' => 'Regola salvata, ma nessun prodotto trovato per i filtri selezionati.',
                'applied_count' => 0
            ]);
        }

        // 2. Troviamo i magazzini coinvolti
        $warehouseQuery = DB::table('warehouses')->where('tenant_id', $tenantId);
        
        if ($data['target_type'] === 'warehouse') {
            // Deposito specifico o Negozio specifico
            $warehouseQuery->where('id', $data['target_id']);
        } elseif ($data['target_type'] === 'store_group') {
            // Gruppo di negozi (retail)
            $storeIds = DB::table('store_group_store')
                ->where('store_group_id', $data['target_id'])
                ->pluck('store_id')->all();
            $warehouseQuery->whereIn('store_id', $storeIds);
        } elseif ($data['target_type'] === 'all_stores') {
            // Solo negozi retail, esclude i depositi centrali (garantisce la priorità/isolamento del Deposito Centrale)
            $warehouseQuery->where('type', 'store');
        }

        $warehouseIds = $warehouseQuery->pluck('id')->all();

        if (empty($warehouseIds)) {
            return response()->json([
                'message' => 'Regola salvata, ma nessun magazzino trovato per il target.',
                'applied_count' => 0
            ]);
        }

        // 3. Aggiorniamo massivamente la tabella stock_items
        $updatedCount = 0;

        // Dato che i variantIds potrebbero essere migliaia, li elaboriamo in blocchi da 500 per evitare limiti query
        $chunks = array_chunk($variantIds, 500);
        foreach ($chunks as $chunk) {
            $updatedCount += DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->whereIn('warehouse_id', $warehouseIds)
                ->whereIn('product_variant_id', $chunk)
                ->update([
                    'scorta_minima' => $data['min_stock'],
                    'quantita_riordino_target' => $data['max_stock'],
                    'updated_at' => now(),
                ]);
        }

        return response()->json([
            'message' => 'Regola salvata e applicata con successo!',
            'rule_id' => $ruleId,
            'applied_count' => $updatedCount
        ]);
    }
}
