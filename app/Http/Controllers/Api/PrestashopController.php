<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

/**
 * PrestashopController
 * Importa prodotti da un'installazione PrestaShop via Webservice API.
 *
 * PERFORMANCE: il batch import usa bulk pre-loading e batch insert.
 * Le immagini NON vengono scaricate durante l'import (troppo lente);
 * usare /api/fetch-ps-images dopo l'import per scaricarle in background.
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
            $res = Http::timeout(10)->get("{$url}/api/products", [
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

            $countRes = Http::timeout(10)->get("{$url}/api/products", [
                'ws_key'        => $apiKey,
                'output_format' => 'JSON',
                'display'       => '[id]',
                'limit'         => '1000000',
            ]);

            return response()->json([
                'success'        => true,
                'response_ms'    => $elapsedMs,
                'products_count' => count($countRes->json('products') ?? []),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => "Impossibile connettersi a PrestaShop: {$e->getMessage()}",
            ], 422);
        }
    }

    /**
     * Inizia l'importazione: restituisce tutti gli ID da elaborare.
     * Prodotti già presenti con prezzo E immagine vengono saltati.
     * Prodotti presenti ma senza prezzo o senza immagine vengono re-processati.
     */
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
            $idsRes = Http::timeout(60)->get("{$url}/api/products", [
                'ws_key'        => $apiKey,
                'output_format' => 'JSON',
                'display'       => '[id,reference]',
                'limit'         => '10000',
            ]);
            if (!$idsRes->successful()) {
                return response()->json(['message' => "PrestaShop ha risposto con errore {$idsRes->status()}."], 422);
            }
        } catch (\Throwable $e) {
            return response()->json(['message' => "Connessione fallita: {$e->getMessage()}"], 422);
        }

        $psProducts = $idsRes->json('products') ?? [];

        // Estrai tutti gli ID da processare — NESSUNO viene saltato.
        // L'import aggiorna sempre prezzo e immagine anche per i prodotti esistenti.
        $ids = array_values(array_filter(array_column($psProducts, 'id')));

        return response()->json([
            'success' => true,
            'total'   => count($ids),
            'skipped' => 0,
            'ids'     => $ids,
        ]);
    }

    /**
     * Importa un blocco di ID: VELOCE.
     *
     * Ottimizzazioni:
     * - Pre-carica prodotti/varianti/SPV/stock esistenti in BULK (non query per prodotto)
     * - Batch insert per SPV e stock_items
     * - Immagini NON scaricate (troppo lente per 5000 prodotti); usa /api/fetch-ps-images
     */
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

            // ── 1. Fetch dati da PrestaShop ──────────────────────────────────
            try {
                $batchRes = Http::timeout(25)->get("{$url}/api/products", [
                    'ws_key'        => $apiKey,
                    'output_format' => 'JSON',
                    'display'       => '[id,reference,name,price,id_default_image,active]',
                    'filter[id]'    => '[' . implode('|', $batchIds) . ']',
                    'limit'         => (string) count($batchIds),
                ]);

                if (!$batchRes->successful()) {
                    return response()->json([
                        'success'     => false,
                        'imported'    => 0,
                        'errors'      => count($batchIds),
                        'first_error' => "PrestaShop ha risposto con errore {$batchRes->status()}",
                    ]);
                }
            } catch (\Throwable $e) {
                return response()->json([
                    'success'     => false,
                    'imported'    => 0,
                    'errors'      => count($batchIds),
                    'first_error' => "Connessione al batch fallita: " . $e->getMessage(),
                ]);
            }

            $psProducts = $batchRes->json('products') ?? [];
            if (empty($psProducts)) {
                return response()->json(['success' => true, 'imported' => 0, 'errors' => 0, 'first_error' => null]);
            }

            $now = now();

            // ── 2. Pre-carica dati esistenti IN BULK ─────────────────────────
            $catMap            = DB::table('categories')->where('tenant_id', $tenantId)->pluck('id', 'name');
            $defaultTaxClassId = DB::table('tax_classes')->where('tenant_id', $tenantId)->value('id');
            $storeIds          = DB::table('stores')->where('tenant_id', $tenantId)->pluck('id')->all();
            $warehouseIds      = DB::table('warehouses')->where('tenant_id', $tenantId)->pluck('id')->all();

            // Se non ci sono warehouse, creali per ogni store
            if (empty($warehouseIds)) {
                $stores = DB::table('stores')->where('tenant_id', $tenantId)->get(['id', 'name']);
                foreach ($stores as $store) {
                    $wid = DB::table('warehouses')->insertGetId([
                        'tenant_id'  => $tenantId,
                        'store_id'   => $store->id,
                        'name'       => $store->name . ' – Magazzino',
                        'type'       => 'store',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $warehouseIds[] = $wid;
                }
            }

            // Pre-carica SKU → product esistenti
            $skus = collect($psProducts)->map(fn($p) => trim($p['reference'] ?? '') ?: "PS-{$p['id']}")->all();
            $existingProducts = DB::table('products')
                ->where('tenant_id', $tenantId)
                ->whereIn('sku', $skus)
                ->get(['id', 'sku', 'image_url'])
                ->keyBy('sku');

            // Pre-carica product_id → variant esistenti
            $existingProductIds = $existingProducts->pluck('id')->all();
            $existingVariants = empty($existingProductIds)
                ? collect()
                : DB::table('product_variants')
                    ->where('tenant_id', $tenantId)
                    ->whereIn('product_id', $existingProductIds)
                    ->get(['id', 'product_id'])
                    ->keyBy('product_id');

            // Pre-carica SPV esistenti (variant_id → [store_id])
            $allVariantIds = $existingVariants->pluck('id')->all();
            $existingSpv = empty($allVariantIds)
                ? collect()
                : DB::table('store_product_variants')
                    ->where('tenant_id', $tenantId)
                    ->whereIn('product_variant_id', $allVariantIds)
                    ->pluck('store_id', 'product_variant_id'); // variantId → first store (for existence check)

            // Pre-carica stock_items esistenti (variant_id_warehouse_id → true)
            $existingStock = empty($allVariantIds)
                ? collect()
                : DB::table('stock_items')
                    ->where('tenant_id', $tenantId)
                    ->whereIn('product_variant_id', $allVariantIds)
                    ->get(['product_variant_id', 'warehouse_id'])
                    ->groupBy('product_variant_id');

            // ── 3. Processa ogni prodotto ─────────────────────────────────────
            $imported      = 0;
            $errors        = 0;
            $imagesUpdated = 0;
            $firstError    = null;

            // Per il fetch immagini in parallelo dopo il loop
            $imageQueue = []; // [ ['psId' => x, 'imgId' => y, 'productId' => z] ]

            foreach ($psProducts as $psp) {
                try {
                    $psId   = (int) ($psp['id'] ?? 0);
                    $sku    = trim($psp['reference'] ?? '') ?: "PS-{$psId}";
                    $name   = $this->extractLangValue($psp['name'] ?? null) ?: "Prodotto #{$psId}";

                    // 'price' da PS è il prezzo netto IVA esclusa.
                    // Con display specifico non abbiamo price_ttc/tax_rate.
                    $price = (float) ($psp['price'] ?? 0);

                    $active     = (int) ($psp['active'] ?? 1) === 1;
                    $categoryId = $catMap->first() ?? null;

                    $existingProduct = $existingProducts->get($sku);

                    // PS image id: può essere intero, stringa, o oggetto {attrs:..., value:"123"}
                    $psImgRaw = $psp['id_default_image'] ?? null;
                    $psImgId  = null;
                    if (!empty($psImgRaw)) {
                        if (is_array($psImgRaw)) {
                            $psImgId = (int) ($psImgRaw['value'] ?? $psImgRaw[0] ?? 0) ?: null;
                        } else {
                            $psImgId = (int) $psImgRaw ?: null;
                        }
                    }

                    if ($existingProduct) {
                        // ── AGGIORNA prodotto esistente ──
                        $updateData = ['name' => $name, 'is_active' => $active, 'updated_at' => $now];
                        DB::table('products')->where('id', $existingProduct->id)->update($updateData);

                        // Aggiorna SEMPRE il prezzo della variante
                        $existingVariant = $existingVariants->get($existingProduct->id);
                        if ($existingVariant) {
                            DB::table('product_variants')
                                ->where('id', $existingVariant->id)
                                ->update(['sale_price' => $price, 'updated_at' => $now]);

                            $variantId = $existingVariant->id;
                        } else {
                            // Variante mancante → crea
                            $variantId = DB::table('product_variants')->insertGetId([
                                'tenant_id'    => $tenantId,
                                'product_id'   => $existingProduct->id,
                                'sale_price'   => $price,
                                'tax_class_id' => $defaultTaxClassId,
                                'pack_size'    => 1,
                                'cost_price'   => 0,
                                'is_active'    => $active,
                                'created_at'   => $now,
                                'updated_at'   => $now,
                            ]);
                        }

                        // Assicura SPV e stock per tutti gli store/warehouse
                        $this->ensureSpvAndStock($tenantId, $variantId, $storeIds, $warehouseIds, $now);

                        // Salva URL immagine direttamente (no download binario — evita Cloudflare)
                        if (!empty($psImgId)) {
                            $imageUrl = "{$url}/api/images/products/{$psId}/{$psImgId}?ws_key={$apiKey}";
                            DB::table('products')->where('id', $existingProduct->id)->update([
                                'image_url'  => $imageUrl,
                                'updated_at' => $now,
                            ]);
                            $imagesUpdated++;
                        }
                        $imported++;
                    } else {
                        // ── NUOVO prodotto ── (insert singolo per ottenere l'id)
                        $productId = DB::table('products')->insertGetId([
                            'tenant_id'    => $tenantId,
                            'sku'          => $sku,
                            'name'         => $name,
                            'product_type' => 'liquid',
                            'category_id'  => $categoryId,
                            'is_active'    => $active,
                            'created_at'   => $now,
                            'updated_at'   => $now,
                        ]);

                        $variantId = DB::table('product_variants')->insertGetId([
                            'tenant_id'    => $tenantId,
                            'product_id'   => $productId,
                            'sale_price'   => $price,
                            'tax_class_id' => $defaultTaxClassId,
                            'pack_size'    => 1,
                            'cost_price'   => 0,
                            'is_active'    => $active,
                            'created_at'   => $now,
                            'updated_at'   => $now,
                        ]);

                        $this->ensureSpvAndStock($tenantId, $variantId, $storeIds, $warehouseIds, $now);

                        // Salva URL immagine direttamente (no download binario)
                        if (!empty($psImgId)) {
                            $imageUrl = "{$url}/api/images/products/{$psId}/{$psImgId}?ws_key={$apiKey}";
                            DB::table('products')->where('id', $productId)->update([
                                'image_url'  => $imageUrl,
                                'updated_at' => $now,
                            ]);
                            $imagesUpdated++;
                        }
                        $imported++;
                    }
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error('PS Import Error ID ' . ($psp['id'] ?? '?') . ': ' . $e->getMessage());
                    if ($errors === 0) $firstError = $e->getMessage();
                    $errors++;
                }
            }

            return response()->json([
                'success'        => true,
                'imported'       => $imported,
                'errors'         => $errors,
                'images_updated' => $imagesUpdated,
                'first_error'    => $firstError,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => "Errore generale server batch: " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assicura che SPV e stock_items esistano per tutti gli store/warehouse.
     * NON usa upsert() (richiede unique constraint che potrebbe non esistere).
     * Approccio sicuro: pre-carica esistenti → inserisce solo quelli mancanti.
     */
    private function ensureSpvAndStock(int $tenantId, int $variantId, array $storeIds, array $warehouseIds, $now): void
    {
        // ── SPV: inserisci solo gli store non ancora presenti ─────────────────
        if (!empty($storeIds)) {
            $existingStoreIds = DB::table('store_product_variants')
                ->where('tenant_id', $tenantId)
                ->where('product_variant_id', $variantId)
                ->pluck('store_id')
                ->map(fn($id) => (int) $id)
                ->all();

            $missingSpv = [];
            foreach ($storeIds as $storeId) {
                if (!in_array((int) $storeId, $existingStoreIds, true)) {
                    $missingSpv[] = [
                        'tenant_id'          => $tenantId,
                        'store_id'           => (int) $storeId,
                        'product_variant_id' => $variantId,
                        'is_enabled'         => true,
                        'created_at'         => $now,
                        'updated_at'         => $now,
                    ];
                }
            }

            if (!empty($missingSpv)) {
                DB::table('store_product_variants')->insert($missingSpv);
            }
        }

        // ── Stock: inserisci solo i warehouse non ancora presenti ─────────────
        if (!empty($warehouseIds)) {
            $existingWhIds = DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->where('product_variant_id', $variantId)
                ->pluck('warehouse_id')
                ->map(fn($id) => (int) $id)
                ->all();

            $missingStock = [];
            foreach ($warehouseIds as $warehouseId) {
                if (!in_array((int) $warehouseId, $existingWhIds, true)) {
                    $missingStock[] = [
                        'tenant_id'          => $tenantId,
                        'warehouse_id'       => (int) $warehouseId,
                        'product_variant_id' => $variantId,
                        'on_hand'            => 1000,
                        'reserved'           => 0,
                        'reorder_point'      => 0,
                        'safety_stock'       => 0,
                        'created_at'         => $now,
                        'updated_at'         => $now,
                    ];
                }
            }

            if (!empty($missingStock)) {
                DB::table('stock_items')->insert($missingStock);
            }
        }
    }

    /**
     * Scarica le immagini per i prodotti che non ce l'hanno ancora.
     * Da chiamare DOPO l'import (separato per non bloccare l'import).
     * Chiamata: POST /api/prestashop/fetch-images con { url, api_key, limit }
     */
    public function fetchImages(Request $request): JsonResponse
    {
        set_time_limit(0);

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
        $limit    = min((int) $request->input('limit', 50), 200); // processa 50 alla volta
        $offset   = (int) $request->input('offset', 0);

        // Prodotti senza immagine
        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->whereNull('image_url')
            ->orWhere('image_url', '')
            ->orderBy('id')
            ->offset($offset)
            ->limit($limit)
            ->get(['id', 'sku']);

        $updated = 0;
        $failed  = 0;
        $total   = DB::table('products')->where('tenant_id', $tenantId)
            ->where(fn($q) => $q->whereNull('image_url')->orWhere('image_url', ''))
            ->count();

        foreach ($products as $product) {
            // Ricava PS id dallo SKU (PS-{id} o dalla webservice)
            $psId = null;
            if (str_starts_with($product->sku, 'PS-')) {
                $psId = (int) substr($product->sku, 3);
            } else {
                // Cerca per reference in PS
                try {
                    $r = Http::timeout(5)->get("{$url}/api/products", [
                        'ws_key'             => $apiKey,
                        'output_format'      => 'JSON',
                        'display'            => '[id,id_default_image]',
                        'filter[reference]'  => $product->sku,
                        'limit'              => '1',
                    ]);
                    $found = $r->json('products.0');
                    if ($found) $psId = (int) $found['id'];
                } catch (\Throwable $e) {
                    $failed++;
                    continue;
                }
            }

            if (!$psId) { $failed++; continue; }

            // Cerca image id
            try {
                $imgListRes = Http::timeout(5)->get("{$url}/api/products/{$psId}", [
                    'ws_key'        => $apiKey,
                    'output_format' => 'JSON',
                    'display'       => '[id_default_image]',
                ]);
                $imgId = $imgListRes->json('product.id_default_image');
                if (!$imgId) { $failed++; continue; }

                $imgRes = Http::timeout(8)->get("{$url}/api/images/products/{$psId}/{$imgId}", [
                    'ws_key' => $apiKey,
                ]);

                if ($imgRes->successful() && str_starts_with($imgRes->header('Content-Type'), 'image/')) {
                    $mime    = $imgRes->header('Content-Type');
                    $base64  = base64_encode($imgRes->body());
                    $dataUrl = "data:{$mime};base64,{$base64}";
                    DB::table('products')->where('id', $product->id)->update([
                        'image_url'  => $dataUrl,
                        'updated_at' => now(),
                    ]);
                    $updated++;
                } else {
                    $failed++;
                }
            } catch (\Throwable $e) {
                $failed++;
            }
        }

        return response()->json([
            'success'      => true,
            'updated'      => $updated,
            'failed'       => $failed,
            'total_missing'=> $total,
            'next_offset'  => $offset + $limit,
            'done'         => ($offset + $limit) >= $total,
        ]);
    }

    /**
     * Gestisce sia stringhe che array PrestaShop multi-lingua.
     */
    private function extractLangValue(mixed $value): string
    {
        if (is_string($value)) return $value;
        if (is_array($value)) {
            foreach ($value as $lang) {
                if (isset($lang['id']) && in_array((int) $lang['id'], [4, 3, 2, 1]) && !empty($lang['value'])) {
                    return (string) $lang['value'];
                }
            }
            $first = reset($value);
            return is_array($first) ? ((string) ($first['value'] ?? '')) : (string) $first;
        }
        return '';
    }
}
