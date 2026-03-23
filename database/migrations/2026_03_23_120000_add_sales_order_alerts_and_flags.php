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
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->boolean('has_stock_alert')->default(false)->after('grand_total');
            $table->text('stock_alert_reason')->nullable()->after('has_stock_alert');
            $table->index(['tenant_id', 'has_stock_alert']);
        });

        Schema::create('sales_order_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $table->string('alert_type', 50);
            $table->json('details_json')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'alert_type']);
            $table->index(['sales_order_id', 'resolved_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales_order_alerts');

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'has_stock_alert']);
            $table->dropColumn(['has_stock_alert', 'stock_alert_reason']);
        });
    }
};
