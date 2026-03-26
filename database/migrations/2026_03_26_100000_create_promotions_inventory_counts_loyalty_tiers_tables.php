<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Promotions & Bundles
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 150);
            $table->string('code', 50)->nullable();
            $table->string('type', 30); // percentage, fixed, buy_x_get_y, bundle
            $table->decimal('value', 10, 2)->default(0); // discount value
            $table->decimal('min_order_amount', 12, 2)->nullable();
            $table->integer('max_uses')->nullable();
            $table->integer('used_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'active']);
            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('promotion_products', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('promotion_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->unsignedBigInteger('variant_id')->nullable();
            $table->integer('bundle_qty')->nullable();
            $table->decimal('bundle_price', 10, 2)->nullable();
            $table->timestamps();

            $table->foreign('promotion_id')->references('id')->on('promotions')->cascadeOnDelete();
        });

        // Inventory Count Sessions (Barcode Guided)
        Schema::create('inventory_count_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('warehouse_id');
            $table->string('status', 20)->default('open'); // open, finalized, cancelled
            $table->string('notes', 255)->nullable();
            $table->unsignedBigInteger('started_by')->nullable();
            $table->unsignedBigInteger('finalized_by')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('inventory_count_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('session_id');
            $table->unsignedBigInteger('product_variant_id');
            $table->string('barcode_scanned', 100)->nullable();
            $table->integer('counted_qty')->default(0);
            $table->integer('system_qty')->default(0);
            $table->integer('difference')->default(0);
            $table->timestamps();

            $table->foreign('session_id')->references('id')->on('inventory_count_sessions')->cascadeOnDelete();
            $table->unique(['session_id', 'product_variant_id']);
        });

        // Loyalty Tiers
        Schema::create('loyalty_tiers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('name', 80);
            $table->string('code', 30);
            $table->integer('min_points')->default(0);
            $table->decimal('multiplier', 5, 2)->default(1.00);
            $table->decimal('cashback_percent', 5, 2)->default(0);
            $table->text('benefits_json')->nullable();
            $table->string('color', 20)->default('#c9a227');
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });

        // Loyalty Redemptions
        Schema::create('loyalty_redemptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('customer_id');
            $table->integer('points_redeemed');
            $table->decimal('monetary_value', 10, 2);
            $table->string('status', 20)->default('completed'); // completed, cancelled
            $table->unsignedBigInteger('order_id')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'customer_id']);
        });

        // Employee KPI targets
        Schema::create('employee_kpi_targets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('employee_id');
            $table->string('period', 7); // YYYY-MM
            $table->decimal('sales_target', 12, 2)->default(0);
            $table->integer('orders_target')->default(0);
            $table->integer('customers_target')->default(0);
            $table->timestamps();

            $table->unique(['employee_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_kpi_targets');
        Schema::dropIfExists('loyalty_redemptions');
        Schema::dropIfExists('loyalty_tiers');
        Schema::dropIfExists('inventory_count_lines');
        Schema::dropIfExists('inventory_count_sessions');
        Schema::dropIfExists('promotion_products');
        Schema::dropIfExists('promotions');
    }
};
