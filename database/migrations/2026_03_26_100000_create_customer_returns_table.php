<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('sales_orders')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('processed_by')->nullable();
            $table->string('rma_number', 30)->unique();
            $table->enum('status', ['pending', 'approved', 'denied', 'received', 'refunded'])->default('pending');
            $table->enum('reason', ['defective', 'wrong_item', 'damaged', 'changed_mind', 'other'])->default('other');
            $table->text('notes')->nullable();
            $table->enum('refund_method', ['credit', 'cash', 'bank_transfer', 'store_credit'])->nullable();
            $table->decimal('refund_amount', 12, 2)->default(0);
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'customer_id']);

            $table->foreign('processed_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('customer_return_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_return_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->text('condition_notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_return_lines');
        Schema::dropIfExists('customer_returns');
    }
};
