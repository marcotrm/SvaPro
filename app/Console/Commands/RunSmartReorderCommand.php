<?php

namespace App\Console\Commands;

use App\Services\SmartReorderService;
use Illuminate\Console\Command;

class RunSmartReorderCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:auto-reorder {tenantId? : Tenant ID opzionale}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Genera ordini acquisto automatici per best seller con stock basso';

    /**
     * Execute the console command.
     */
    public function handle(SmartReorderService $service): int
    {
        $tenantId = $this->argument('tenantId');

        if ($tenantId === null) {
            $this->error('Specifica il tenantId.');
            return self::FAILURE;
        }

        $result = $service->runForTenant((int) $tenantId);

        $this->info('Ordini creati: '.count($result['created_orders']));
        foreach ($result['created_orders'] as $order) {
            $this->line('PO #'.$order['purchase_order_id'].' store='.$order['store_id'].' supplier='.$order['supplier_id'].' total='.$order['total_net']);
        }

        return self::SUCCESS;
    }
}
