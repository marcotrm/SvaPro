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

        $data = $products->map(function ($product) use ($variants, $assignedStores) {
            $productVariants = $variants->get($product->id, collect())->values()->map(function ($variant) use ($assignedStores) {
                $variant->assigned_stores = $assignedStores->get($variant->id, collect())->values();
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
            'product_type' => ['required', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100'],
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
            'variants.*.pack_size' => ['nullable', 'integer', 'min:1'],
            'variants.*.flavor' => ['nullable', 'string', 'max:120'],
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
            'product_type' => (string) $request->input('product_type'),
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
                    'pack_size' => (int) ($variant['pack_size'] ?? 1),
                    'cost_price' => (float) ($variant['cost_price'] ?? 0),
                    'sale_price' => (float) $variant['sale_price'],
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

        return $productId;
    }
}
