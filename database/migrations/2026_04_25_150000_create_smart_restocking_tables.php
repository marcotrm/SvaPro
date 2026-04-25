<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Soglie per-magazzino su stock_items
        // (scorta_minima specifica per ogni negozio/warehouse)
        Schema::table('stock_items', function (Blueprint $table) {
            $table->integer('scorta_minima')->default(0)->after('safety_stock')
                ->comment('Soglia minima per-magazzino, sotto cui si genera fabbisogno');
            $table->integer('quantita_riordino_target')->default(0)->after('scorta_minima')
                ->comment('Quantità target dopo il riordino (livello da raggiungere)');
        });

        // 2. Matrice Approvvigionamento: marchio → fornitore primario
        Schema::create('brand_suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->boolean('is_primario')->default(true)
                ->comment('true = fornitore primario per questo marchio');
            $table->timestamps();

            $table->unique(['tenant_id', 'brand_id', 'supplier_id']);
            $table->index(['tenant_id', 'brand_id', 'is_primario']);
        });

        // 3. Registro esecuzioni calcolo fabbisogno
        Schema::create('smart_restocking_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('triggered_by')->default('manual')
                ->comment('manual | cron | api');
            $table->integer('ddt_drafts_created')->default(0);
            $table->integer('po_drafts_created')->default(0);
            $table->integer('warnings_count')->default(0);
            $table->json('summary')->nullable();
            $table->timestamp('calculated_at')->useCurrent();
            $table->timestamps();

            $table->index(['tenant_id', 'calculated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('smart_restocking_runs');
        Schema::dropIfExists('brand_suppliers');

        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropColumn(['scorta_minima', 'quantita_riordino_target']);
        });
    }
};
