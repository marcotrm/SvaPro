<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Mappa completa: code → nome italiano
    private array $italianNames = [
        'tenant.manage'          => 'Gestione configurazione tenant',
        'tax.manage'             => 'Gestione tasse e accise',
        'orders.manage'          => 'Gestione ordini di vendita',
        'inventory.manage'       => 'Gestione inventario e magazzino',
        'employees.manage'       => 'Gestione dipendenti',
        'loyalty.manage'         => 'Gestione programma fedeltà',
        'catalog.manage'         => 'Gestione catalogo prodotti',
        'customers.manage'       => 'Gestione clienti',
        'suppliers.manage'       => 'Gestione fornitori',
        'purchase_orders.manage' => 'Gestione ordini di acquisto',
        'pos_sessions.manage'    => 'Gestione sessioni POS',
        'invoices.manage'        => 'Gestione fatture e SDI',
        'documents.generate'     => 'Generazione documenti e DDT',
        'reports.view'           => 'Visualizzazione report e analisi',
        'shipping.manage'        => 'Gestione spedizioni',
        'audit.view'             => 'Visualizzazione audit log',
        'roles.manage'           => 'Gestione ruoli e permessi',
        'admin_panel.view'       => 'Accesso pannello amministrazione',
        'store_revenue.view'     => 'Visualizzazione fatturato negozi',
        'control_tower.view'     => 'Accesso torre di controllo',
        'adm.manage'             => 'Gestione ADM / Monopolio',
        'automations.manage'     => 'Gestione automazioni',
    ];

    public function up(): void
    {
        $now = now();

        foreach ($this->italianNames as $code => $name) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $code],
                ['name' => $name, 'updated_at' => $now, 'created_at' => $now]
            );
        }

        // Assegna admin_panel.view al superadmin
        $superRoleId = DB::table('roles')->where('code', 'superadmin')->value('id');
        $permId      = DB::table('permissions')->where('code', 'admin_panel.view')->value('id');

        if ($superRoleId && $permId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $superRoleId, 'permission_id' => $permId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }
    }

    public function down(): void
    {
        // Non ripristina — è un fix naming
    }
};
