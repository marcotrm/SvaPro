<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Aggiunge i campi mancanti per il motore DRP + MRP:
 *  - stock_items.reorder_qty  → quantità standard da ordinare quando si raggiunge il punto di riordino
 *  - suppliers.lead_time_days → giorni di consegna del fornitore (Lead Time)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_items') && ! Schema::hasColumn('stock_items', 'reorder_qty')) {
            Schema::table('stock_items', function (Blueprint $table) {
                $table->unsignedInteger('reorder_qty')
                    ->default(1)
                    ->comment('Quantità standard da ordinare al raggiungimento del punto di riordino');
            });
        }

        if (Schema::hasTable('suppliers') && ! Schema::hasColumn('suppliers', 'lead_time_days')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->unsignedSmallInteger('lead_time_days')
                    ->default(7)
                    ->comment('Giorni di lead time standard del fornitore');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_items') && Schema::hasColumn('stock_items', 'reorder_qty')) {
            Schema::table('stock_items', fn (Blueprint $t) => $t->dropColumn('reorder_qty'));
        }
        if (Schema::hasTable('suppliers') && Schema::hasColumn('suppliers', 'lead_time_days')) {
            Schema::table('suppliers', fn (Blueprint $t) => $t->dropColumn('lead_time_days'));
        }
    }
};
