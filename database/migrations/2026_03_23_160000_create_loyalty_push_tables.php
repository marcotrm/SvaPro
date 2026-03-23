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
        Schema::create('loyalty_device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('platform', 20);
            $table->string('device_token')->unique();
            $table->string('device_name')->nullable();
            $table->string('app_version', 30)->nullable();
            $table->boolean('notifications_enabled')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'customer_id', 'notifications_enabled']);
        });

        Schema::create('loyalty_push_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('loyalty_ledger_id')->nullable()->constrained('loyalty_ledger')->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('sales_orders')->nullOnDelete();
            $table->string('notification_type', 50);
            $table->string('title');
            $table->text('message');
            $table->json('payload_json')->nullable();
            $table->string('status', 30)->default('queued');
            $table->unsignedInteger('target_devices_count')->default(0);
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'customer_id', 'created_at']);
            $table->index(['tenant_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loyalty_push_notifications');
        Schema::dropIfExists('loyalty_device_tokens');
    }
};