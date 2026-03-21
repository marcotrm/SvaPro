<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class CatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->orderByDesc('id')
            ->limit((int) $request->input('limit', 100))
            ->get();

        $productIds = $products->pluck('id')->all();

        $variants = DB::table('product_variants')
            ->where('tenant_id', $tenantId)
            ->whereIn('product_id', $productIds ?: [0])
            ->get()
            ->groupBy('product_id');

        $data = $products->map(function ($product) use ($variants) {
            $product->variants = $variants->get($product->id, collect())->values();
            return $product;
        })->values();

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'sku' => ['required', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'product_type' => ['required', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'brand_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'nicotine_mg' => ['nullable', 'integer', 'min:0'],
            'volume_ml' => ['nullable', 'integer', 'min:0'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.sale_price' => ['required', 'numeric', 'min:0'],
            'variants.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'variants.*.pack_size' => ['nullable', 'integer', 'min:1'],
            'variants.*.flavor' => ['nullable', 'string', 'max:120'],
            'variants.*.resistance_ohm' => ['nullable', 'string', 'max:50'],
            'variants.*.tax_class_id' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        foreach ([
            'brand_id' => 'brands',
            'category_id' => 'categories',
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
        }

        $now = now();

        $productId = DB::table('products')->insertGetId([
            'tenant_id' => $tenantId,
            'sku' => (string) $request->input('sku'),
            'barcode' => $request->input('barcode'),
            'name' => (string) $request->input('name'),
            'product_type' => (string) $request->input('product_type'),
            'brand_id' => $request->input('brand_id'),
            'category_id' => $request->input('category_id'),
            'nicotine_mg' => $request->input('nicotine_mg'),
            'volume_ml' => $request->input('volume_ml'),
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $rows = [];
        foreach ((array) $request->input('variants') as $variant) {
            $rows[] = [
                'tenant_id' => $tenantId,
                'product_id' => $productId,
                'flavor' => $variant['flavor'] ?? null,
                'resistance_ohm' => $variant['resistance_ohm'] ?? null,
                'pack_size' => (int) ($variant['pack_size'] ?? 1),
                'cost_price' => (float) ($variant['cost_price'] ?? 0),
                'sale_price' => (float) $variant['sale_price'],
                'tax_class_id' => $variant['tax_class_id'] ?? null,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('product_variants')->insert($rows);

        return response()->json([
            'message' => 'Prodotto creato.',
            'product_id' => $productId,
        ], 201);
    }
}
