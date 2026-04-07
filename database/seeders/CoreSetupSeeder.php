<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CoreSetupSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $now = now();

        $tenantId = DB::table('tenants')->insertGetId([
            'name' => 'Tenant Demo',
            'code' => 'DEMO',
            'vat_number' => 'IT00000000000',
            'timezone' => 'Europe/Rome',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $storeId = DB::table('stores')->insertGetId([
            'tenant_id' => $tenantId,
            'code' => 'MAIN',
            'name' => 'Negozio Centrale',
            'city' => 'Roma',
            'country' => 'IT',
            'timezone' => 'Europe/Rome',
            'is_main' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $milanStoreId = DB::table('stores')->insertGetId([
            'tenant_id' => $tenantId,
            'code' => 'MILANO',
            'name' => 'Negozio Milano',
            'city' => 'Milano',
            'country' => 'IT',
            'timezone' => 'Europe/Rome',
            'is_main' => false,
            'auto_reorder_enabled' => true,
            'smart_reorder_threshold' => 3,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $roles = [
            ['code' => 'superadmin', 'name' => 'Super Admin'],
            ['code' => 'admin_cliente', 'name' => 'Admin Cliente'],
            ['code' => 'dipendente', 'name' => 'Dipendente'],
            ['code' => 'cliente_finale', 'name' => 'Cliente Finale'],
        ];

        foreach ($roles as $role) {
            DB::table('roles')->updateOrInsert(
                ['code' => $role['code']],
                ['name' => $role['name'], 'updated_at' => $now, 'created_at' => $now]
            );
        }

        $permissions = [
            ['code' => 'tenant.manage', 'name' => 'Gestione tenant'],
            ['code' => 'tax.manage', 'name' => 'Gestione tasse e accise'],
            ['code' => 'orders.manage', 'name' => 'Gestione ordini'],
            ['code' => 'inventory.manage', 'name' => 'Gestione inventario'],
            ['code' => 'employees.manage', 'name' => 'Gestione dipendenti'],
            ['code' => 'loyalty.manage', 'name' => 'Gestione loyalty'],
            ['code' => 'catalog.manage', 'name' => 'Gestione catalogo'],
            ['code' => 'customers.manage', 'name' => 'Gestione clienti'],
            ['code' => 'suppliers.manage', 'name' => 'Gestione fornitori'],
            ['code' => 'purchase_orders.manage', 'name' => 'Gestione ordini acquisto'],
            ['code' => 'pos_sessions.manage', 'name' => 'Gestione sessioni POS'],
            ['code' => 'invoices.manage', 'name' => 'Gestione fatture e SDI'],
            ['code' => 'documents.generate', 'name' => 'Generazione documenti'],
            ['code' => 'reports.view', 'name' => 'Visualizzazione report'],
            ['code' => 'shipping.manage', 'name' => 'Gestione spedizioni'],
            ['code' => 'audit.view', 'name' => 'Visualizzazione audit log'],
            ['code' => 'roles.manage', 'name' => 'Gestione ruoli e permessi'],
        ];

        foreach ($permissions as $permission) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $permission['code']],
                ['name' => $permission['name'], 'updated_at' => $now, 'created_at' => $now]
            );
        }

        $superAdminUserId = DB::table('users')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => 'Super Admin',
            'email' => 'superadmin@demo.local',
            'password' => Hash::make('ChangeMe123!'),
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $adminClienteUserId = DB::table('users')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => 'Admin Cliente',
            'email' => 'admin@demo.local',
            'password' => Hash::make('ChangeMe123!'),
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $dipendenteUserId = DB::table('users')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => 'Operatore POS',
            'email' => 'staff@demo.local',
            'password' => Hash::make('ChangeMe123!'),
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $superAdminRoleId = DB::table('roles')->where('code', 'superadmin')->value('id');
        $adminClienteRoleId = DB::table('roles')->where('code', 'admin_cliente')->value('id');
        $dipendenteRoleId = DB::table('roles')->where('code', 'dipendente')->value('id');

        DB::table('user_roles')->insert([
            [
                'user_id' => $superAdminUserId,
                'role_id' => $superAdminRoleId,
                'tenant_id' => $tenantId,
                'store_id' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'user_id' => $adminClienteUserId,
                'role_id' => $adminClienteRoleId,
                'tenant_id' => $tenantId,
                'store_id' => $storeId,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'user_id' => $dipendenteUserId,
                'role_id' => $dipendenteRoleId,
                'tenant_id' => $tenantId,
                'store_id' => $storeId,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $allPermissionIds = DB::table('permissions')->pluck('id')->all();
        foreach ($allPermissionIds as $permissionId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $superAdminRoleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        // Admin Cliente: tutto tranne tenant.manage e roles.manage
        $adminPermCodes = [
            'tax.manage', 'orders.manage', 'inventory.manage', 'employees.manage',
            'loyalty.manage', 'catalog.manage', 'customers.manage', 'suppliers.manage',
            'purchase_orders.manage', 'pos_sessions.manage', 'invoices.manage',
            'documents.generate', 'reports.view', 'shipping.manage', 'audit.view',
        ];
        $adminPermIds = DB::table('permissions')->whereIn('code', $adminPermCodes)->pluck('id')->all();
        foreach ($adminPermIds as $permissionId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $adminClienteRoleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        // Dipendente: operazioni quotidiane
        $dipPermCodes = [
            'orders.manage', 'inventory.manage', 'pos_sessions.manage',
            'customers.manage', 'documents.generate',
        ];
        $dipPermIds = DB::table('permissions')->whereIn('code', $dipPermCodes)->pluck('id')->all();
        foreach ($dipPermIds as $permissionId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $dipendenteRoleId, 'permission_id' => $permissionId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        DB::table('tax_classes')->insert([
            [
                'tenant_id' => $tenantId,
                'code' => 'STANDARD',
                'name' => 'IVA Standard',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tenant_id' => $tenantId,
                'code' => 'REDUCED',
                'name' => 'IVA Ridotta',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $standardTaxClassId = DB::table('tax_classes')
            ->where('tenant_id', $tenantId)
            ->where('code', 'STANDARD')
            ->value('id');

        DB::table('tax_rules')->insert([
            'tenant_id' => $tenantId,
            'tax_class_id' => $standardTaxClassId,
            'country' => 'IT',
            'region' => null,
            'vat_rate' => 22.00,
            'valid_from' => $now,
            'valid_to' => null,
            'priority' => 100,
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $supplierId = DB::table('suppliers')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => 'Distribuzione Vape Italia',
            'vat_number' => 'IT11111111111',
            'email' => 'ordini@supplier.demo',
            'phone' => '0212345678',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $brandId = DB::table('brands')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => 'Demo Vape',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $categoryId = DB::table('categories')->insertGetId([
            'tenant_id' => $tenantId,
            'parent_id' => null,
            'name' => 'Liquidi',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $productId = DB::table('products')->insertGetId([
            'tenant_id' => $tenantId,
            'sku' => 'LIQ-DEMO-001',
            'barcode' => '800000000001',
            'name' => 'Liquido Demo 10ml',
            'product_type' => 'liquid',
            'brand_id' => $brandId,
            'category_id' => $categoryId,
            'default_supplier_id' => $supplierId,
            'nicotine_mg' => 9,
            'volume_ml' => 10,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $variantId = DB::table('product_variants')->insertGetId([
            'tenant_id' => $tenantId,
            'product_id' => $productId,
            'flavor' => 'Classic Tobacco',
            'resistance_ohm' => null,
            'pack_size' => 1,
            'cost_price' => 2.50,
            'sale_price' => 6.90,
            'tax_class_id' => $standardTaxClassId,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $warehouseId = DB::table('warehouses')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $storeId,
            'name' => 'Magazzino Centrale',
            'type' => 'store',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $milanWarehouseId = DB::table('warehouses')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $milanStoreId,
            'name' => 'Magazzino Milano',
            'type' => 'store',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('stock_items')->insert([
            'tenant_id' => $tenantId,
            'warehouse_id' => $warehouseId,
            'product_variant_id' => $variantId,
            'on_hand' => 120,
            'reserved' => 0,
            'reorder_point' => 20,
            'safety_stock' => 15,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('stock_items')->insert([
            'tenant_id' => $tenantId,
            'warehouse_id' => $milanWarehouseId,
            'product_variant_id' => $variantId,
            'on_hand' => 3,
            'reserved' => 0,
            'reorder_point' => 3,
            'safety_stock' => 8,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $customerId = DB::table('customers')->insertGetId([
            'tenant_id' => $tenantId,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'code' => 'CUST-0001',
            'first_name' => 'Mario',
            'last_name' => 'Rossi',
            'email' => 'cliente.demo@example.com',
            'phone' => '3330000000',
            'birth_date' => null,
            'marketing_consent' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('loyalty_cards')->insert([
            'tenant_id' => $tenantId,
            'customer_id' => $customerId,
            'card_code' => 'CARD-0001',
            'status' => 'active',
            'issued_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('loyalty_wallets')->insert([
            'tenant_id' => $tenantId,
            'customer_id' => $customerId,
            'points_balance' => 0,
            'tier_code' => 'base',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $employeeId = DB::table('employees')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $storeId,
            'user_id' => $dipendenteUserId,
            'first_name' => 'Operatore',
            'last_name' => 'POS',
            'photo_url' => null,
            'hire_date' => $now->toDateString(),
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('employee_point_wallets')->insert([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
            'points_balance' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $seedOrderId = DB::table('sales_orders')->insertGetId([
            'tenant_id' => $tenantId,
            'store_id' => $milanStoreId,
            'channel' => 'pos',
            'customer_id' => $customerId,
            'status' => 'paid',
            'currency' => 'EUR',
            'subtotal' => 13.80,
            'discount_total' => 0,
            'tax_total' => 3.04,
            'excise_total' => 2.00,
            'grand_total' => 18.84,
            'paid_at' => $now->copy()->subDay(),
            'created_at' => $now->copy()->subDay(),
            'updated_at' => $now->copy()->subDay(),
        ]);

        DB::table('sales_order_lines')->insert([
            'sales_order_id' => $seedOrderId,
            'product_variant_id' => $variantId,
            'qty' => 2,
            'unit_price' => 6.90,
            'discount_amount' => 0,
            'tax_amount' => 3.04,
            'excise_amount' => 2.00,
            'line_total' => 18.84,
            'tax_snapshot_json' => json_encode(['vat_rate' => 22, 'product_type' => 'liquid']),
            'created_at' => $now->copy()->subDay(),
            'updated_at' => $now->copy()->subDay(),
        ]);

        DB::table('payments')->insert([
            'tenant_id' => $tenantId,
            'sales_order_id' => $seedOrderId,
            'method' => 'cash',
            'amount' => 18.84,
            'status' => 'paid',
            'paid_at' => $now->copy()->subDay(),
            'created_at' => $now->copy()->subDay(),
            'updated_at' => $now->copy()->subDay(),
        ]);

        DB::table('stock_movements')->insert([
            'tenant_id' => $tenantId,
            'warehouse_id' => $milanWarehouseId,
            'product_variant_id' => $variantId,
            'movement_type' => 'seed_sale',
            'qty' => -2,
            'unit_cost' => 2.50,
            'reference_type' => 'sales_order',
            'reference_id' => $seedOrderId,
            'employee_id' => $dipendenteUserId,
            'occurred_at' => $now->copy()->subDay(),
            'created_at' => $now->copy()->subDay(),
            'updated_at' => $now->copy()->subDay(),
        ]);

        DB::table('compensation_rules')->insert([
            'tenant_id' => null,
            'name' => 'Regola base punti dipendente',
            'formula_expression' => 'floor((margin_amount * 0.8 + net_amount * 0.2) / 10)',
            'valid_from' => $now,
            'active' => true,
            'created_by' => $superAdminUserId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $ruleSetId = DB::table('excise_rule_sets')->insertGetId([
            'tenant_id' => null,
            'name' => 'Accisa default Italia',
            'status' => 'active',
            'valid_from' => $now,
            'created_by' => $superAdminUserId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('excise_rules')->insert([
            'rule_set_id' => $ruleSetId,
            'product_type' => 'liquid',
            'rate_type' => 'per_ml',
            'rate_value' => 0.10,
            'min_amount' => 0,
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $secondTenantId = DB::table('tenants')->insertGetId([
            'name' => 'Tenant Nord',
            'code' => 'NORD',
            'vat_number' => 'IT22222222222',
            'timezone' => 'Europe/Rome',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $secondStoreId = DB::table('stores')->insertGetId([
            'tenant_id' => $secondTenantId,
            'code' => 'TORINO',
            'name' => 'Negozio Torino',
            'city' => 'Torino',
            'country' => 'IT',
            'timezone' => 'Europe/Rome',
            'is_main' => true,
            'auto_reorder_enabled' => true,
            'smart_reorder_threshold' => 4,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northAdminUserId = DB::table('users')->insertGetId([
            'tenant_id' => $secondTenantId,
            'name' => 'Admin Nord',
            'email' => 'admin@nord.local',
            'password' => Hash::make('ChangeMe123!'),
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('user_roles')->insert([
            'user_id' => $northAdminUserId,
            'role_id' => $adminClienteRoleId,
            'tenant_id' => $secondTenantId,
            'store_id' => $secondStoreId,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northBrandId = DB::table('brands')->insertGetId([
            'tenant_id' => $secondTenantId,
            'name' => 'Nord Vape',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northCategoryId = DB::table('categories')->insertGetId([
            'tenant_id' => $secondTenantId,
            'parent_id' => null,
            'name' => 'Pod',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northTaxClassId = DB::table('tax_classes')->insertGetId([
            'tenant_id' => $secondTenantId,
            'code' => 'STANDARD',
            'name' => 'IVA Standard',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northProductId = DB::table('products')->insertGetId([
            'tenant_id' => $secondTenantId,
            'sku' => 'POD-NORD-001',
            'barcode' => '800000000901',
            'name' => 'Starter Kit Nord',
            'product_type' => 'device',
            'brand_id' => $northBrandId,
            'category_id' => $northCategoryId,
            'default_supplier_id' => null,
            'nicotine_mg' => null,
            'volume_ml' => null,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northVariantId = DB::table('product_variants')->insertGetId([
            'tenant_id' => $secondTenantId,
            'product_id' => $northProductId,
            'flavor' => null,
            'resistance_ohm' => 1.2,
            'pack_size' => 1,
            'cost_price' => 10.00,
            'sale_price' => 19.90,
            'tax_class_id' => $northTaxClassId,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $northWarehouseId = DB::table('warehouses')->insertGetId([
            'tenant_id' => $secondTenantId,
            'store_id' => $secondStoreId,
            'name' => 'Magazzino Torino',
            'type' => 'store',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('stock_items')->insert([
            'tenant_id' => $secondTenantId,
            'warehouse_id' => $northWarehouseId,
            'product_variant_id' => $northVariantId,
            'on_hand' => 22,
            'reserved' => 0,
            'reorder_point' => 5,
            'safety_stock' => 3,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
