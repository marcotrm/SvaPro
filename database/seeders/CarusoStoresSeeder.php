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
            'tenant.manage', 'tax.manage', 'orders.manage', 'inventory.manage',
            'employees.manage', 'loyalty.manage', 'catalog.manage', 'customers.manage',
            'suppliers.manage', 'purchase_orders.manage', 'pos_sessions.manage',
            'invoices.manage', 'documents.generate', 'reports.view',
            'shipping.manage', 'audit.view', 'roles.manage',
        ];
        foreach ($permissions as $code) {
            DB::table('permissions')->updateOrInsert(
                ['code' => $code],
                ['name' => ucfirst(str_replace('.', ' ', $code)), 'updated_at' => $now, 'created_at' => $now]
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
