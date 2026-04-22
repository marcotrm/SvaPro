<?php

namespace App\Console\Commands;

use App\Services\ReplenishmentEngine;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RunReplenishment extends Command
{
    protected $signature = 'replenishment:run
                            {--tenant=  : ID del tenant (lasciare vuoto per tutti i tenant attivi)}
                            {--dry-run  : Simula senza scrivere sul DB}
                            {--drp-only : Esegue solo il DRP (negozi ← magazzino centrale)}
                            {--mrp-only : Esegue solo il MRP (magazzino centrale ← fornitori)}';

    protected $description = 'Esegue il ciclo DRP + MRP del ReplenishmentEngine';

    public function __construct(private ReplenishmentEngine $engine)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun    = (bool) $this->option('dry-run');
        $drpOnly   = (bool) $this->option('drp-only');
        $mrpOnly   = (bool) $this->option('mrp-only');
        $tenantOpt = $this->option('tenant');

        if ($dryRun) {
            $this->warn('⚠️  DRY-RUN attivo — nessuna scrittura nel database');
        }

        // Determina la lista di tenant da processare
        $tenants = $tenantOpt
            ? [(object) ['id' => (int) $tenantOpt]]
            : DB::table('tenants')->where('is_active', true)->get();

        foreach ($tenants as $tenant) {
            $this->info("──────────────────────────────────────────");
            $this->info("🏢 Tenant #{$tenant->id}");

            if ($drpOnly) {
                $result = ['drp' => $this->engine->runDrp($tenant->id, $dryRun), 'mrp' => null];
            } elseif ($mrpOnly) {
                $result = ['drp' => null, 'mrp' => $this->engine->runMrp($tenant->id, $dryRun)];
            } else {
                $result = $this->engine->run($tenant->id, $dryRun);
            }

            // ── DRP output ──
            if ($result['drp'] !== null) {
                $drp = $result['drp'];
                if (isset($drp['error'])) {
                    $this->error("  DRP: {$drp['error']}");
                } else {
                    $this->info('  📦 DRP — Trasferimenti generati: ' . count($drp['transfers_created']));
                    foreach ($drp['transfers_created'] as $t) {
                        $tag = $dryRun ? '[dry]' : "#{$t['transfer_id']}";
                        $this->line("     {$tag} {$t['product_name']} → {$t['store_name']} | qty: {$t['order_qty']} | consegna: {$t['expected_date']}");
                    }
                    if (! empty($drp['skipped'])) {
                        $this->warn('  ⏭  DRP skipped: ' . count($drp['skipped']));
                        foreach ($drp['skipped'] as $s) {
                            $this->line("     [{$s['reason']}] variant #{$s['product_variant_id']}");
                        }
                    }
                }
            }

            // ── MRP output ──
            if ($result['mrp'] !== null) {
                $mrp = $result['mrp'];
                if (isset($mrp['error'])) {
                    $this->error("  MRP: {$mrp['error']}");
                } else {
                    $this->info('  🛒 MRP — Ordini d\'acquisto proposti: ' . count($mrp['orders_created']));
                    foreach ($mrp['orders_created'] as $o) {
                        $tag = $dryRun ? '[dry]' : "#{$o['purchase_order_id']}";
                        $this->line("     {$tag} Fornitore #{$o['supplier_id']} | righe: {$o['lines']} | arrivo previsto: {$o['expected_at']} (LT {$o['lead_time_days']}gg)");
                    }
                    if (! empty($mrp['skipped'])) {
                        $this->warn('  ⏭  MRP skipped: ' . count($mrp['skipped']));
                    }
                }
            }
        }

        $this->info("──────────────────────────────────────────");
        $this->info($dryRun ? '✅ Simulazione completata.' : '✅ Ciclo replenishment completato.');

        return self::SUCCESS;
    }
}
