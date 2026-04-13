<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;

$tenantId = 1;
$storeId = 4;

// Step 1: Products query (same as CatalogController)
$products = DB::table('products')
    ->where('tenant_id', $tenantId)
    ->orderByDesc('id')
    ->limit(200)
    ->get();
echo "Step1: " . count($products) . " products from DB\n";

// Step 2: Variants with store join
$productIds = $products->pluck('id')->all();
$variants = DB::table('product_variants')
    ->where('product_variants.tenant_id', $tenantId)
    ->whereIn('product_id', $productIds ?: [0])
    ->join('store_product_variants as spv', function ($join) use ($tenantId, $storeId) {
        $join->on('spv.product_variant_id', '=', 'product_variants.id')
             ->where('spv.tenant_id', '=', $tenantId)
             ->where('spv.store_id', '=', $storeId)
             ->where('spv.is_enabled', '=', true);
    })
    ->select('product_variants.*')
    ->get()
    ->groupBy('product_id');

echo "Step2: {$variants->count()} products have variants for store $storeId\n";

// Step 3: Filter
$data = $products->map(function ($product) use ($variants) {
    $product->variants = $variants->get($product->id, collect())->values();
    return $product;
})->filter(fn ($product) => $product->variants->count() > 0)->values();

echo "Step3 (after filter): {$data->count()} products\n";

// Also check is_enabled values
$isEnabledTrue = DB::table('store_product_variants')->where('tenant_id', 1)->where('store_id', 4)->where('is_enabled', true)->count();
$isEnabledOne = DB::table('store_product_variants')->where('tenant_id', 1)->where('store_id', 4)->where('is_enabled', 1)->count();
$isEnabledRaw = DB::table('store_product_variants')->where('tenant_id', 1)->where('store_id', 4)->count();
echo "\nis_enabled=true: $isEnabledTrue\nis_enabled=1: $isEnabledOne\ntotal: $isEnabledRaw\n";

// Check first few rows
$rows = DB::table('store_product_variants')->where('tenant_id', 1)->where('store_id', 4)->take(3)->get(['id','product_variant_id','is_enabled']);
echo "\nSample rows: " . json_encode($rows) . "\n";

// Fix barcode for operator 5555
echo "\n--- Fixing barcode for Operatore Caivano ---\n";
DB::table('employees')->where('id', 6)->update(['barcode' => '5555']);
$check = DB::table('employees')->where('id', 6)->first(['id','first_name','last_name','barcode']);
echo "Updated: " . json_encode($check) . "\n";
