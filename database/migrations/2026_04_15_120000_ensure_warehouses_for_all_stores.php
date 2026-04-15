<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Assicura che ogni negozio (store) abbia almeno un warehouse collegato.
     * Necessario perché i prodotti creati dal negozio centrale devono avere
     * stock_items (anche con on_hand=0) in tutti i magazzini.
     */
    public function up(): void
    {
        $stores = DB::table('stores')->get(['id', 'tenant_id', 'name', 'is_main']);
        $now    = now();

        foreach ($stores as $store) {
            $hasWarehouse = DB::table('warehouses')
                ->where('tenant_id', $store->tenant_id)
                ->where('store_id', $store->id)
                ->exists();

            if ($hasWarehouse) continue;

            $warehouseName = $store->is_main
                ? $store->name . ' – Magazzino Centrale'
                : $store->name . ' – Magazzino';

            DB::table('warehouses')->insert([
                'tenant_id'  => $store->tenant_id,
                'store_id'   => $store->id,
                'name'       => $warehouseName,
                'type'       => 'store',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Assicura anche che tutti i prodotti esistenti abbiano stock_items (on_hand=0)
        // in ogni warehouse del loro tenant (prodotti creati prima di questo fix).
        $variants = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->select('pv.id as variant_id', 'p.tenant_id')
            ->get();

        foreach ($variants as $variant) {
            $warehouses = DB::table('warehouses')
                ->where('tenant_id', $variant->tenant_id)
                ->pluck('id');

            foreach ($warehouses as $warehouseId) {
                $exists = DB::table('stock_items')
                    ->where('tenant_id', $variant->tenant_id)
                    ->where('product_variant_id', $variant->variant_id)
                    ->where('warehouse_id', $warehouseId)
                    ->exists();

                if (!$exists) {
                    DB::table('stock_items')->insert([
                        'tenant_id'          => $variant->tenant_id,
                        'warehouse_id'       => $warehouseId,
                        'product_variant_id' => $variant->variant_id,
                        'on_hand'            => 0,
                        'reserved'           => 0,
                        'reorder_point'      => 0,
                        'safety_stock'       => 0,
                        'created_at'         => $now,
                        'updated_at'         => $now,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // Non eliminiamo i warehouse/stock_items creati — rollback non supportato
    }
};
