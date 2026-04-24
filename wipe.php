<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

try {
    DB::statement('SET session_replication_role = replica;'); // Disable FK checks in Postgres
} catch (\Exception $e) {
    try {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;'); // Disable FK checks in MySQL
    } catch (\Exception $e2) {
        // Ignore
    }
}

$count = DB::table('products')->count();

// We must delete from child tables first if we couldn't disable FKs.
DB::table('order_items')->delete();
DB::table('inventories')->delete();
DB::table('inventory_movements')->delete();
DB::table('store_product_variants')->delete();
DB::table('product_variants')->delete();
DB::table('products')->delete();

try {
    DB::statement('SET session_replication_role = origin;'); // Enable FK checks in Postgres
} catch (\Exception $e) {
    try {
        DB::statement('SET FOREIGN_KEY_CHECKS=1;'); // Enable FK checks in MySQL
    } catch (\Exception $e2) {
        // Ignore
    }
}

echo "Successfully wiped $count products from SvaPro.";
