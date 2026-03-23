<?php

use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LoyaltyController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RolesPermissionsController;
use App\Http\Controllers\Api\ShippingController;
use App\Http\Controllers\Api\SmartInventoryController;
use App\Http\Controllers\Api\StoreController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'tenant'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    Route::middleware('role:superadmin,admin_cliente')->group(function () {
        Route::get('/tenants', [StoreController::class, 'tenants']);
        Route::get('/tenants/health', [StoreController::class, 'tenantHealth']);
        Route::get('/audit-logs', [AuditController::class, 'index']);
        Route::get('/tenant-settings', [StoreController::class, 'tenantSettings']);
        Route::put('/tenant-settings', [StoreController::class, 'updateTenantSettings']);
        Route::get('/roles-permissions', [RolesPermissionsController::class, 'matrix']);
        Route::post('/roles-permissions/toggle', [RolesPermissionsController::class, 'toggle']);
        Route::get('/auth/switchable-users', [AuthController::class, 'switchableUsers']);
        Route::post('/auth/impersonate', [AuthController::class, 'impersonate']);
        Route::get('/stores', [StoreController::class, 'index']);
        Route::get('/loyalty/monitoring/push-stats', [LoyaltyController::class, 'pushMonitoringStats']);

        Route::get('/catalog/products', [CatalogController::class, 'index']);
        Route::post('/catalog/products', [CatalogController::class, 'store']);
        Route::put('/catalog/products/{productId}', [CatalogController::class, 'update']);

        Route::get('/customers', [CustomerController::class, 'index']);
        Route::get('/customers/analytics/return-frequency', [CustomerController::class, 'returnFrequencyAnalytics']);
        Route::post('/customers', [CustomerController::class, 'store']);
        Route::put('/customers/{customerId}', [CustomerController::class, 'update']);

        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::get('/employees/analytics/top-performers', [EmployeeController::class, 'topPerformers']);
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::put('/employees/{employeeId}', [EmployeeController::class, 'update']);

        Route::get('/shipping/carriers', [ShippingController::class, 'carriers']);
        Route::post('/shipping/carriers', [ShippingController::class, 'storeCarrier']);
        Route::get('/shipping/shipments', [ShippingController::class, 'shipments']);
        Route::post('/shipping/shipments', [ShippingController::class, 'createShipment']);
        Route::put('/shipping/shipments/{shipmentId}', [ShippingController::class, 'updateShipmentStatus']);

        Route::post('/inventory/adjust', [InventoryController::class, 'adjust']);

        Route::get('/inventory/smart-reorder/preview', [SmartInventoryController::class, 'preview']);
        Route::post('/inventory/smart-reorder/run', [SmartInventoryController::class, 'run']);
        Route::post('/inventory/smart-reorder/run-auto', [SmartInventoryController::class, 'runAutoToCentral']);

        // Exports
        Route::get('/export/orders', [ExportController::class, 'exportOrders']);
        Route::get('/export/customers', [ExportController::class, 'exportCustomers']);
        Route::get('/export/inventory', [ExportController::class, 'exportInventory']);

        // Invoices
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices/generate', [InvoiceController::class, 'generate']);
        Route::get('/invoices/{id}/download', [InvoiceController::class, 'download']);

        // Reports
        Route::get('/reports/revenue-trend', [ReportController::class, 'revenueTrend']);
        Route::get('/reports/top-products', [ReportController::class, 'topProducts']);
        Route::get('/reports/customer-acquisition', [ReportController::class, 'customerAcquisition']);
        Route::get('/reports/summary', [ReportController::class, 'summary']);
    });

    Route::middleware('role:superadmin,admin_cliente,dipendente')->group(function () {
        Route::get('/inventory/stock', [InventoryController::class, 'index']);
        Route::get('/inventory/movements', [InventoryController::class, 'movements']);

        Route::post('/orders/quote', [OrderController::class, 'quote']);
        Route::post('/orders/place', [OrderController::class, 'place']);
    });

    Route::middleware('role:superadmin,admin_cliente,dipendente,cliente_finale')->group(function () {
        Route::get('/loyalty/customers/{customerId}/wallet', [LoyaltyController::class, 'showWallet']);
        Route::post('/loyalty/customers/{customerId}/devices', [LoyaltyController::class, 'registerDevice']);
        Route::get('/loyalty/customers/{customerId}/notifications', [LoyaltyController::class, 'notifications']);
        Route::post('/loyalty/customers/{customerId}/notifications/{notificationId}/read', [LoyaltyController::class, 'markNotificationRead']);
        Route::post('/loyalty/customers/{customerId}/redeem-preview', [LoyaltyController::class, 'redeemPreview']);
    });
});
