<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * CarusoStoresSeeder — Crea i negozi reali di Caruso se non esistono.
 * Questo seeder è IDEMPOTENTE: usa updateOrInsert/insertOrIgnore
 * e NON cancella mai dati esistenti.
 * Viene eseguito ad ogni deploy su Railway.
 */
class CarusoStoresSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // ── Trova o crea il tenant principale Caruso ──────────────────────────
        $tenant = DB::table('tenants')->where('code', 'CARUSO')->first();

        if (!$tenant) {
            $tenantId = DB::table('tenants')->insertGetId([
                'name'       => 'Caruso Vape',
                'code'       => 'CARUSO',
                'vat_number' => 'IT00000000001',
                'timezone'   => 'Europe/Rome',
                'status'     => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->command?->info('CarusoStoresSeeder: tenant Caruso creato.');
        } else {
            $tenantId = $tenant->id;
            $this->command?->info('CarusoStoresSeeder: tenant Caruso già presente — aggiorno solo dati mancanti.');
        }

        // ── Ruoli (idempotente) ────────────────────────────────────────────────
        $roles = [
            ['code' => 'superadmin',    'name' => 'Super Admin'],
            ['code' => 'admin_cliente', 'name' => 'Admin Cliente'],
            ['code' => 'dipendente',    'name' => 'Dipendente'],
        ];
        foreach ($roles as $role) {
            DB::table('roles')->updateOrInsert(
                ['code' => $role['code']],
                ['name' => $role['name'], 'updated_at' => $now, 'created_at' => $now]
            );
        }

        // ── Permessi (idempotente) ────────────────────────────────────────────
        $permissions = [
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
        ];
        foreach ($permissions as $code => $name) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $code],
                ['name' => $name, 'updated_at' => $now, 'created_at' => $now]
            );
        }

        // ── Utente admin Caruso (idempotente) ─────────────────────────────────
        DB::table('users')->updateOrInsert(
            ['email' => 'admin@caruso.local'],
            [
                'tenant_id'  => $tenantId,
                'name'       => 'Admin Caruso',
                'password'   => Hash::make('ChangeMe123!'),
                'status'     => 'active',
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        $adminUserId = DB::table('users')->where('email', 'admin@caruso.local')->value('id');
        $adminRoleId = DB::table('roles')->where('code', 'admin_cliente')->value('id');
        $superRoleId = DB::table('roles')->where('code', 'superadmin')->value('id');

        // Assegna ruolo superadmin all'admin Caruso (idempotente)
        DB::table('user_roles')->updateOrInsert(
            ['user_id' => $adminUserId, 'tenant_id' => $tenantId, 'role_id' => $superRoleId],
            ['store_id' => null, 'updated_at' => $now, 'created_at' => $now]
        );

        // Assegna tutti i permessi al superadmin (idempotente)
        $allPermIds = DB::table('permissions')->pluck('id');
        foreach ($allPermIds as $permId) {
            DB::table('role_permissions')->updateOrInsert(
                ['role_id' => $superRoleId, 'permission_id' => $permId],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }

        // ── Negozi Caruso (idempotente per code) ─────────────────────────────
        $stores = [
            [
                'code'    => 'CARUSO-MAIN',
                'name'    => 'Caruso Negozio Principale',
                'city'    => 'Roma',
                'is_main' => true,
            ],
            // Aggiungi altri negozi Caruso qui sotto con lo stesso formato
            // ['code' => 'CARUSO-2', 'name' => 'Caruso Filiale 2', 'city' => 'Roma', 'is_main' => false],
        ];

        foreach ($stores as $store) {
            $existingStore = DB::table('stores')
                ->where('tenant_id', $tenantId)
                ->where('code', $store['code'])
                ->first();

            if (!$existingStore) {
                $storeId = DB::table('stores')->insertGetId([
                    'tenant_id'  => $tenantId,
                    'code'       => $store['code'],
                    'name'       => $store['name'],
                    'city'       => $store['city'],
                    'country'    => 'IT',
                    'timezone'   => 'Europe/Rome',
                    'is_main'    => $store['is_main'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                // Crea magazzino associato al negozio
                DB::table('warehouses')->insertOrIgnore([
                    'tenant_id'  => $tenantId,
                    'store_id'   => $storeId,
                    'name'       => 'Magazzino ' . $store['name'],
                    'type'       => 'store',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $this->command?->info("CarusoStoresSeeder: negozio '{$store['name']}' creato.");
            } else {
                $this->command?->info("CarusoStoresSeeder: negozio '{$store['name']}' già presente — skip.");
            }
        }

        // ── Tax class base (idempotente) ─────────────────────────────────────
        DB::table('tax_classes')->updateOrInsert(
            ['tenant_id' => $tenantId, 'code' => 'STANDARD'],
            ['name' => 'IVA Standard 22%', 'updated_at' => $now, 'created_at' => $now]
        );

        $this->command?->info('CarusoStoresSeeder: completato.');
    }
}
