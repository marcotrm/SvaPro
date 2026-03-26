<?php

namespace App\Console\Commands;

use App\Services\SmartReorderService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RunSmartReorderCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:auto-reorder {tenantId? : Tenant ID opzionale} {--all : Esegue su tutti i tenant attivi} {--central : Forza creazione ordine verso fornitore centrale}';

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
        $runAll = (bool) $this->option('all');
        $forceCentral = (bool) $this->option('central');

        if ($runAll) {
            $tenantIds = DB::table('stores as s')
                ->join('tenants as t', 't.id', '=', 's.tenant_id')
                ->where('t.status', 'active')
                ->where('s.auto_reorder_enabled', true)
                ->distinct()
                ->pluck('s.tenant_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if (empty($tenantIds)) {
                $this->info('Nessun tenant attivo con auto-reorder abilitato.');
                return self::SUCCESS;
            }

            $totalOrders = 0;
            foreach ($tenantIds as $currentTenantId) {
                $result = $forceCentral
                    ? $service->runAutoToCentralForTenant($currentTenantId)
                    : $service->runForTenant($currentTenantId);

                $created = count($result['created_orders'] ?? []);
                $totalOrders += $created;
                $this->line('Tenant #'.$currentTenantId.' -> ordini creati: '.$created);
            }

            $this->info('Completato. Totale ordini creati: '.$totalOrders);
            return self::SUCCESS;
        }

        if ($tenantId === null) {
            $this->error('Specifica il tenantId oppure usa --all.');
            return self::FAILURE;
        }

        $result = $forceCentral
            ? $service->runAutoToCentralForTenant((int) $tenantId)
            : $service->runForTenant((int) $tenantId);

        $this->info('Ordini creati: '.count($result['created_orders']));
        foreach ($result['created_orders'] as $order) {
            $this->line('PO #'.$order['purchase_order_id'].' store='.$order['store_id'].' supplier='.$order['supplier_id'].' total='.$order['total_net']);
        }

        return self::SUCCESS;
    }
}
