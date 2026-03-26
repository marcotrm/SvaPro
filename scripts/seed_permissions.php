<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$now = now();

$newPerms = [
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

foreach ($newPerms as $p) {
    DB::table('permissions')->updateOrInsert(
        ['code' => $p['code']],
        ['name' => $p['name'], 'created_at' => $now, 'updated_at' => $now]
    );
}

$superAdminRoleId = DB::table('roles')->where('code', 'superadmin')->value('id');
$allPermIds = DB::table('permissions')->pluck('id')->all();
foreach ($allPermIds as $pid) {
    DB::table('role_permissions')->updateOrInsert(
        ['role_id' => $superAdminRoleId, 'permission_id' => $pid],
        ['created_at' => $now, 'updated_at' => $now]
    );
}

$adminRoleId = DB::table('roles')->where('code', 'admin_cliente')->value('id');
$adminCodes = [
    'tax.manage', 'orders.manage', 'inventory.manage', 'employees.manage',
    'loyalty.manage', 'catalog.manage', 'customers.manage', 'suppliers.manage',
    'purchase_orders.manage', 'pos_sessions.manage', 'invoices.manage',
    'documents.generate', 'reports.view', 'shipping.manage', 'audit.view',
];
$adminPids = DB::table('permissions')->whereIn('code', $adminCodes)->pluck('id')->all();
foreach ($adminPids as $pid) {
    DB::table('role_permissions')->updateOrInsert(
        ['role_id' => $adminRoleId, 'permission_id' => $pid],
        ['created_at' => $now, 'updated_at' => $now]
    );
}

$dipRoleId = DB::table('roles')->where('code', 'dipendente')->value('id');
$dipCodes = ['orders.manage', 'inventory.manage', 'pos_sessions.manage', 'customers.manage', 'documents.generate'];
$dipPids = DB::table('permissions')->whereIn('code', $dipCodes)->pluck('id')->all();
foreach ($dipPids as $pid) {
    DB::table('role_permissions')->updateOrInsert(
        ['role_id' => $dipRoleId, 'permission_id' => $pid],
        ['created_at' => $now, 'updated_at' => $now]
    );
}

echo "Done: " . count($allPermIds) . " permessi totali, " . count($adminPids) . " admin, " . count($dipPids) . " dipendente.\n";
