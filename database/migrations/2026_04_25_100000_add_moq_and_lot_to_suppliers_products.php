<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Fornitori: aggiungi MOQ e lot_size ─────────────────────────────
        Schema::table('suppliers', function (Blueprint $table) {
            $table->unsignedInteger('moq')->default(1)->after('lead_time_medio')
                  ->comment('Minimum Order Quantity');
            $table->unsignedInteger('lot_size')->default(1)->after('moq')
                  ->comment('Multiplo di lotto obbligatorio');
            $table->unsignedInteger('lead_time_giorni')->default(7)->after('lot_size')
                  ->comment('Lead time canonico in giorni (usato dal nuovo servizio)');
        });

        // ── Prodotti: override MOQ/lotto per prodotto + safety_stock canonico
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('moq_override')->nullable()->after('scorta_sicurezza')
                  ->comment('MOQ specifico prodotto (NULL = usa quello del fornitore)');
            $table->unsignedInteger('lot_size_override')->nullable()->after('moq_override')
                  ->comment('Lotto specifico prodotto (NULL = usa quello del fornitore)');
            $table->unsignedInteger('safety_stock_qty')->default(0)->after('lot_size_override')
                  ->comment('Alias canonico di scorta_sicurezza per il nuovo servizio');
        });

        // ── Indice su purchase_orders per filtrare bozze auto-generate ─────
        Schema::table('purchase_orders', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_orders', 'source')) {
                $table->string('source', 50)->nullable()->after('status');
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
            $table->dropColumn(['moq_override', 'lot_size_override', 'safety_stock_qty']);
        });
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['moq', 'lot_size', 'lead_time_giorni']);
        });
    }
};
