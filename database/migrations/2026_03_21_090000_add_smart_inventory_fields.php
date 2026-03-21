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
        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('auto_reorder_enabled')->default(true)->after('is_main');
            $table->unsignedInteger('smart_reorder_threshold')->default(3)->after('auto_reorder_enabled');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('default_supplier_id')->nullable()->after('category_id')->constrained('suppliers')->nullOnDelete();
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->foreignId('store_id')->nullable()->after('tenant_id')->constrained()->nullOnDelete();
            $table->string('source')->default('manual')->after('status');
            $table->text('notes')->nullable()->after('total_net');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_id');
            $table->dropColumn(['source', 'notes']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_supplier_id');
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn(['auto_reorder_enabled', 'smart_reorder_threshold']);
        });
    }
};
