<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Aggiungi image_path al prodotto
        if (Schema::hasTable('products') && !Schema::hasColumn('products', 'image_path')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('image_path')->nullable()->after('description');
            });
        }

        // Aggiungi listini prezzi alle varianti
        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                if (!Schema::hasColumn('product_variants', 'price_list_2')) {
                    $table->decimal('price_list_2', 10, 4)->nullable()->after('sale_price')
                        ->comment('Listino 2 (es. Ingrosso)');
                }
                if (!Schema::hasColumn('product_variants', 'price_list_3')) {
                    $table->decimal('price_list_3', 10, 4)->nullable()->after('price_list_2')
                        ->comment('Listino 3 (es. Dipendenti / Promo)');
                }
            });
        }

        // Auto-crea entry inventory_stock per varianti senza stock (prodotti già esistenti)
        // Questo assicura che i nuovi prodotti appaiano subito in magazzino
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumnIfExists('image_path');
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumnIfExists('price_list_2');
            $table->dropColumnIfExists('price_list_3');
        });
    }
};
