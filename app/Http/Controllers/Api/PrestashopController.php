<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * PrestashopController
 * Importa prodotti da un'installazione PrestaShop via Webservice API.
 */
class PrestashopController extends Controller
{
    /** Testa la connessione alla webservice PrestaShop */
    public function test(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'url'     => ['required', 'url'],
            'api_key' => ['required', 'string'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'URL e API Key richiesti.'], 422);
        }

        $url    = rtrim($request->input('url'), '/');
        $apiKey = $request->input('api_key');

        try {
            $start = microtime(true);
            $res = Http::timeout(10)
                ->get("{$url}/api/products", [
                    'ws_key'        => $apiKey,
                    'output_format' => 'JSON',
                    'limit'         => '1',
                    'display'       => '[id]',
                ]);

            if (!$res->successful()) {
                return response()->json([
                    'message' => "PrestaShop ha risposto con errore {$res->status()}. Verifica URL e permessi API Key.",
                ], 422);
            }

            $elapsedMs = (int) round((microtime(true) - $start) * 1000);

            // Contiamo il totale prodotti
            $countRes = Http::timeout(10)
                ->get("{$url}/api/products", [
                    'ws_key'        => $apiKey,
                    'output_format' => 'JSON',
                    'display'       => '[id]',
                    'limit'         => '1000000',
                ]);

            $products = $countRes->json('products') ?? [];

            return response()->json([
                'success'        => true,
                'response_ms'    => $elapsedMs,
                'products_count' => count($products),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => "Impossibile connettersi a PrestaShop: {$e->getMessage()}",
            ], 422);
        }
    }

    /** Importa tutti i prodotti da PrestaShop */
    public function import(Request $request): JsonResponse
    {
        set_time_limit(0);

        try {
            $validator = Validator::make($request->all(), [
                'url'     => ['required', 'url'],
                'api_key' => ['required', 'string'],
            ]);
            if ($validator->fails()) {
                return response()->json(['message' => 'URL e API Key richiesti.'], 422);
            }

            $tenantId = (int) $request->attributes->get('tenant_id');
            $url      = rtrim($request->input('url'), '/');
            $apiKey   = $request->input('api_key');

            // --- 1. Recupera tutti gli ID prodotti ---
            try {
                $idsRes = Http::timeout(120)
                    ->get("{$url}/api/products", [
                        'ws_key'        => $apiKey,
                        'output_format' => 'JSON',
                        'display'       => '[id]',
                        'limit'         => '10000',
                    ]);
                if (!$idsRes->successful()) {
                    return response()->json(['message' => "PrestaShop ha risposto con errore {$idsRes->status()}."], 422);
                }
            } catch (\Throwable $e) {
                return response()->json(['message' => "Connessione fallita: {$e->getMessage()}"], 422);
            }

            $ids = collect($idsRes->json('products') ?? [])->pluck('id')->all();
            $total   = count($ids);
            $imported = 0;
            $errors   = 0;
            $batchSize = 50; // Importa in batch da 50 prodotti
            $firstError = null;

            // --- Recupera categorie tenant ---
            $catMap = DB::table('categories')
                ->where('tenant_id', $tenantId)
                ->pluck('id', 'name');

            // Recupera gli store del tenant per assegnare i prodotti
            $storeIds = DB::table('stores')
                ->where('tenant_id', $tenantId)
                ->pluck('id')
                ->all();

            // --- Recupera tax_class: usa la prima disponibile (IVA 22%) ---
            $defaultTaxClassId = DB::table('tax_classes')
                ->where('tenant_id', $tenantId)
                ->value('id');

            // --- 2. Importa batch per batch ---
            foreach (array_chunk($ids, $batchSize) as $batchIds) {
                try {
                    $batchRes = Http::timeout(120)
                        ->get("{$url}/api/products", [
                            'ws_key'        => $apiKey,
                            'output_format' => 'JSON',
                            'display'       => 'full',
                            'filter[id]'    => '[' . implode('|', $batchIds) . ']',
                            'limit'         => (string) count($batchIds),
                        ]);

                    if (!$batchRes->successful()) {
                        $errors += count($batchIds);
                        continue;
                    }

                $psProducts = $batchRes->json('products') ?? [];
            } catch (\Throwable) {
                $errors += count($batchIds);
                continue;
            }

            foreach ($psProducts as $psp) {
                try {
                    $this->upsertProduct($psp, $tenantId, $storeIds, $catMap, $defaultTaxClassId);
                    $imported++;
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error('PS Import Error for ID ' . ($psp['id'] ?? '??') . ': ' . $e->getMessage());
                    if ($errors === 0) {
                        $firstError = $e->getMessage();
                    }
                    $errors++;
                }
            }
            }

            return response()->json([
                'success'  => true,
                'total'    => $total,
                'imported' => $imported,
                'errors'   => $errors,
                'first_error' => $firstError ?? null,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => "Errore generale server: " . $e->getMessage() . " alla linea " . $e->getLine()
            ], 500);
        }
    }

    /**
     * Inserisce o aggiorna un prodotto PrestaShop nel catalogo SvaPro.
     */
    private function upsertProduct(array $psp, int $tenantId, array $storeIds, $catMap, ?int $defaultTaxClassId): void
    {
        $psId   = (int) ($psp['id'] ?? 0);
        $sku    = trim($psp['reference'] ?? '') ?: "PS-{$psId}";
        $name   = $this->extractLangValue($psp['name'] ?? null) ?: "Prodotto #{$psId}";
        $desc   = $this->extractLangValue($psp['description_short'] ?? null);
        $price  = (float) ($psp['price'] ?? 0);
        $active = (int) ($psp['active'] ?? 1) === 1;

        // Categoria
        $psCatName = $this->extractLangValue($psp['associations']['categories'][0]['id'] ?? null);
        $categoryId = $catMap->first() ?? null; // default prima categoria

        // Cerca se il prodotto esiste già (per SKU)
        $existingProduct = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('sku', $sku)
            ->first(['id']);

        $now = now();

        if ($existingProduct) {
            DB::table('products')->where('id', $existingProduct->id)->update([
                'name'        => $name,
                'is_active'   => $active,
                'updated_at'  => $now,
            ]);
            $productId = $existingProduct->id;
        } else {
            $productId = DB::table('products')->insertGetId([
                'tenant_id'    => $tenantId,
                'sku'          => $sku,
                'name'         => $name,
                'product_type' => 'liquid', // default SvaPro
                'category_id'  => $categoryId,
                'is_active'    => $active,
                'created_at'   => $now,
                'updated_at'   => $now,
            ]);
        }

        // Upsert variante
        $existingVariant = DB::table('product_variants')
            ->where('tenant_id', $tenantId)
            ->where('product_id', $productId)
            ->first(['id']);

        if ($existingVariant) {
            DB::table('product_variants')->where('id', $existingVariant->id)->update([
                'sale_price'    => $price,
                'is_active'     => $active,
                'updated_at'    => $now,
            ]);
            $variantId = $existingVariant->id;
        } else {
            $variantId = DB::table('product_variants')->insertGetId([
                'tenant_id'     => $tenantId,
                'product_id'    => $productId,
                'sale_price'    => $price,
                'tax_class_id'  => $defaultTaxClassId,
                'is_active'     => $active,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
        }

        // Assegna a tutti gli store del tenant (se non già assegnato)
        foreach ($storeIds as $storeId) {
            $exists = DB::table('store_product_variants')
                ->where('tenant_id', $tenantId)
                ->where('store_id', $storeId)
                ->where('product_variant_id', $variantId)
                ->exists();

            if (!$exists) {
                DB::table('store_product_variants')->insert([
                    'tenant_id'          => $tenantId,
                    'store_id'           => $storeId,
                    'product_variant_id' => $variantId,
                    'is_enabled'         => true,
                    'created_at'         => $now,
                    'updated_at'         => $now,
                ]);
            }
        }

        // Crea stock_items (on_hand=0) per TUTTI i warehouse del tenant
        $allWarehouseIds = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->pluck('id');

        foreach ($allWarehouseIds as $warehouseId) {
            $alreadyExists = DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->where('product_variant_id', $variantId)
                ->where('warehouse_id', $warehouseId)
                ->exists();

            if (!$alreadyExists) {
                DB::table('stock_items')->insert([
                    'tenant_id'          => $tenantId,
                    'warehouse_id'       => $warehouseId,
                    'product_variant_id' => $variantId,
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

    /**
     * Gestisce sia stringhe che array PrestaShop multi-lingua.
     * Restituisce il testo nella prima lingua disponibile.
     */
    private function extractLangValue(mixed $value): string
    {
        if (is_string($value)) return $value;
        if (is_array($value)) {
            // Prova prima italiano (id=4), poi inglese (id=1), poi primo disponibile
            foreach ($value as $lang) {
                if (isset($lang['id']) && in_array((int)$lang['id'], [4, 3, 2, 1]) && !empty($lang['value'])) {
                    return (string) $lang['value'];
                }
            }
            $first = reset($value);
            return is_array($first) ? ((string) ($first['value'] ?? '')) : (string) $first;
        }
        return '';
    }
}
