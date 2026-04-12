<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class SyncWooCommerce extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'woocommerce:sync {tenant_id?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sincronizza i prodotti verso WooCommerce per i tenant configurati';

    /**
     * Execute the console command.
     */
    public function handle(\App\Services\WooCommerceSyncService $service)
    {
        $tenantId = $this->argument('tenant_id');

        if ($tenantId) {
            $this->info("Avvio sincronizzazione WooCommerce per il tenant: {$tenantId}");
            $service->syncProductsForTenant((int) $tenantId);
            $this->info("Sincronizzazione completata per il tenant: {$tenantId}");
            return Command::SUCCESS;
        }

        $this->info('Avvio sincronizzazione WooCommerce per tutti i tenant configurati...');

        $tenants = \Illuminate\Support\Facades\DB::table('tenants')
            ->whereNotNull('settings_json')
            ->where('settings_json', 'like', '%"woocommerce_api_url"%')
            ->pluck('id');

        foreach ($tenants as $tId) {
            $this->info("Sincronizzazione tenant: {$tId}");
            $service->syncProductsForTenant((int) $tId);
        }

        $this->info('Sincronizzazione WooCommerce globale completata.');
        return Command::SUCCESS;
    }
}
