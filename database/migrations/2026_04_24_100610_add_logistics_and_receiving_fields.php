<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->integer('stock_min')->default(0)->after('on_hand');
            $table->integer('stock_max')->nullable()->after('stock_min');
            $table->integer('lead_time_gg')->default(3)->after('stock_max');
            $table->integer('giorni_copertura_target')->default(15)->after('lead_time_gg');
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->integer('received_qty')->default(0)->after('qty');
            $table->string('lot_number')->nullable()->after('unit_cost');
            $table->date('expiry_date')->nullable()->after('lot_number');
        });
    }

    public function down(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropColumn(['stock_min', 'stock_max', 'lead_time_gg', 'giorni_copertura_target']);
        });

        Schema::table('purchase_order_lines', function (Blueprint $table) {
            $table->dropColumn(['received_qty', 'lot_number', 'expiry_date']);
        });
    }
};
