<?php

use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\CustomerReturnController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\InventoryCountController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LoyaltyController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RolesPermissionsController;
use App\Http\Controllers\Api\PosSessionController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ShippingController;
use App\Http\Controllers\Api\SmartInventoryController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SupplierInvoiceController;
use App\Http\Controllers\Api\HealthScanController;
use App\Http\Controllers\Api\LoyaltyCardController;
use App\Http\Controllers\Api\WooCommerceWebhookController;
use App\Http\Controllers\Api\StockTransferController;
use App\Http\Controllers\Api\DeliveryNoteController;
use App\Http\Controllers\Api\RestockOrderController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ReplenishmentController;
use App\Http\Controllers\Api\CashMovementController;
use App\Http\Controllers\Api\CoinShipmentController;
use App\Http\Controllers\Api\DailyCashReportController;
use App\Http\Controllers\Api\GamificationController;
use App\Http\Controllers\Api\PrestashopController;
use App\Http\Controllers\Api\AdmController;
use App\Http\Controllers\Api\AutoReorderController;
use App\Http\Controllers\Api\SmartRestockingController;

use App\Http\Controllers\Api\StoreDeliveryController;
use App\Http\Controllers\Api\InventorySessionController;
use Illuminate\Support\Facades\Route;



Route::get('/loyalty-card/{uuid}', [LoyaltyCardController::class, 'show']);
Route::post('/webhooks/woocommerce/order', [WooCommerceWebhookController::class, 'handleOrder']);
Route::get('/test-report-serale', function() {
    \Illuminate\Support\Facades\Artisan::call('app:daily-report');
    return response()->json([
        'message' => 'Test Report Completato. Notifiche attivate!',
        'output' => \Illuminate\Support\Facades\Artisan::output()
    ]);
});

Route::get('/prestashop/wipe-all-products', function() {
    set_time_limit(0);
    $count = \Illuminate\Support\Facades\DB::table('products')->count();
    
    // Ignoriamo gli errori su tabelle mancanti usando catch
    $tablesToWipe = [
        'delivery_note_items',
        'restock_order_items',
        'inventory_items',
        'purchase_order_lines',
        'stock_movements',
        'stock_items',
        'product_variants',
        'products'
    ];

    foreach ($tablesToWipe as $table) {
        try {
            \Illuminate\Support\Facades\DB::table($table)->delete();
        } catch (\Exception $e) {
            // Ignora errori se la tabella non esiste o ha vincoli
        }
    }

    return response()->json([
        'success' => true,
        'message' => "Successfully wiped $count products and all their dependencies!"
    ]);
});

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

// ── Endpoints di diagnostica temporanei (pubblici) ───────────────────────────
Route::get('/run-cleanup', function () {
    \Illuminate\Support\Facades\Artisan::call('app:cleanup-dummy-employees');
    return response()->json([
        'message' => 'Pulizia eseguita sul server live!',
        'output'  => \Illuminate\Support\Facades\Artisan::output()
    ]);
});

Route::get('/debug-catalog', function () {
    try {
        $db = \Illuminate\Support\Facades\DB::connection()->getPdo();
        $driver = \Illuminate\Support\Facades\DB::getDriverName();

        // Conteggi base
        $productCount = \Illuminate\Support\Facades\DB::table('products')->count();
        $variantCount = \Illuminate\Support\Facades\DB::table('product_variants')->count();
        $spvCount     = \Illuminate\Support\Facades\DB::table('store_product_variants')->count();
        $stockCount   = \Illuminate\Support\Facades\DB::table('stock_items')->count();

        // Colonne reali in product_variants (per scoprire colonne mancanti)
        if ($driver === 'pgsql') {
            $cols = \Illuminate\Support\Facades\DB::select(
                "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='product_variants' ORDER BY ordinal_position"
            );
        } else {
            $cols = \Illuminate\Support\Facades\DB::select("PRAGMA table_info(product_variants)");
        }

        // Prova la query reale del catalog
        $products = \Illuminate\Support\Facades\DB::table('products')->orderByDesc('id')->limit(3)->get();
        $pids = $products->pluck('id')->all();
        $variants = \Illuminate\Support\Facades\DB::table('product_variants')
            ->whereIn('product_id', $pids ?: [0])
            ->select('product_variants.*')
            ->get();

        return response()->json([
            'driver'        => $driver,
            'product_count' => $productCount,
            'variant_count' => $variantCount,
            'spv_count'     => $spvCount,
            'stock_count'   => $stockCount,
            'variant_columns' => $cols,
            'sample_variants' => $variants->take(2),
            'status'        => 'OK',
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'file'  => basename($e->getFile()),
            'line'  => $e->getLine(),
        ], 500);
    }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Debug SmartReorder: espone l'errore reale senza wrapping ──────────────────
Route::get('/debug-smart-reorder', function () {
    try {
        $tenantId = (int) \Illuminate\Support\Facades\DB::table('tenants')->value('id');
        $service  = app(\App\Services\SmartReorderService::class);
        $result   = $service->previewForTenant($tenantId);
        return response()->json(['ok' => true, 'alerts' => count($result['alerts'] ?? [])]);
    } catch (\Throwable $e) {
        return response()->json([
            'error'   => $e->getMessage(),
            'class'   => get_class($e),
            'file'    => str_replace(base_path(), '', $e->getFile()),
            'line'    => $e->getLine(),
        ], 500);
    }
});
// ─────────────────────────────────────────────────────────────────────────────


Route::get('/bulk-set-stock', function () {
    try {
        // Setta on_hand=1000 per TUTTI i stock_items di tutti i prodotti
        $updated = \Illuminate\Support\Facades\DB::table('stock_items')
            ->update([
                'on_hand'    => 1000,
                'reserved'   => 0,
                'updated_at' => now(),
            ]);

        // Assicura che ogni variante sia abilitata (is_enabled=true) in tutti gli store
        $spvUpdated = \Illuminate\Support\Facades\DB::table('store_product_variants')
            ->where('is_enabled', false)
            ->update(['is_enabled' => true, 'updated_at' => now()]);

        return response()->json([
            'success'        => true,
            'stock_rows_updated' => $updated,
            'spv_re_enabled'     => $spvUpdated,
            'message'        => "Stock impostato a 1000 per {$updated} righe. {$spvUpdated} store_product_variants riabilitati.",
        ]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

// Split stock: metà righe stock_items → 1000, metà → 0  (nessuna auth richiesta)
Route::get('/split-stock', function () {
    try {
        $now = now();

        // Trova l'ID mediano senza caricare tutti gli IDs in memoria
        $min   = \Illuminate\Support\Facades\DB::table('stock_items')->min('id');
        $max   = \Illuminate\Support\Facades\DB::table('stock_items')->max('id');
        $total = \Illuminate\Support\Facades\DB::table('stock_items')->count();

        if (!$min || !$max) {
            return response()->json(['success' => false, 'message' => 'Nessuna riga in stock_items']);
        }

        // Calcola l'ID pivot: l'ID al 50esimo percentile (evita il limite di 65535 param PG)
        $pivot = \Illuminate\Support\Facades\DB::table('stock_items')
            ->orderBy('id')
            ->skip((int) floor($total / 2))
            ->limit(1)
            ->value('id');

        $u1000 = \Illuminate\Support\Facades\DB::table('stock_items')
            ->where('id', '<=', $pivot)
            ->update(['on_hand' => 1000, 'reserved' => 0, 'updated_at' => $now]);

        $u0 = \Illuminate\Support\Facades\DB::table('stock_items')
            ->where('id', '>', $pivot)
            ->update(['on_hand' => 0, 'reserved' => 0, 'updated_at' => $now]);

        return response()->json([
            'success'     => true,
            'total_rows'  => $total,
            'pivot_id'    => $pivot,
            'set_to_1000' => $u1000,
            'set_to_0'    => $u0,
            'message'     => "Split: {$u1000} righe → 1000 pz | {$u0} righe → 0 pz",
        ]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

// Debug: mostra la struttura grezza di UN prodotto PS
// Chiamata: /api/debug-ps-product?url=https://...&api_key=KEY&ps_id=123
Route::get('/debug-ps-product', function (\Illuminate\Http\Request $request) {
    $url    = rtrim($request->input('url', ''), '/');
    $apiKey = $request->input('api_key', '');
    $psId   = (int) $request->input('ps_id', 0);
    if (!$url || !$apiKey) {
        return response()->json(['error' => 'Passa ?url=...&api_key=...']);
    }
    try {
        // Se ps_id non specificato, prendi il primo ID valido dalla lista
        if ($psId === 0) {
            $listRes = \Illuminate\Support\Facades\Http::timeout(15)->get("{$url}/api/products", [
                'ws_key'        => $apiKey,
                'output_format' => 'JSON',
                'display'       => '[id]',
                'limit'         => '5',
            ]);
            $listJson = $listRes->json();
            $ids = array_column($listJson['products'] ?? [], 'id');
            if (empty($ids)) {
                return response()->json([
                    'error'        => 'Nessun prodotto trovato o risposta non JSON',
                    'http_status'  => $listRes->status(),
                    'content_type' => $listRes->header('Content-Type'),
                    'raw_body'     => substr($listRes->body(), 0, 2000),
                    'json_parsed'  => $listJson,
                ]);
            }
            $psId = (int) $ids[0];
        }

        $res = \Illuminate\Support\Facades\Http::timeout(15)->get("{$url}/api/products/{$psId}", [
            'ws_key'        => $apiKey,
            'output_format' => 'JSON',
            'display'       => 'full',
        ]);
        $product = $res->json('product') ?? [];

        if (empty($product)) {
            return response()->json([
                'error'        => "Prodotto {$psId} non trovato o risposta non JSON",
                'http_status'  => $res->status(),
                'content_type' => $res->header('Content-Type'),
                'raw_body'     => substr($res->body(), 0, 2000),
            ]);
        }

        return response()->json([
            'ps_id_used'       => $psId,
            'id'               => $product['id'] ?? null,
            'reference'        => $product['reference'] ?? null,
            'price'            => $product['price'] ?? '⚠ MANCANTE',
            'price_ttc'        => $product['price_ttc'] ?? '⚠ MANCANTE',
            'tax_rate'         => $product['tax_rate'] ?? '⚠ MANCANTE',
            'id_default_image' => $product['id_default_image'] ?? '⚠ MANCANTE',
            'active'           => $product['active'] ?? null,
            'assoc_images'     => $product['associations']['images'] ?? null,
            // Tutti i campi disponibili (per debug completo)
            'all_keys'         => array_keys($product),
        ]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
});

// ── Vista Corriere: endpoint pubblici autenticati via tenant code (?tk=CODE)
Route::get('/driver/deliveries', [StoreDeliveryController::class, 'driverIndex']);
Route::patch('/driver/deliveries/{id}/status', [StoreDeliveryController::class, 'driverUpdate']);


Route::middleware(['auth:sanctum', 'tenant', 'throttle:1000,1'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // Stores READ — accessibile a tutti i ruoli autenticati (PM, dipendente, ecc.)
    Route::get('/stores', [StoreController::class, 'index']);
    Route::get('/stores/{storeId}', [StoreController::class, 'show']);

    // Store Deliveries Kanban — accessibile a tutti i ruoli manager
    Route::get('/store-deliveries', [StoreDeliveryController::class, 'index']);
    Route::post('/store-deliveries', [StoreDeliveryController::class, 'store']);
    Route::patch('/store-deliveries/{id}/status', [StoreDeliveryController::class, 'updateStatus']);
    Route::delete('/store-deliveries/{id}', [StoreDeliveryController::class, 'destroy']);

    // ── Smart Reorder (preview read-only — accessibile a tutti i ruoli) ───────
    Route::get('/inventory/smart-reorder/preview', [SmartInventoryController::class, 'preview']);
    Route::get('/inventory/smart-reorder/export-pdf', [SmartInventoryController::class, 'exportPdf']);
    Route::get('/inventory/forecast', [SmartInventoryController::class, 'forecast']);

    // ── Smart Restocking (Cabina di Regia Acquisti) ────────────────────
    Route::get('/smart-restocking/status', [SmartRestockingController::class, 'status']);
    Route::get('/smart-restocking/network-needs', [SmartRestockingController::class, 'networkNeeds']);
    Route::get('/smart-restocking/depot-needs', [SmartRestockingController::class, 'depotNeeds']);
    Route::get('/smart-restocking/brand-matrix', [SmartRestockingController::class, 'brandMatrix']);

    Route::middleware('role:superadmin,admin_cliente')->group(function () {
        // Smart Restocking — azioni di scrittura (solo admin)
        Route::post('/smart-restocking/calculate', [SmartRestockingController::class, 'calculate']);
        Route::post('/smart-restocking/approve-ddt/{transferId}', [SmartRestockingController::class, 'approveDdt']);
        Route::post('/smart-restocking/generate-po', [SmartRestockingController::class, 'generatePo']);
        Route::put('/smart-restocking/brand-matrix', [SmartRestockingController::class, 'upsertBrandMatrix']);
        Route::delete('/smart-restocking/brand-matrix', [SmartRestockingController::class, 'removeBrandMatrix']);

        // ── Stock Rules Engine ──────────────────────────────────────────────────
        Route::get('/logistics/store-groups', [\App\Http\Controllers\Api\StockRulesController::class, 'getStoreGroups']);
        Route::post('/logistics/store-groups', [\App\Http\Controllers\Api\StockRulesController::class, 'saveStoreGroup']);
        Route::delete('/logistics/store-groups/{id}', [\App\Http\Controllers\Api\StockRulesController::class, 'deleteStoreGroup']);
        Route::get('/logistics/stock-rules', [\App\Http\Controllers\Api\StockRulesController::class, 'getRules']);
        Route::post('/logistics/stock-rules/apply', [\App\Http\Controllers\Api\StockRulesController::class, 'saveAndApplyRule']);

        Route::get('/tenants', [StoreController::class, 'tenants']);
        Route::get('/tenants/health', [StoreController::class, 'tenantHealth']);
        Route::get('/audit-logs', [AuditController::class, 'index']);
        Route::get('/audit-logs/filters', [AuditController::class, 'filters']);
        Route::get('/audit-logs/{logId}', [AuditController::class, 'show']);
        Route::get('/tenant-settings', [StoreController::class, 'tenantSettings']);
        Route::put('/tenant-settings', [StoreController::class, 'updateTenantSettings']);
        
        Route::get('/roles-permissions', [RolesPermissionsController::class, 'matrix']);
        Route::post('/roles-permissions/toggle', [RolesPermissionsController::class, 'toggle'])->middleware('permission:roles.manage');
        Route::post('/roles-permissions/roles', [RolesPermissionsController::class, 'storeRole']);
        Route::put('/roles-permissions/roles/{id}', [RolesPermissionsController::class, 'updateRole']);
        Route::delete('/roles-permissions/roles/{id}', [RolesPermissionsController::class, 'destroyRole']);
        Route::post('/roles-permissions/permissions', [RolesPermissionsController::class, 'storePermission']);
        Route::delete('/roles-permissions/permissions/{id}', [RolesPermissionsController::class, 'destroyPermission']);
        Route::get('/roles-permissions/users', [RolesPermissionsController::class, 'listUsers']);
        Route::post('/roles-permissions/users', [RolesPermissionsController::class, 'storeUser']);
        Route::get('/roles-permissions/users/{id}', [RolesPermissionsController::class, 'showUser']);
        Route::put('/roles-permissions/users/{id}', [RolesPermissionsController::class, 'updateUser']);
        Route::delete('/roles-permissions/users/{id}', [RolesPermissionsController::class, 'destroyUser']);
        Route::post('/roles-permissions/users/assign', [RolesPermissionsController::class, 'assignRole']);
        Route::post('/roles-permissions/users/revoke', [RolesPermissionsController::class, 'revokeRole']);
        Route::get('/auth/switchable-users', [AuthController::class, 'switchableUsers']);
        Route::post('/auth/impersonate', [AuthController::class, 'impersonate']);
        // Stores CRUD (write - solo admin)
        Route::post('/stores', [StoreController::class, 'store']);
        Route::put('/stores/{storeId}', [StoreController::class, 'update']);
        Route::delete('/stores/{storeId}', [StoreController::class, 'destroy']);
        Route::post('/stores/{storeId}/credentials', [StoreController::class, 'createCredentials']);
        Route::get('/stores/{storeId}/credentials', [StoreController::class, 'getCredentials']);
        Route::post('/stores/{storeId}/notify-managers', [StoreController::class, 'notifyManagers']);
        Route::post('/stores/{storeId}/test-whatsapp', [StoreController::class, 'testWhatsapp']);
        Route::get('/loyalty/monitoring/push-stats', [LoyaltyController::class, 'pushMonitoringStats']);

        // Catalog WRITE - solo admin
        Route::post('/catalog/products/import', [CatalogController::class, 'import'])->middleware('permission:catalog.manage');
        Route::post('/catalog/products', [CatalogController::class, 'store'])->middleware('permission:catalog.manage');
        Route::put('/catalog/products/{productId}', [CatalogController::class, 'update'])->middleware('permission:catalog.manage');
        Route::delete('/catalog/products/{productId}', [CatalogController::class, 'destroy'])->middleware('permission:catalog.manage');
        Route::patch('/catalog/products/{productId}/featured', [CatalogController::class, 'toggleFeatured'])->middleware('permission:catalog.manage');
        Route::post('/catalog/bulk-excise', [CatalogController::class, 'bulkExcise'])->middleware('permission:catalog.manage');
        Route::patch('/catalog/products/bulk-update', \App\Http\Controllers\Api\ProductBulkUpdateController::class)->middleware('permission:catalog.manage');
        Route::patch('/catalog/products/bulk-barcodes', [\App\Http\Controllers\Api\ProductBulkBarcodeController::class, 'updateBarcodes'])->middleware('permission:catalog.manage');

        Route::post('/catalog/categories', [CatalogController::class, 'storeCategory'])->middleware('permission:catalog.manage');
        Route::put('/catalog/categories/{categoryId}', [CatalogController::class, 'updateCategory'])->middleware('permission:catalog.manage');
        Route::delete('/catalog/categories/{categoryId}', [CatalogController::class, 'destroyCategory'])->middleware('permission:catalog.manage');

        // PrestaShop Import - solo admin
        Route::post('/prestashop/test', [PrestashopController::class, 'test']);
        Route::post('/prestashop/import/start', [PrestashopController::class, 'startImport']);
        Route::post('/prestashop/import/batch', [PrestashopController::class, 'importBatch']);
        Route::post('/prestashop/fetch-images', [PrestashopController::class, 'fetchImages']);

        Route::post('/customers', [CustomerController::class, 'store'])->middleware('permission:customers.manage');
        Route::put('/customers/{customerId}', [CustomerController::class, 'update'])->middleware('permission:customers.manage');
        Route::post('/customers/{customerId}/otp/send', [CustomerController::class, 'sendOtp']);
        Route::post('/customers/{customerId}/otp/verify', [CustomerController::class, 'verifyOtp']);
        Route::post('/customers/{customerId}/email-otp/send', [CustomerController::class, 'sendEmailOtp']);
        Route::post('/customers/{customerId}/email-otp/verify', [CustomerController::class, 'verifyEmailOtp']);
        Route::post('/customers/{customerId}/visura', [CustomerController::class, 'uploadVisura'])->middleware('permission:customers.manage');
        Route::get('/customers/{customerId}/visura/download', [CustomerController::class, 'downloadVisura'])->middleware('permission:customers.manage');
        Route::post('/customers/{customerId}/send-whatsapp', [CustomerController::class, 'sendWhatsapp']);
        Route::post('/customers/{customerId}/send-email', [CustomerController::class, 'sendEmail']);
        Route::get('/customers/analytics/return-frequency', [CustomerController::class, 'returnFrequencyAnalytics']);
        // Marketing bulk
        Route::post('/customers/bulk/whatsapp', [CustomerController::class, 'bulkWhatsapp']);
        Route::post('/customers/bulk/email', [CustomerController::class, 'bulkEmail']);

        // Suppliers
        Route::get('/suppliers', [SupplierController::class, 'index']);
        Route::get('/suppliers/{supplierId}', [SupplierController::class, 'show']);
        Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('permission:suppliers.manage');
        Route::put('/suppliers/{supplierId}', [SupplierController::class, 'update'])->middleware('permission:suppliers.manage');
        Route::delete('/suppliers/{supplierId}', [SupplierController::class, 'destroy'])->middleware('permission:suppliers.manage');

        // Purchase Orders
        Route::get('/purchase-orders/auto-suggest', [PurchaseOrderController::class, 'autoSuggest']);
        Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
        Route::get('/purchase-orders/{poId}', [PurchaseOrderController::class, 'show']);
        Route::post('/purchase-orders', [PurchaseOrderController::class, 'store'])->middleware('permission:purchase_orders.manage');
        Route::put('/purchase-orders/{poId}', [PurchaseOrderController::class, 'update'])->middleware('permission:purchase_orders.manage');
        Route::post('/purchase-orders/{poId}/send', [PurchaseOrderController::class, 'send'])->middleware('permission:purchase_orders.manage');
        Route::post('/purchase-orders/{poId}/receive', [PurchaseOrderController::class, 'receive'])->middleware('permission:purchase_orders.manage');
        Route::post('/purchase-orders/{poId}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware('permission:purchase_orders.manage');
        Route::patch('/purchase-orders/{poId}/fulfillment', [PurchaseOrderController::class, 'patchFulfillment'])->middleware('permission:purchase_orders.manage');

        Route::get('/shipping/carriers', [ShippingController::class, 'carriers']);
        Route::post('/shipping/carriers', [ShippingController::class, 'storeCarrier'])->middleware('permission:shipping.manage');
        Route::get('/shipping/shipments', [ShippingController::class, 'shipments']);
        Route::post('/shipping/shipments', [ShippingController::class, 'createShipment'])->middleware('permission:shipping.manage');
        Route::put('/shipping/shipments/{shipmentId}', [ShippingController::class, 'updateShipmentStatus'])->middleware('permission:shipping.manage');

        Route::post('/inventory/adjust', [InventoryController::class, 'adjust'])->middleware('permission:inventory.manage');
        Route::get('/inventory/cross-store', [InventoryController::class, 'crossStore']);

        Route::get('/orders/stock-alerts', [OrderController::class, 'stockAlerts']);
        Route::post('/orders/stock-alerts/{alertId}/resolve', [OrderController::class, 'resolveStockAlert']);

        Route::post('/inventory/smart-reorder/run', [SmartInventoryController::class, 'run'])->middleware('permission:inventory.manage');
        Route::post('/inventory/smart-reorder/run-auto', [SmartInventoryController::class, 'runAutoToCentral'])->middleware('permission:inventory.manage');
        Route::post('/inventory/smart-reorder/email-supplier', [SmartInventoryController::class, 'emailSupplier']);

        // ── Riordino Automatico Fornitori (nuovo modulo) ──────────────────────
        Route::post('/reorder-drafts/generate', [AutoReorderController::class, 'generate'])->middleware('permission:purchase_orders.create');
        Route::get('/reorder-drafts', [AutoReorderController::class, 'index']);
        Route::get('/reorder-drafts/{id}', [AutoReorderController::class, 'show']);
        Route::patch('/reorder-drafts/{id}/lines/{lineId}', [AutoReorderController::class, 'updateLine'])->middleware('permission:purchase_orders.create');
        Route::post('/reorder-drafts/{id}/approve', [AutoReorderController::class, 'approve'])->middleware('permission:purchase_orders.create');
        Route::post('/reorder-drafts/{id}/discard', [AutoReorderController::class, 'discard'])->middleware('permission:purchase_orders.create');

        // ── ReplenishmentEngine (DRP + MRP) ──────────────────────────────
        Route::get('/trigger-replenishment/preview', [ReplenishmentController::class, 'preview']);
        Route::post('/trigger-replenishment', [ReplenishmentController::class, 'trigger'])
            ->middleware('permission:inventory.manage');

        // Health Scan
        Route::get('/health-scan', [HealthScanController::class, 'index']);

        // Exports
        Route::get('/export/orders', [ExportController::class, 'exportOrders']);
        Route::get('/export/customers', [ExportController::class, 'exportCustomers']);
        Route::get('/export/inventory', [ExportController::class, 'exportInventory']);

        // Invoices
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices/generate', [InvoiceController::class, 'generate'])->middleware('permission:invoices.manage');
        Route::get('/invoices/{id}/download', [InvoiceController::class, 'download']);
        Route::post('/invoices/{id}/send-email', [InvoiceController::class, 'sendEmail'])->middleware('permission:invoices.manage');
        Route::post('/invoices/{id}/send-sdi', [InvoiceController::class, 'sendToSdi'])->middleware('permission:invoices.manage');
        Route::post('/invoices/{id}/mark-paid', [InvoiceController::class, 'markPaid'])->middleware('permission:invoices.manage');

        // Supplier Invoices (Fatture Passive)
        Route::get('/supplier-invoices', [SupplierInvoiceController::class, 'index']);
        Route::get('/supplier-invoices/{id}', [SupplierInvoiceController::class, 'show']);
        Route::get('/supplier-invoices/{id}/export-xml', [SupplierInvoiceController::class, 'exportXml']);
        Route::post('/supplier-invoices', [SupplierInvoiceController::class, 'store'])->middleware('permission:invoices.manage');
        Route::put('/supplier-invoices/{id}', [SupplierInvoiceController::class, 'update'])->middleware('permission:invoices.manage');
        Route::post('/supplier-invoices/{id}/mark-paid', [SupplierInvoiceController::class, 'markPaid'])->middleware('permission:invoices.manage');
        Route::delete('/supplier-invoices/{id}', [SupplierInvoiceController::class, 'destroy'])->middleware('permission:invoices.manage');


        // Documents
        Route::post('/documents/generate', [DocumentController::class, 'generate'])->middleware('permission:documents.generate');

        // Customer Returns (Resi)
        Route::get('/returns', [CustomerReturnController::class, 'index']);
        Route::get('/returns/analytics', [CustomerReturnController::class, 'analytics']);
        Route::get('/returns/{id}', [CustomerReturnController::class, 'show']);
        Route::post('/returns', [CustomerReturnController::class, 'store'])->middleware('permission:orders.manage');
        Route::post('/returns/{id}/status', [CustomerReturnController::class, 'updateStatus'])->middleware('permission:orders.manage');

        // Reports
        Route::get('/reports/daily/latest', [\App\Http\Controllers\Api\DailyReportController::class, 'getLatest']);
        Route::get('/reports/daily/download', [\App\Http\Controllers\Api\DailyReportController::class, 'download']);
        Route::get('/reports/revenue-trend', [ReportController::class, 'revenueTrend']);
        Route::get('/reports/top-products', [ReportController::class, 'topProducts']);
        Route::get('/reports/customer-acquisition', [ReportController::class, 'customerAcquisition']);
        Route::get('/reports/summary', [ReportController::class, 'summary']);
        Route::get('/reports/qscare-dashboard', [ReportController::class, 'qscareDashboard']);
        Route::get('/reports/store-revenue', [ReportController::class, 'storeRevenue']);
        Route::get('/reports/store-revenue-history', [ReportController::class, 'storeRevenueHistory']);

        // Promotions & Bundles
        Route::get('/promotions', [PromotionController::class, 'index']);
        Route::get('/promotions/{id}', [PromotionController::class, 'show']);
        Route::post('/promotions', [PromotionController::class, 'store'])->middleware('permission:catalog.manage');
        Route::put('/promotions/{id}', [PromotionController::class, 'update'])->middleware('permission:catalog.manage');
        Route::post('/promotions/{id}/toggle', [PromotionController::class, 'toggleActive'])->middleware('permission:catalog.manage');
        Route::delete('/promotions/{id}', [PromotionController::class, 'destroy'])->middleware('permission:catalog.manage');
        Route::post('/promotions/validate-code', [PromotionController::class, 'validateCode']); // POS: valida codice promozionale

        // Inventory Count (Barcode Guided)
        Route::get('/inventory-counts', [InventoryCountController::class, 'sessions']);
        Route::get('/inventory-counts/{sessionId}', [InventoryCountController::class, 'sessionDetail']);
        Route::post('/inventory-counts', [InventoryCountController::class, 'createSession'])->middleware('permission:inventory.manage');
        Route::post('/inventory-counts/{sessionId}/count', [InventoryCountController::class, 'addCount'])->middleware('permission:inventory.manage');
        Route::post('/inventory-counts/{sessionId}/finalize', [InventoryCountController::class, 'finalize'])->middleware('permission:inventory.manage');

        // ── Inventory Sessions (Bolla Inventario) — Admin ──
        Route::get('/inventory-sessions/kpi', [InventorySessionController::class, 'kpi']);
        Route::get('/inventory-sessions/preview', [InventorySessionController::class, 'preview']);
        Route::get('/inventory-sessions/filter-options', [InventorySessionController::class, 'filterOptions']);
        Route::get('/inventory-sessions', [InventorySessionController::class, 'index']);
        Route::post('/inventory-sessions', [InventorySessionController::class, 'store']);
        Route::get('/inventory-sessions/{id}', [InventorySessionController::class, 'show']);
        Route::patch('/inventory-sessions/{id}/status', [InventorySessionController::class, 'updateStatus']);
        Route::post('/inventory-sessions/{id}/approve', [InventorySessionController::class, 'approve']);
        Route::delete('/inventory-sessions/{id}', [InventorySessionController::class, 'destroy']);

        // ── Inventory Sessions — Store endpoints moved to dipendente group ──
        // Loyalty Tiers & Redemptions (admin)
        Route::get('/loyalty/tiers', [LoyaltyController::class, 'tiers']);
        Route::post('/loyalty/tiers', [LoyaltyController::class, 'storeTier'])->middleware('permission:loyalty.manage');
        Route::put('/loyalty/tiers/{tierId}', [LoyaltyController::class, 'updateTier'])->middleware('permission:loyalty.manage');
        Route::delete('/loyalty/tiers/{tierId}', [LoyaltyController::class, 'deleteTier'])->middleware('permission:loyalty.manage');
        Route::get('/loyalty/redemptions', [LoyaltyController::class, 'redemptionHistory']);
        Route::post('/loyalty/customers/{customerId}/redeem', [LoyaltyController::class, 'redeemPoints'])->middleware('permission:loyalty.manage');

        // AI e Assistenza
        Route::post('/ai/chiedi-consiglio', [\App\Http\Controllers\Api\AiController::class, 'askAdvice']);
        Route::post('/ai/proponi-riordino', [\App\Http\Controllers\Api\AiController::class, 'acceptReorder']);
        Route::get('/ai/test-semplice', [\App\Http\Controllers\Api\AiController::class, 'testSemplice']);
        Route::get('/chat/rooms', [ChatController::class, 'rooms']);

        // Employee KPI Dashboard
        Route::get('/employees/kpi-dashboard', [EmployeeController::class, 'kpiDashboard']);
        Route::post('/employees/{employeeId}/kpi-target', [EmployeeController::class, 'setKpiTarget'])->middleware('permission:employees.manage');
        // Attendance - solo admin
        Route::get('/attendance', [AttendanceController::class, 'index']);
        Route::get('/attendance/history', [AttendanceController::class, 'history']);



        // Stock Transfers / DDT
        Route::get('/stock-transfers', [StockTransferController::class, 'index']);
        Route::post('/stock-transfers', [StockTransferController::class, 'store']);
        Route::post('/stock-transfers/{id}/send', [StockTransferController::class, 'send']);
        Route::post('/stock-transfers/{id}/receive', [StockTransferController::class, 'receive']);
        Route::post('/stock-transfers/{id}/cancel', [StockTransferController::class, 'cancel']);
        Route::delete('/stock-transfers/{id}', [StockTransferController::class, 'destroy']);

        // Delivery Notes (Bolle di Scarico) — admin crea, gestisce discrepanze
        Route::get('/delivery-notes', [DeliveryNoteController::class, 'index']);
        Route::get('/delivery-notes/discrepancies', [DeliveryNoteController::class, 'discrepancies']);
        Route::post('/delivery-notes/discrepancies/{id}/resolve', [DeliveryNoteController::class, 'resolveDiscrepancy']);
        Route::get('/delivery-notes/{id}', [DeliveryNoteController::class, 'show']);
        Route::post('/delivery-notes', [DeliveryNoteController::class, 'store']);
        Route::post('/delivery-notes/{id}/receive', [DeliveryNoteController::class, 'receive']);
        Route::post('/delivery-notes/{id}/brt-sync', [DeliveryNoteController::class, 'syncBrt']);
        Route::post('/delivery-notes/{id}/complete-verification', [DeliveryNoteController::class, 'completeVerification']);
        Route::post('/delivery-notes/{id}/items/{itemId}/scan', [DeliveryNoteController::class, 'scanItem']);
        Route::post('/delivery-notes/{id}/scan-by-barcode', [DeliveryNoteController::class, 'scanByBarcode']);
        Route::post('/delivery-notes/{id}/items/{itemId}/adjust-stock', [DeliveryNoteController::class, 'adjustStock']);

        // Ordini di Riassortimento Store (Magazzino → Negozio)
        Route::get('/restock-orders', [RestockOrderController::class, 'index']);
        Route::get('/restock-orders/{id}', [RestockOrderController::class, 'show']);
        Route::post('/restock-orders', [RestockOrderController::class, 'store']);
        Route::put('/restock-orders/{id}', [RestockOrderController::class, 'update']);
        Route::post('/restock-orders/{id}/confirm', [RestockOrderController::class, 'confirm']);
        Route::post('/restock-orders/{id}/start-preparing', [RestockOrderController::class, 'startPreparing']);
        Route::post('/restock-orders/{id}/ship', [RestockOrderController::class, 'ship']);
        Route::delete('/restock-orders/{id}', [RestockOrderController::class, 'destroy']);

        // ADM — Reportistica Fiscale PLI
        Route::post('/adm/generate-report', [AdmController::class, 'generateReport']);
        Route::get('/adm/history', [AdmController::class, 'getHistory']);

        // Chat — admin (area manager) vede tutti i messaggi
        Route::get('/chat/conversations', [ChatController::class, 'conversations']);
        Route::get('/chat/messages', [ChatController::class, 'index']);
        Route::post('/chat/messages', [ChatController::class, 'store']);
        Route::post('/chat/messages/read', [ChatController::class, 'markRead']);
    });

    Route::middleware('role:superadmin,admin_cliente,dipendente,magazziniere,project_manager,store_manager')->group(function () {
        // Catalog: accessibile anche ai dipendenti per il POS
        Route::get('/catalog/products', [CatalogController::class, 'index']);
        Route::get('/catalog/brands', [CatalogController::class, 'brands']);
        Route::get('/catalog/categories', [CatalogController::class, 'categories']);
        Route::get('/catalog/tax-classes', [CatalogController::class, 'taxClasses']);
        Route::get('/catalog/products/{productId}', [CatalogController::class, 'show']);

        // ── Inventory Sessions — Store (senza dati riservati) ──
        Route::get('/store/inventory-sessions', [InventorySessionController::class, 'storeIndex']);
        Route::get('/store/inventory-sessions/{id}', [InventorySessionController::class, 'storeShow']);
        Route::post('/store/inventory-sessions/{id}/scan', [InventorySessionController::class, 'scan']);
        Route::post('/store/inventory-sessions/{id}/close', [InventorySessionController::class, 'close']);
        Route::patch('/store/inventory-items/{itemId}/count', [InventorySessionController::class, 'updateCount']);
        
        // Comments accessibili anche allo store
        Route::get('/inventory-sessions/{id}/comments', [InventorySessionController::class, 'comments']);
        Route::post('/inventory-sessions/{id}/comments', [InventorySessionController::class, 'addComment']);

        Route::get('/inventory/warehouses', [InventoryController::class, 'getWarehouses']);
        Route::get('/inventory/stock', [InventoryController::class, 'index']);
        Route::get('/inventory/movements', [InventoryController::class, 'movements']);

        Route::get('/orders/options', [OrderController::class, 'options']);
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{orderId}', [OrderController::class, 'show']);
        Route::post('/orders/quote', [OrderController::class, 'quote']);
        Route::post('/orders/place', [OrderController::class, 'place']);

        // Dipendente ha bisogno di vedere i negozi per il selettore store nel POS
        Route::get('/stores', [StoreController::class, 'index']);
        Route::get('/stores/{storeId}', [StoreController::class, 'show']);
        // Dipendente: notifica manager per turni proposti
        Route::post('/stores/{storeId}/notify-managers', [StoreController::class, 'notifyManagers']);

        // POS Sessions
        Route::get('/pos/sessions', [PosSessionController::class, 'index']);
        Route::get('/pos/active', [PosSessionController::class, 'active']);
        Route::post('/pos/open', [PosSessionController::class, 'open'])->middleware('permission:pos_sessions.manage');
        Route::post('/pos/sessions/{sessionId}/close', [PosSessionController::class, 'close'])->middleware('permission:pos_sessions.manage');

        // Tesoreria - Cash Movements
        Route::get('/cash-movements', [CashMovementController::class, 'index']);
        Route::get('/cash-movements/balances', [CashMovementController::class, 'balances']);
        Route::get('/cash-movements/summary', [CashMovementController::class, 'summary']);
        Route::post('/cash-movements', [CashMovementController::class, 'store']);

        // Tesoreria - Pacchi Monete
        Route::get('/coin-shipments', [CoinShipmentController::class, 'index']);
        Route::post('/coin-shipments', [CoinShipmentController::class, 'store']);
        Route::post('/coin-shipments/{id}/confirm', [CoinShipmentController::class, 'confirm']);
        Route::post('/coin-shipments/{id}/reject', [CoinShipmentController::class, 'reject']);
        Route::get('/coin-shipments/dashboard', [CoinShipmentController::class, 'dashboardStats']);
        // Tesoreria - Incasso Giornaliero
        Route::get('/daily-cash-reports', [DailyCashReportController::class, 'index']);
        Route::get('/daily-cash-reports/preview', [DailyCashReportController::class, 'preview']);
        Route::post('/daily-cash-reports/submit', [DailyCashReportController::class, 'submit']);

        // Attendance - accessibile anche ai dipendenti (per timbrare se stessi)
        Route::get('/attendance/live', [AttendanceController::class, 'live']);
        Route::get('/attendance/employees-for-kiosk', [AttendanceController::class, 'employeesForKiosk']);
        Route::get('/attendance/history', [AttendanceController::class, 'history']); // per lo storico personale nel kiosk
        Route::post('/attendance/checkin', [AttendanceController::class, 'checkIn']);
        Route::post('/attendance/checkout', [AttendanceController::class, 'checkOut']);

        // Clienti: GET accessibili a tutti i ruoli (incluso dipendente)
        // POST/PUT senza permission check perché il dipendente deve poter creare clienti al POS
        Route::get('/customers', [CustomerController::class, 'index']);
        Route::get('/customers/{customerId}', [CustomerController::class, 'show']);
        Route::post('/customers', [CustomerController::class, 'store']);
        Route::put('/customers/{customerId}', [CustomerController::class, 'update']);

        // Delivery Notes — dipendente vede le bolle assegnate al suo negozio e registra la ricezione
        Route::get('/delivery-notes', [DeliveryNoteController::class, 'index']);
        Route::get('/delivery-notes/{id}', [DeliveryNoteController::class, 'show']);
        Route::post('/delivery-notes/{id}/receive', [DeliveryNoteController::class, 'receive']);
        Route::post('/delivery-notes/{id}/scan-by-barcode', [DeliveryNoteController::class, 'scanByBarcode']);
        Route::post('/delivery-notes/{id}/items/{itemId}/scan', [DeliveryNoteController::class, 'scanItem']);
        Route::post('/delivery-notes/{id}/complete-verification', [DeliveryNoteController::class, 'completeVerification']);

        // Chat — dipendente può chattare con area manager
        Route::get('/chat/messages', [ChatController::class, 'index']);
        Route::post('/chat/messages', [ChatController::class, 'store']);
        Route::post('/chat/messages/read', [ChatController::class, 'markRead']);

        // Dipendenti
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::get('/employees/global-list', [EmployeeController::class, 'globalList']);
        Route::get('/employees/analytics/top-performers', [EmployeeController::class, 'topPerformers']);
        Route::post('/employees', [EmployeeController::class, 'store'])->middleware('permission:employees.manage');
        Route::put('/employees/{employeeId}', [EmployeeController::class, 'update'])->middleware('permission:employees.manage');
        Route::delete('/employees/{employeeId}', [EmployeeController::class, 'destroy'])->middleware('permission:employees.manage');
        Route::post('/employees/{employeeId}/photo', [EmployeeController::class, 'uploadPhoto'])->middleware('permission:employees.manage');
        Route::get('/employees/{employeeId}/notifications', [EmployeeController::class, 'notifications']);
        Route::post('/employees/{employeeId}/notifications/{notificationId}/read', [EmployeeController::class, 'markNotificationRead']);
        Route::post('/employees/{employeeId}/notifications/read-all', [EmployeeController::class, 'markAllNotificationsRead']);


        // Gamification
        Route::get('/gamification/missions', [GamificationController::class, 'missions']);
        Route::get('/gamification/team-challenges', [GamificationController::class, 'teamChallenges']);
        Route::get('/gamification/leaderboard', [GamificationController::class, 'leaderboard']);
        Route::get('/gamification/player-stats', [GamificationController::class, 'playerStats']);

        // Employee's own shifts
        Route::get('/employee/my-shifts', [\App\Http\Controllers\Api\ShiftController::class, 'myShifts']);

        // Shifts & Rostering
        Route::get('/shifts', [\App\Http\Controllers\Api\ShiftController::class, 'index']);
        Route::post('/shifts/bulk', [\App\Http\Controllers\Api\ShiftController::class, 'bulkSave']);
        Route::post('/shifts/propose', [\App\Http\Controllers\Api\ShiftController::class, 'propose']);
        Route::patch('/shifts/{id}/confirm', [\App\Http\Controllers\Api\ShiftController::class, 'confirmShift'])->middleware('permission:employees.manage');
        Route::post('/shifts/confirm-all', [\App\Http\Controllers\Api\ShiftController::class, 'confirmAll'])->middleware('permission:employees.manage');
        Route::get('/shifts/templates', [\App\Http\Controllers\Api\ShiftController::class, 'getTemplates']);
        Route::post('/shifts/templates', [\App\Http\Controllers\Api\ShiftController::class, 'saveTemplate']);
        Route::delete('/shifts/templates/{id}', [\App\Http\Controllers\Api\ShiftController::class, 'deleteTemplate']);

        // Shift week lock/confirm workflow
        Route::post('/shifts/lock-week', [\App\Http\Controllers\Api\ShiftController::class, 'lockWeek']);
        Route::post('/shifts/unlock-week', [\App\Http\Controllers\Api\ShiftController::class, 'unlockWeek']);
        Route::get('/shifts/week-locks', [\App\Http\Controllers\Api\ShiftController::class, 'getWeekLocks']);
        Route::post('/shifts/confirm-week', [\App\Http\Controllers\Api\ShiftController::class, 'confirmWeek']);
        
        Route::get('/run-cleanup-internal', function () {
            \Illuminate\Support\Facades\Artisan::call('app:cleanup-dummy-employees');
            return response()->json(['output' => \Illuminate\Support\Facades\Artisan::output()]);
        });

        // ── Bulk Stock Seed: imposta tutti i prodotti a 1000 (attivi) o 0 (inattivi) ──
        // USO: GET /api/v1/dev/seed-stock   (solo superadmin / admin_cliente)
        Route::get('/dev/seed-stock', function (\Illuminate\Http\Request $request) {
            $tenantId = (int) $request->attributes->get('tenant_id');
            $now      = now();

            // Prodotti attivi → 1000 pz in tutti i loro stock_items
            $activeVariantIds = \Illuminate\Support\Facades\DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('pv.tenant_id', $tenantId)
                ->where('p.is_active', true)
                ->pluck('pv.id');

            $updatedActive = \Illuminate\Support\Facades\DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->whereIn('product_variant_id', $activeVariantIds)
                ->update(['on_hand' => 1000, 'reserved' => 0, 'updated_at' => $now]);

            // Prodotti inattivi → 0 pz
            $inactiveVariantIds = \Illuminate\Support\Facades\DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('pv.tenant_id', $tenantId)
                ->where('p.is_active', false)
                ->pluck('pv.id');

            $updatedInactive = \Illuminate\Support\Facades\DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->whereIn('product_variant_id', $inactiveVariantIds)
                ->update(['on_hand' => 0, 'reserved' => 0, 'updated_at' => $now]);

            return response()->json([
                'success'          => true,
                'active_updated'   => $updatedActive,
                'inactive_zeroed'  => $updatedInactive,
                'message'          => "Stock impostato: {$updatedActive} varianti attive → 1000 pz | {$updatedInactive} inattive → 0 pz",
            ]);
        })->middleware('role:superadmin,admin_cliente');

        // ── Bulk Stock Split: metà prodotti attivi → 1000, metà → 0 ──
        // USO: GET /api/v1/dev/seed-stock-split   (solo superadmin / admin_cliente)
        Route::get('/dev/seed-stock-split', function (\Illuminate\Http\Request $request) {
            $tenantId = (int) $request->attributes->get('tenant_id');
            $now      = now();

            // Tutti gli stock_items dei prodotti attivi, ordinati per ID (deterministico)
            $activeVariantIds = \Illuminate\Support\Facades\DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('pv.tenant_id', $tenantId)
                ->where('p.is_active', true)
                ->orderBy('pv.id')
                ->pluck('pv.id');

            $total    = $activeVariantIds->count();
            $half     = (int) ceil($total / 2);

            $firstHalf  = $activeVariantIds->take($half)->values();
            $secondHalf = $activeVariantIds->skip($half)->values();

            $updated1000 = \Illuminate\Support\Facades\DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->whereIn('product_variant_id', $firstHalf->all())
                ->update(['on_hand' => 1000, 'reserved' => 0, 'updated_at' => $now]);

            $updated0 = \Illuminate\Support\Facades\DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->whereIn('product_variant_id', $secondHalf->all())
                ->update(['on_hand' => 0, 'reserved' => 0, 'updated_at' => $now]);

            return response()->json([
                'success'       => true,
                'total_active'  => $total,
                'set_to_1000'   => $updated1000,
                'set_to_0'      => $updated0,
                'message'       => "Split completato: {$updated1000} stock_items → 1000 pz | {$updated0} → 0 pz",
            ]);
        })->middleware('role:superadmin,admin_cliente');

        // Reports — accessibili anche ai dipendenti (filtrati automaticamente al proprio store)
        Route::get('/reports/summary', [ReportController::class, 'summary']);
        Route::get('/reports/revenue-trend', [ReportController::class, 'revenueTrend']);
        Route::get('/reports/top-products', [ReportController::class, 'topProducts']);
        Route::get('/reports/customer-acquisition', [ReportController::class, 'customerAcquisition']);
        Route::get('/reports/qscare-dashboard', [ReportController::class, 'qscareDashboard']);
        Route::get('/reports/store-revenue', [ReportController::class, 'storeRevenue']);
        Route::get('/reports/store-revenue-history', [ReportController::class, 'storeRevenueHistory']);

        // Stock Transfers / DDT — magazziniere + dipendente
        Route::get('/stock-transfers', [StockTransferController::class, 'index']);
        Route::post('/stock-transfers', [StockTransferController::class, 'store']);
        Route::post('/stock-transfers/{id}/send', [StockTransferController::class, 'send']);
        Route::post('/stock-transfers/{id}/receive', [StockTransferController::class, 'receive']);
        Route::post('/stock-transfers/{id}/cancel', [StockTransferController::class, 'cancel']);
        Route::delete('/stock-transfers/{id}', [StockTransferController::class, 'destroy']);
    });

    Route::middleware('role:superadmin,admin_cliente,dipendente,cliente_finale')->group(function () {
        Route::get('/loyalty/customers/{customerId}/wallet', [LoyaltyController::class, 'showWallet']);
        Route::post('/loyalty/customers/{customerId}/devices', [LoyaltyController::class, 'registerDevice']);
        Route::get('/loyalty/customers/{customerId}/notifications', [LoyaltyController::class, 'notifications']);
        Route::post('/loyalty/customers/{customerId}/notifications/{notificationId}/read', [LoyaltyController::class, 'markNotificationRead']);
        Route::post('/loyalty/customers/{customerId}/redeem-preview', [LoyaltyController::class, 'redeemPreview']);
    });
});
