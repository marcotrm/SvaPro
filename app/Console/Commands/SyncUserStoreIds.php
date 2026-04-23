<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncUserStoreIds extends Command
{
    protected $signature   = 'svapro:sync-user-store-ids {--dry-run : Mostra le modifiche senza applicarle}';
    protected $description = 'Sincronizza store_id in user_roles dalla tabella employees (fix per utenti negozio senza store_id)';

    public function handle(): int
    {
        $isDry = $this->option('dry-run');
        $this->info($isDry ? '🔍 DRY-RUN — nessuna modifica verrà salvata' : '🔧 Applicazione modifiche...');

        // Trova user_roles con store_id NULL per ruoli legati a negozio
        $nullStoreRoles = DB::table('user_roles as ur')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->join('users as u', 'u.id', '=', 'ur.user_id')
            ->whereNull('ur.store_id')
            ->whereIn('r.code', ['dipendente', 'store_manager', 'admin_cliente'])
            ->select('ur.id as ur_id', 'ur.user_id', 'ur.tenant_id', 'r.code as role', 'u.email')
            ->get();

        if ($nullStoreRoles->isEmpty()) {
            $this->info('✅ Nessun user_role con store_id NULL trovato. Tutto OK!');
            return 0;
        }

        $fixed = 0;
        $notFound = 0;

        foreach ($nullStoreRoles as $ur) {
            // Cerca store_id da employees
            $storeId = DB::table('employees')
                ->where('user_id', $ur->user_id)
                ->where('tenant_id', $ur->tenant_id)
                ->whereNotNull('store_id')
                ->value('store_id');

            if ($storeId) {
                $storeName = DB::table('stores')->where('id', $storeId)->value('name') ?? "ID $storeId";
                $this->line("  ✅ {$ur->email} ({$ur->role}) → negozio: {$storeName}");
                if (!$isDry) {
                    DB::table('user_roles')->where('id', $ur->ur_id)->update(['store_id' => $storeId]);
                }
                $fixed++;
            } else {
                $this->warn("  ⚠️  {$ur->email} ({$ur->role}) → nessun negozio trovato in employees");
                $notFound++;
            }
        }

        $this->newLine();
        $this->info("Risultato: $fixed corretti, $notFound non trovati" . ($isDry ? ' (dry-run, niente salvato)' : ' (salvati)'));

        if ($notFound > 0) {
            $this->warn("Per i non trovati: assegna manualmente lo store_id in user_roles tramite il pannello admin.");
        }

        return 0;
    }
}
