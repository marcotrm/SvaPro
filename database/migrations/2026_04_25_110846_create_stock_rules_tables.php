<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Gruppi di Negozi
        Schema::create('store_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
        });

        // Tabella pivot Negozi <-> Gruppi Negozi
        Schema::create('store_group_store', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->unique(['store_group_id', 'store_id']);
        });

        // Regole di Stock
        Schema::create('stock_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            
            // Scope Prodotti (Se null, vale per tutto il catalogo)
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            
            // Scope Destinatari (all, store_group, warehouse)
            $table->string('target_type')->default('all'); // 'all' (tutti i magazzini), 'store_group' (negozi nel gruppo), 'warehouse' (deposito centrale o singolo negozio)
            $table->unsignedBigInteger('target_id')->nullable();
            
            // Valori
            $table->integer('min_stock')->default(0)->comment('Scorta Minima');
            $table->integer('max_stock')->default(0)->comment('Scorta Massima (Target)');
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_rules');
        Schema::dropIfExists('store_group_store');
        Schema::dropIfExists('store_groups');
    }
};
