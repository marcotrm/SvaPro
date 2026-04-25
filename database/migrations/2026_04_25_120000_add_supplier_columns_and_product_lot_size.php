<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Aggiunge:
 * - Colonne anagrafiche mancanti su suppliers (code, address, city, province, zip, notes)
 * - Campi logistici su suppliers: lead_time_giorni, moq
 * - lot_size su products (lotto specifico per prodotto, NON sul fornitore)
 * - source su purchase_orders (per distinguere bozze auto-generate)
 *
 * Usa Schema::hasColumn per essere idempotente (si può rieseguire senza errori).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Fornitori — campi anagrafici mancanti ──────────────────────────
        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'code')) {
                $table->string('code', 100)->nullable()->after('name');
            }
            if (!Schema::hasColumn('suppliers', 'address')) {
                $table->string('address', 255)->nullable()->after('phone');
            }
            if (!Schema::hasColumn('suppliers', 'city')) {
                $table->string('city', 100)->nullable()->after('address');
            }
            if (!Schema::hasColumn('suppliers', 'province')) {
                $table->string('province', 10)->nullable()->after('city');
            }
            if (!Schema::hasColumn('suppliers', 'zip')) {
                $table->string('zip', 20)->nullable()->after('province');
            }
            if (!Schema::hasColumn('suppliers', 'notes')) {
                $table->text('notes')->nullable()->after('zip');
            }
        });

        // ── 2. Fornitori — campi logistici riordino ────────────────────────────
        Schema::table('suppliers', function (Blueprint $table) {
            if (!Schema::hasColumn('suppliers', 'lead_time_giorni')) {
                $table->unsignedInteger('lead_time_giorni')->nullable()
                      ->comment('Lead time in giorni (usato dalla formula di riordino)');
            }
            if (!Schema::hasColumn('suppliers', 'moq')) {
                $table->unsignedInteger('moq')->nullable()
                      ->comment('Minimum Order Quantity');
            }
            // lot_size NON va sui fornitori — va sui prodotti (vedi sezione 3)
        });

        // ── 3. Prodotti — lot_size specifico per prodotto ──────────────────────
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'lot_size')) {
                $table->unsignedInteger('lot_size')->nullable()
                      ->comment('Multiplo di lotto obbligatorio per questo prodotto');
            }
            if (!Schema::hasColumn('products', 'safety_stock_qty')) {
                $table->unsignedInteger('safety_stock_qty')->default(0)
                      ->comment('Scorta di sicurezza usata nella formula di riordino');
            }
        });

        // ── 4. Ordini di acquisto — sorgente (bozze auto-generate) ─────────────
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'source')) {
                $table->string('source', 50)->nullable();
            }
        });

        \Illuminate\Support\Facades\DB::statement(
            'CREATE INDEX IF NOT EXISTS idx_po_tenant_source_status
             ON purchase_orders(tenant_id, source, status)'
        );
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $cols = array_filter(['lot_size', 'safety_stock_qty'], fn($c) => Schema::hasColumn('products', $c));
            if ($cols) $table->dropColumn(array_values($cols));
        });
        Schema::table('suppliers', function (Blueprint $table) {
            $cols = array_filter(
                ['code', 'address', 'city', 'province', 'zip', 'notes', 'lead_time_giorni', 'moq'],
                fn($c) => Schema::hasColumn('suppliers', $c)
            );
            if ($cols) $table->dropColumn(array_values($cols));
        });
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (Schema::hasColumn('purchase_orders', 'source')) $table->dropColumn('source');
        });
    }
};
