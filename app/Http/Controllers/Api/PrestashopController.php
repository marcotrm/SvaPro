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

    /** Inizia l'importazione restituendo tutti gli ID da elaborare */
    public function startImport(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'url'     => ['required', 'url'],
            'api_key' => ['required', 'string'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'URL e API Key richiesti.'], 422);
        }

        $url      = rtrim($request->input('url'), '/');
        $apiKey   = $request->input('api_key');
        $tenantId = (int) $request->attributes->get('tenant_id');

        try {
            $idsRes = Http::timeout(60)
                ->get("{$url}/api/products", [
                    'ws_key'        => $apiKey,
                    'output_format' => 'JSON',
                    'display'       => '[id,reference]', // <-- get id and reference
                    'limit'         => '10000',
                ]);
            if (!$idsRes->successful()) {
                return response()->json(['message' => "PrestaShop ha risposto con errore {$idsRes->status()}."], 422);
            }
        } catch (\Throwable $e) {
            return response()->json(['message' => "Connessione fallita: {$e->getMessage()}"], 422);
        }

        $psProducts = $idsRes->json('products') ?? [];
        
        // Find existing products in SvaPro for this tenant to check completeness
        $existingDataRaw = DB::table('products')
            ->leftJoin('product_variants', 'products.id', '=', 'product_variants.product_id')
            ->where('products.tenant_id', $tenantId)
            ->whereNotNull('products.sku')
            ->get(['products.sku', 'products.image_url', 'product_variants.sale_price']);

        $existingData = [];
        foreach ($existingDataRaw as $ep) {
            $existingData[$ep->sku] = [
                'has_image' => !empty($ep->image_url),
                'has_price' => ((float) $ep->sale_price) > 0,
            ];
        }
            
        $ids = [];
        $skipped = 0;
        foreach ($psProducts as $p) {
            if (!isset($p['id'])) continue;
            
            $ref = trim($p['reference'] ?? '');
            $key = $ref ?: "PS-{$p['id']}";
            
            if (isset($existingData[$key])) {
                // Product exists. Check if it's missing image or price
                $needsUpdate = false;
                if (!$existingData[$key]['has_image']) $needsUpdate = true;
                if (!$existingData[$key]['has_price']) $needsUpdate = true;
                
                if (!$needsUpdate) {
                    $skipped++;
                    continue; // Skip perfectly complete product
                }
            }
            
            $ids[] = $p['id'];
        }

        return response()->json([
            'success' => true,
            'total'   => count($ids),
            'skipped' => $skipped,
            'ids'     => $ids,
        ]);
    }

    /** Importa un singolo blocco di ID passati dal frontend */
    public function importBatch(Request $request): JsonResponse
    {
        set_time_limit(0);

        try {
            $validator = Validator::make($request->all(), [
                'url'      => ['required', 'url'],
                'api_key'  => ['required', 'string'],
                'batchIds' => ['required', 'array'],
            ]);
            if ($validator->fails()) {
                return response()->json(['message' => 'Dati batch non validi.'], 422);
            }

            $tenantId = (int) $request->attributes->get('tenant_id');
            $url      = rtrim($request->input('url'), '/');
            $apiKey   = $request->input('api_key');
            $batchIds = $request->input('batchIds');

            $imported = 0;
            $errors   = 0;
            $firstError = null;

            // Mappe per SvaPro
            $catMap = DB::table('categories')->where('tenant_id', $tenantId)->pluck('id', 'name');
            $storeIds = DB::table('stores')->where('tenant_id', $tenantId)->pluck('id')->all();
            $defaultTaxClassId = DB::table('tax_classes')->where('tenant_id', $tenantId)->value('id');

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
                    return response()->json([
                        'success'  => false,
                        'imported' => 0,
                        'errors'   => count($batchIds),
                        'first_error' => "PrestaShop ha risposto con errore {$batchRes->status()}",
                    ]);
                }

                $psProducts = $batchRes->json('products') ?? [];
            } catch (\Throwable $e) {
                return response()->json([
                    'success'  => false,
                    'imported' => 0,
                    'errors'   => count($batchIds),
                    'first_error' => "Connessione al batch fallita: " . $e->getMessage(),
                ]);
            }

            foreach ($psProducts as $psp) {
                try {
                    $this->upsertProduct($psp, $tenantId, $storeIds, $catMap, $defaultTaxClassId, $url, $apiKey);
                    $imported++;
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error('PS Import Error for ID ' . ($psp['id'] ?? '??') . ': ' . $e->getMessage());
                    if ($errors === 0 || !$firstError) {
                        $firstError = $e->getMessage();
                    }
                    $errors++;
                }
            }

            return response()->json([
                'success'     => true,
                'imported'    => $imported,
                'errors'      => $errors,
                'first_error' => $firstError,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => "Errore generale server batch: " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Inserisce o aggiorna un prodotto PrestaShop nel catalogo SvaPro.
     */
    private function upsertProduct(array $psp, int $tenantId, array $storeIds, $catMap, ?int $defaultTaxClassId, string $url = '', string $apiKey = ''): void
    {
        $psId   = (int) ($psp['id'] ?? 0);
        $sku    = trim($psp['reference'] ?? '') ?: "PS-{$psId}";
        $name   = $this->extractLangValue($psp['name'] ?? null) ?: "Prodotto #{$psId}";
        $desc   = $this->extractLangValue($psp['description_short'] ?? null);
        $price  = (float) ($psp['price'] ?? 0);
        $active = (int) ($psp['active'] ?? 1) === 1;
        // Cerca se il prodotto esiste già (per SKU)
        $existingProduct = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('sku', $sku)
            ->first(['id', 'image_url']);

        // Image logic
        $imageUrl = null;
        if (empty($existingProduct->image_url) && !empty($psp['id_default_image']) && $url && $apiKey) {
            $psImageId = $psp['id_default_image'];
            try {
                // Fetch image from Prestashop API
                $imgResponse = Http::timeout(10)->get("{$url}/api/images/products/{$psId}/{$psImageId}", [
                    'ws_key' => $apiKey,
                ]);
                if ($imgResponse->successful() && str_starts_with($imgResponse->header('Content-Type'), 'image/')) {
                    $mime = $imgResponse->header('Content-Type');
                    $base64 = base64_encode($imgResponse->body());
                    $imageUrl = "data:{$mime};base64,{$base64}";
                }
            } catch (\Exception $e) {
                // Ignore image fetch errors to not block product import
            }
        }

        // Categoria
        $psCatName = $this->extractLangValue($psp['associations']['categories'][0]['id'] ?? null);
        $categoryId = $catMap->first() ?? null; // default prima categoria

        $now = now();

        if ($existingProduct) {
            $updateData = [
                'name'        => $name,
                'is_active'   => $active,
                'updated_at'  => $now,
            ];
            if ($imageUrl) {
                $updateData['image_url'] = $imageUrl;
            }
            DB::table('products')->where('id', $existingProduct->id)->update($updateData);
            $productId = $existingProduct->id;
        } else {
            $productId = DB::table('products')->insertGetId([
                'tenant_id'    => $tenantId,
                'sku'          => $sku,
                'name'         => $name,
                'product_type' => 'liquid', // default SvaPro
                'category_id'  => $categoryId,
                'image_url'    => $imageUrl,
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
