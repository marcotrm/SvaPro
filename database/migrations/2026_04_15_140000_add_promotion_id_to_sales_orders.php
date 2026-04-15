<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            // Colonna nullable: non tutte le vendite hanno un codice promo
            $table->unsignedBigInteger('promotion_id')->nullable()->after('customer_id');
            $table->index('promotion_id');
        });
    }

    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropIndex(['promotion_id']);
            $table->dropColumn('promotion_id');
        });
    }
};
