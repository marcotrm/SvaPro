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
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('auto_reorder_enabled')->default(true)->after('default_supplier_id');
            $table->unsignedSmallInteger('reorder_days')->default(30)->after('auto_reorder_enabled');
            $table->unsignedInteger('min_stock_qty')->default(0)->after('reorder_days');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->timestamp('auto_generated_at')->nullable()->after('expected_at');
            $table->string('auto_generated_by', 50)->nullable()->after('auto_generated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['auto_generated_at', 'auto_generated_by']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['auto_reorder_enabled', 'reorder_days', 'min_stock_qty']);
        });
    }
};