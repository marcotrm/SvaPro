<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CatalogController extends Controller
{
    public function brands(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $rows = DB::table('brands')
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['data' => $rows]);
    }

    public function categories(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $rows = DB::table('categories')
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name', 'parent_id']);

        return response()->json(['data' => $rows]);
    }

    public function taxClasses(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $rows = DB::table('tax_classes')
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return response()->json(['data' => $rows]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null) {
            $storeExists = DB::table('stores')
                ->where('tenant_id', $tenantId)
                ->where('id', $storeId)
                ->exists();

            if (! $storeExists) {
                return response()->json(['message' => 'Store non valido per il tenant.'], 422);
            }
        }

        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('id')
            ->limit((int) $request->input('limit', 100))
            ->get();

        $productIds = $products->pluck('id')->all();

        $variants = DB::table('product_variants')
            ->where('product_variants.tenant_id', $tenantId)
            ->whereIn('product_id', $productIds ?: [0])
            ->when($storeId !== null, function ($query) use ($tenantId, $storeId) {
                $query->join('store_product_variants as spv', function ($join) use ($tenantId, $storeId) {
                    $join->on('spv.product_variant_id', '=', 'product_variants.id')
                        ->where('spv.tenant_id', '=', $tenantId)
                        ->where('spv.store_id', '=', $storeId)
                        ->where('spv.is_enabled', '=', true);
                });
            })
            ->select('product_variants.*')
            ->get()
            ->groupBy('product_id');

        $assignedStores = DB::table('store_product_variants as spv')
            ->join('stores as s', 's.id', '=', 'spv.store_id')
            ->where('spv.tenant_id', $tenantId)
            ->whereIn('spv.product_variant_id', $variants->flatten(1)->pluck('id')->all() ?: [0])
            ->where('spv.is_enabled', true)
            ->select(['spv.product_variant_id', 's.id as store_id', 's.name as store_name'])
            ->get()
            ->groupBy('product_variant_id');

        // Stock per variante (somma su tutti i magazzini del tenant)
        $allVariantIds = $variants->flatten(1)->pluck('id')->all() ?: [0];
        $stockByVariant = DB::table('stock_items')
            ->where('tenant_id', $tenantId)
            ->whereIn('product_variant_id', $allVariantIds)
            ->select([
                'product_variant_id',
                DB::raw('SUM(on_hand) as total_on_hand'),
                DB::raw('SUM(reserved) as total_reserved'),
            ])
            ->groupBy('product_variant_id')
            ->get()
            ->keyBy('product_variant_id');

        $data = $products->map(function ($product) use ($variants, $assignedStores, $stockByVariant) {
            $productVariants = $variants->get($product->id, collect())->values()->map(function ($variant) use ($assignedStores, $stockByVariant) {
                $variant->assigned_stores = $assignedStores->get($variant->id, collect())->values();
                $stock = $stockByVariant->get($variant->id);
                $variant->on_hand        = $stock ? (int) $stock->total_on_hand : 0;
                $variant->stock_quantity = $stock ? max(0, (int) $stock->total_on_hand - (int) $stock->total_reserved) : 0;
                return $variant;
            });

            $product->variants = $productVariants;
            $product->store_count = $productVariants
                ->flatMap(fn ($variant) => collect($variant->assigned_stores ?? []))
                ->pluck('store_id')
                ->unique()
                ->count();
            return $product;
        })->filter(fn ($product) => $product->variants->count() > 0)->values();

        return response()->json(['data' => $data]);
    }

    public function import(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        
        // Salta l'header
        fgetcsv($handle, 1000, ',');
        
        $importedCount = 0;
        $now = now();
        $storeIds = DB::table('stores')->where('tenant_id', $tenantId)->pluck('id');

        while (($data = fgetcsv($handle, 1000, ',')) !== false) {
            if (count($data) < 4) continue;
            
            $sku = trim($data[0] ?? '');
            $name = trim($data[1] ?? '');
            $type = trim($data[2] ?? 'liquid');
            $price = (float) trim($data[3] ?? '0');
            
            if (!$sku || !$name) continue;
            
            $existingProduct = DB::table('products')->where('tenant_id', $tenantId)->where('sku', $sku)->first();
            
            if (!$existingProduct) {
                // Insert new product
                $productId = DB::table('products')->insertGetId([
                    'tenant_id' => $tenantId,
                    'sku' => $sku,
                    'name' => $name,
                    'product_type' => $type,
                    'auto_reorder_enabled' => true,
                    'reorder_days' => 30,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                
                $variantId = DB::table('product_variants')->insertGetId([
                    'tenant_id' => $tenantId,
                    'product_id' => $productId,
                    'sale_price' => $price,
                    'pack_size' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                
                $variantStoreRows = [];
                foreach ($storeIds as $storeId) {
                    $variantStoreRows[] = [
                        'tenant_id' => $tenantId,
                        'store_id' => $storeId,
                        'product_variant_id' => $variantId,
                        'is_enabled' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                
                if (!empty($variantStoreRows)) {
                    DB::table('store_product_variants')->insert($variantStoreRows);
                }
                $importedCount++;
            }
        }
        fclose($handle);

        try {
            app(\App\Services\WooCommerceSyncService::class)->syncProductsForTenant($tenantId);
        } catch (\Throwable $e) {}

        AuditLogger::log($request, 'import', 'product', 0, "Importati {$importedCount} nuovi prodotti da CSV");

        return response()->json(['message' => "Importazione completata con successo. {$importedCount} prodotti nuovi importati."]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), $this->rules());

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validationError = $this->validateReferences($tenantId, $request);
        if ($validationError !== null) {
            return $validationError;
        }

        $productId = $this->persistProduct($tenantId, $request);

        AuditLogger::log($request, 'create', 'product', $productId, $request->input('name'));

        return response()->json([
            'message' => 'Prodotto creato.',
            'product_id' => $productId,
        ], 201);
    }

    public function update(Request $request, int $productId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $productExists = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('id', $productId)
            ->exists();

        if (! $productExists) {
            return response()->json(['message' => 'Prodotto non trovato per il tenant.'], 404);
        }

        $validator = Validator::make($request->all(), $this->rules($productId));

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $validationError = $this->validateReferences($tenantId, $request, $productId);
        if ($validationError !== null) {
            return $validationError;
        }

        $this->persistProduct($tenantId, $request, $productId);

        AuditLogger::log($request, 'update', 'product', $productId, $request->input('name'));

        return response()->json([
            'message' => 'Prodotto aggiornato.',
            'product_id' => $productId,
        ]);
    }

    private function rules(?int $productId = null): array
    {
        return [
            'sku' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'product_type' => ['nullable', 'string', 'max:50'],
            'pli_code' => ['nullable', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'image' => ['nullable', 'image', 'max:2048'],
            'image_url' => ['nullable', 'string', 'max:255'],
            'brand_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'default_supplier_id' => ['nullable', 'integer'],
            'auto_reorder_enabled' => ['nullable', 'boolean'],
            'reorder_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'min_stock_qty' => ['nullable', 'integer', 'min:0'],
            'store_ids' => ['nullable', 'array'],
            'store_ids.*' => ['integer'],
            'nicotine_mg' => ['nullable', 'integer', 'min:0'],
            'volume_ml' => ['nullable', 'integer', 'min:0'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.sale_price' => ['required', 'numeric', 'min:0'],
            'variants.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.price_list_2' => ['nullable', 'numeric', 'min:0'],
            'variants.*.price_list_3' => ['nullable', 'numeric', 'min:0'],
            'variants.*.pack_size' => ['nullable', 'integer', 'min:1'],
            'variants.*.flavor' => ['nullable', 'string', 'max:120'],
            'variants.*.nicotine_strength' => ['nullable', 'numeric', 'min:0'],
            'variants.*.volume_ml' => ['nullable', 'numeric', 'min:0'],
            'variants.*.color' => ['nullable', 'string', 'max:80'],
            'variants.*.barcode' => ['nullable', 'string', 'max:100'],
            'variants.*.location' => ['nullable', 'string', 'max:120'],
            'variants.*.resistance_ohm' => ['nullable', 'string', 'max:50'],
            'variants.*.tax_class_id' => ['nullable', 'integer'],
            'variants.*.excise_profile_code' => ['nullable', 'string', 'max:50'],
            'variants.*.excise_unit_amount_override' => ['nullable', 'numeric', 'min:0'],
            'variants.*.prevalenza_code' => ['nullable', 'string', 'max:50'],
            'variants.*.prevalenza_label' => ['nullable', 'string', 'max:120'],
            'variants.*.id' => $productId === null ? ['nullable'] : ['nullable', 'integer'],
        ];
    }

    private function validateReferences(int $tenantId, Request $request, ?int $productId = null): ?JsonResponse
    {
        $skuExistsQuery = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->where('sku', (string) $request->input('sku'));

        if ($productId !== null) {
            $skuExistsQuery->where('id', '!=', $productId);
        }

        if ($skuExistsQuery->exists()) {
            return response()->json(['message' => 'SKU gia presente per il tenant.'], 422);
        }

        foreach ([
            'brand_id' => 'brands',
            'category_id' => 'categories',
            'default_supplier_id' => 'suppliers',
        ] as $field => $table) {
            $value = data_get($request->all(), $field);
            if ($value !== null && ! DB::table($table)
                ->where('id', (int) $value)
                ->where('tenant_id', $tenantId)
                ->exists()) {
                return response()->json(['message' => 'Riferimento '.$field.' non valido per il tenant.'], 422);
            }
        }

        foreach ((array) $request->input('variants', []) as $index => $variant) {
            $taxClassId = $variant['tax_class_id'] ?? null;
            if ($taxClassId !== null && ! DB::table('tax_classes')
                ->where('id', (int) $taxClassId)
                ->where('tenant_id', $tenantId)
                ->exists()) {
                return response()->json(['message' => 'Riferimento variants.'.$index.'.tax_class_id non valido per il tenant.'], 422);
            }

            $variantId = $variant['id'] ?? null;
            if ($productId !== null && $variantId !== null && ! DB::table('product_variants')
                ->where('tenant_id', $tenantId)
                ->where('product_id', $productId)
                ->where('id', (int) $variantId)
                ->exists()) {
                return response()->json(['message' => 'Variante non valida per il prodotto selezionato.'], 422);
            }
        }

        $requestedStoreIds = collect((array) $request->input('store_ids', []))
            ->map(fn ($storeId) => (int) $storeId)
            ->filter()
            ->unique()
            ->values();

        if ($requestedStoreIds->isNotEmpty()) {
            $validStoresCount = DB::table('stores')
                ->where('tenant_id', $tenantId)
                ->whereIn('id', $requestedStoreIds->all())
                ->count();

            if ($validStoresCount !== $requestedStoreIds->count()) {
                return response()->json(['message' => 'Uno o piu store selezionati non sono validi per il tenant.'], 422);
            }
        }

        return null;
    }

    private function persistProduct(int $tenantId, Request $request, ?int $productId = null): int
    {
        $now = now();
        $requestedStoreIds = collect((array) $request->input('store_ids', []))
            ->map(fn ($storeId) => (int) $storeId)
            ->filter()
            ->unique()
            ->values();

        $payload = [
            'tenant_id' => $tenantId,
            'sku' => (string) $request->input('sku'),
            'barcode' => $request->input('barcode'),
            'name' => (string) $request->input('name'),
            'product_type' => (string) ($request->input('product_type') ?: 'other'),
            'pli_code' => $request->input('pli_code'),
            'brand_id' => $request->input('brand_id'),
            'category_id' => $request->input('category_id'),
            'default_supplier_id' => $request->input('default_supplier_id'),
            'auto_reorder_enabled' => (bool) $request->boolean('auto_reorder_enabled', true),
            'reorder_days' => (int) $request->input('reorder_days', 30),
            'min_stock_qty' => (int) $request->input('min_stock_qty', 0),
            'nicotine_mg' => $request->input('nicotine_mg'),
            'volume_ml' => $request->input('volume_ml'),
            'is_active' => true,
            'updated_at' => $now,
        ];

        if ($request->hasFile('image')) {
            // Salva come base64 data URL direttamente nel DB:
            // sopravvive ai redeploy su Railway (filesystem effimero)
            $file     = $request->file('image');
            $mime     = $file->getMimeType();
            $encoded  = base64_encode(file_get_contents($file->getRealPath()));
            $dataUrl  = "data:{$mime};base64,{$encoded}";
            $payload['image_url'] = $dataUrl;
            // Mantieni anche il path per retrocompatibilità locale
            $payload['image_path'] = 'base64_stored';
        } elseif ($request->exists('image_url') && $request->input('image_url')) {
            $payload['image_url'] = $request->input('image_url');
        }

        if ($productId === null) {
            $payload['created_at'] = $now;
            $productId = DB::table('products')->insertGetId($payload);
        } else {
            DB::table('products')
                ->where('tenant_id', $tenantId)
                ->where('id', $productId)
                ->update($payload);
        }

        $storeIds = $requestedStoreIds->isNotEmpty()
            ? $requestedStoreIds->all()
            : DB::table('stores')->where('tenant_id', $tenantId)->pluck('id')->all();

        DB::transaction(function () use ($tenantId, $productId, $request, $storeIds, $now) {
            $keepVariantIds = [];

            foreach ((array) $request->input('variants') as $variant) {
                $variantPayload = [
                    'tenant_id' => $tenantId,
                    'product_id' => $productId,
                    'flavor' => $variant['flavor'] ?? null,
                    'resistance_ohm' => $variant['resistance_ohm'] ?? null,
                    'nicotine_strength' => $variant['nicotine_strength'] ?? null,
                    'volume_ml' => isset($variant['volume_ml']) && $variant['volume_ml'] !== '' ? (float) $variant['volume_ml'] : null,
                    'color' => $variant['color'] ?? null,
                    'barcode' => $variant['barcode'] ?? null,
                    'location' => $variant['location'] ?? null,
                    'pack_size' => (int) ($variant['pack_size'] ?? 1),
                    'cost_price' => isset($variant['cost_price']) && $variant['cost_price'] !== '' ? (float) $variant['cost_price'] : 0,
                    'sale_price' => (float) $variant['sale_price'],
                    'price_list_2' => isset($variant['price_list_2']) && $variant['price_list_2'] !== '' ? (float) $variant['price_list_2'] : null,
                    'price_list_3' => isset($variant['price_list_3']) && $variant['price_list_3'] !== '' ? (float) $variant['price_list_3'] : null,
                    'tax_class_id' => $variant['tax_class_id'] ?? null,
                    'excise_profile_code' => $variant['excise_profile_code'] ?? null,
                    'excise_unit_amount_override' => $variant['excise_unit_amount_override'] ?? null,
                    'prevalenza_code' => $variant['prevalenza_code'] ?? null,
                    'prevalenza_label' => $variant['prevalenza_label'] ?? null,
                    'is_active' => true,
                    'updated_at' => $now,
                ];

                $existingVariantId = isset($variant['id']) ? (int) $variant['id'] : null;

                if ($existingVariantId) {
                    DB::table('product_variants')
                        ->where('tenant_id', $tenantId)
                        ->where('product_id', $productId)
                        ->where('id', $existingVariantId)
                        ->update($variantPayload);

                    $variantId = $existingVariantId;
                } else {
                    $variantPayload['created_at'] = $now;
                    $variantId = DB::table('product_variants')->insertGetId($variantPayload);
                }

                $keepVariantIds[] = $variantId;

                DB::table('store_product_variants')
                    ->where('tenant_id', $tenantId)
                    ->where('product_variant_id', $variantId)
                    ->delete();

                $variantStoreRows = [];
                foreach ($storeIds as $storeId) {
                    $variantStoreRows[] = [
                        'tenant_id' => $tenantId,
                        'store_id' => (int) $storeId,
                        'product_variant_id' => $variantId,
                        'is_enabled' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                if ($variantStoreRows !== []) {
                    DB::table('store_product_variants')->insert($variantStoreRows);
                }

                // Auto-crea stock_items con on_hand=0 per nuove varianti
                // così il prodotto appare subito in magazzino
                if (!$existingVariantId) {
                    $defaultWarehouse = DB::table('warehouses')
                        ->where('tenant_id', $tenantId)
                        ->orderBy('id')
                        ->value('id');

                    if ($defaultWarehouse) {
                        $alreadyExists = DB::table('stock_items')
                            ->where('tenant_id', $tenantId)
                            ->where('product_variant_id', $variantId)
                            ->where('warehouse_id', $defaultWarehouse)
                            ->exists();

                        if (!$alreadyExists) {
                            DB::table('stock_items')->insert([
                                'tenant_id'          => $tenantId,
                                'warehouse_id'       => $defaultWarehouse,
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
            }

            $variantIdsToDelete = DB::table('product_variants')
                ->where('tenant_id', $tenantId)
                ->where('product_id', $productId)
                ->whereNotIn('id', $keepVariantIds ?: [0])
                ->pluck('id')
                ->all();

            if ($variantIdsToDelete !== []) {
                DB::table('store_product_variants')
                    ->where('tenant_id', $tenantId)
                    ->whereIn('product_variant_id', $variantIdsToDelete)
                    ->delete();

                DB::table('product_variants')
                    ->where('tenant_id', $tenantId)
                    ->whereIn('id', $variantIdsToDelete)
                    ->delete();
            }
        });

        // Sincronizzazione automatica WooCommerce
        try {
            app(\App\Services\WooCommerceSyncService::class)->syncProductsForTenant($tenantId);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Auto-sync failed for product {$productId}: " . $e->getMessage());
        }

        return $productId;
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'name'      => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Verifica parent
        if ($request->filled('parent_id')) {
            $parentExists = DB::table('categories')
                ->where('id', (int) $request->integer('parent_id'))
                ->where('tenant_id', $tenantId)
                ->exists();

            if (!$parentExists) {
                return response()->json(['message' => 'Categoria padre non valida.'], 422);
            }
        }

        $id = DB::table('categories')->insertGetId([
            'tenant_id'  => $tenantId,
            'name'       => (string) $request->input('name'),
            'parent_id'  => $request->input('parent_id'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLogger::log($request, 'create', 'category', $id, $request->input('name'));

        return response()->json([
            'message' => 'Categoria creata.',
            'data'    => ['id' => $id, 'name' => $request->input('name'), 'parent_id' => $request->input('parent_id')],
        ], 201);
    }

    public function updateCategory(Request $request, int $categoryId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $exists = DB::table('categories')
            ->where('id', $categoryId)
            ->where('tenant_id', $tenantId)
            ->exists();

        if (!$exists) {
            return response()->json(['message' => 'Categoria non trovata.'], 404);
        }

        $validator = Validator::make($request->all(), [
            'name'      => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::table('categories')
            ->where('id', $categoryId)
            ->where('tenant_id', $tenantId)
            ->update([
                'name'       => (string) $request->input('name'),
                'parent_id'  => $request->input('parent_id') ?: null,
                'updated_at' => now(),
            ]);

        AuditLogger::log($request, 'update', 'category', $categoryId, $request->input('name'));

        return response()->json(['message' => 'Categoria aggiornata.']);
    }

    public function destroyCategory(Request $request, int $categoryId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $exists = DB::table('categories')
            ->where('id', $categoryId)
            ->where('tenant_id', $tenantId)
            ->exists();

        if (!$exists) {
            return response()->json(['message' => 'Categoria non trovata.'], 404);
        }

        DB::table('categories')->where('id', $categoryId)->where('tenant_id', $tenantId)->delete();

        return response()->json(['message' => 'Categoria eliminata.']);
    }
}
