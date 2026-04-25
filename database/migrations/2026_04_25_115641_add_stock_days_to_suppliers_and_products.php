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
        Schema::table('suppliers', function (Blueprint $table) {
            $table->integer('min_stock_days')->nullable();
            $table->integer('max_stock_days')->nullable();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->integer('min_stock_days')->nullable();
            $table->integer('max_stock_days')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn(['min_stock_days', 'max_stock_days']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['min_stock_days', 'max_stock_days']);
        });
    }
};
