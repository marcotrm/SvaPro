<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;

$tenantId = 1;
$days = 30;

// Simulate exactly what ReportController.summary does, step by step
echo "=== Step 1: orderBase query ===\n";
try {
    $orderBase = DB::table('sales_orders')
        ->where('tenant_id', $tenantId)
        ->where('status', 'paid')
        ->where('created_at', '>=', now()->subDays($days));

    $current = (clone $orderBase)->select(
        DB::raw('count(*) as orders'),
        DB::raw('coalesce(sum(grand_total), 0) as revenue'),
        DB::raw('coalesce(avg(grand_total), 0) as avg_order')
    )->first();
    echo "current: orders={$current->orders}, revenue={$current->revenue}\n";
} catch (\Throwable $e) {
    echo "ERROR Step1: " . $e->getMessage() . "\n";
}

echo "\n=== Step 2: payments query ===\n";
try {
    // Check if payments table exists
    $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table'");
    $tableNames = array_map(fn($t) => $t->name, $tables);
    echo "Tables with 'payment': " . implode(', ', array_filter($tableNames, fn($t) => str_contains($t, 'payment'))) . "\n";
    
    $paymentBase = DB::table('payments as pay')
        ->join('sales_orders as so2', 'so2.id', '=', 'pay.sales_order_id')
        ->where('so2.tenant_id', $tenantId)
        ->where('so2.status', 'paid')
        ->where('so2.created_at', '>=', now()->subDays($days));

    $cashTotal = (clone $paymentBase)->where('pay.method', 'cash')->sum('pay.amount');
    echo "cashTotal: $cashTotal\n";
} catch (\Throwable $e) {
    echo "ERROR Step2 (payments): " . $e->getMessage() . "\n";
}

echo "\n=== Step 3: customers query ===\n";
try {
    $customerCount = DB::table('customers')->where('tenant_id', $tenantId)->count();
    echo "customerCount: $customerCount\n";
} catch (\Throwable $e) {
    echo "ERROR Step3: " . $e->getMessage() . "\n";
}

echo "\n=== Step 4: stock_items query ===\n";
try {
    $lowStock = DB::table('stock_items')
        ->where('tenant_id', $tenantId)
        ->whereColumn('on_hand', '<', 'reorder_point')
        ->count();
    echo "lowStock: $lowStock\n";
} catch (\Throwable $e) {
    echo "ERROR Step4 (stock): " . $e->getMessage() . "\n";
}

echo "\n=== Step 5: itemsSold query ===\n";
try {
    $itemsSoldQuery = DB::table('sales_order_lines as sol')
        ->join('sales_orders as so', 'so.id', '=', 'sol.sales_order_id')
        ->where('so.tenant_id', $tenantId)
        ->where('so.status', 'paid')
        ->where('so.created_at', '>=', now()->subDays($days));
    $itemsSold = $itemsSoldQuery->sum('sol.qty');
    echo "itemsSold: $itemsSold\n";
} catch (\Throwable $e) {
    echo "ERROR Step5 (lines): " . $e->getMessage() . "\n";
}

echo "\n=== Check what StoreStatsDrawer sends ===\n";
// The drawer typically sends date_from and date_to
$dateFrom = date('Y-m-d'); // today
$dateTo   = date('Y-m-d');
try {
    $cnt = DB::table('sales_orders')
        ->where('tenant_id', $tenantId)
        ->where('status', 'paid')
        ->whereRaw("strftime('%Y-%m-%d', created_at) >= ?", [$dateFrom])
        ->whereRaw("strftime('%Y-%m-%d', created_at) <= ?", [$dateTo])
        ->count();
    echo "Orders today with strftime: $cnt\n";
} catch (\Throwable $e) {
    echo "ERROR dateFilter: " . $e->getMessage() . "\n";
}

echo "\n=== Check getSecureStoreId logic ===\n";
// Does employees table have store_id?
$emps = DB::table('employees')->where('tenant_id', $tenantId)->get(['id','store_id','user_id']);
foreach ($emps as $e) {
    echo "  emp_id:{$e->id}, store_id:{$e->store_id}, user_id:{$e->user_id}\n";
}
