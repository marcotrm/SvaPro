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
        Schema::create('tax_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tax_class_id')->constrained()->cascadeOnDelete();
            $table->string('country', 2)->default('IT');
            $table->string('region')->nullable();
            $table->decimal('vat_rate', 5, 2);
            $table->timestamp('valid_from');
            $table->timestamp('valid_to')->nullable();
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'tax_class_id', 'country', 'active']);
        });

        Schema::create('excise_rule_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('status')->default('draft');
            $table->timestamp('valid_from');
            $table->timestamp('valid_to')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('excise_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rule_set_id')->constrained('excise_rule_sets')->cascadeOnDelete();
            $table->string('product_type')->nullable();
            $table->unsignedSmallInteger('nicotine_min')->nullable();
            $table->unsignedSmallInteger('nicotine_max')->nullable();
            $table->unsignedSmallInteger('volume_min_ml')->nullable();
            $table->unsignedSmallInteger('volume_max_ml')->nullable();
            $table->string('rate_type');
            $table->decimal('rate_value', 12, 4);
            $table->decimal('min_amount', 12, 2)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index(['rule_set_id', 'active']);
        });

        Schema::create('fee_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('scope');
            $table->text('formula_expression');
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('loyalty_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('card_code');
            $table->string('status')->default('active');
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'card_code']);
            $table->unique(['tenant_id', 'customer_id']);
        });

        Schema::create('loyalty_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->integer('points_balance')->default(0);
            $table->string('tier_code')->default('base');
            $table->timestamps();

            $table->unique(['tenant_id', 'customer_id']);
        });

        Schema::create('loyalty_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('sales_orders')->nullOnDelete();
            $table->string('event_type');
            $table->integer('points_delta');
            $table->decimal('monetary_value', 12, 2)->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'customer_id', 'created_at']);
        });

        Schema::create('loyalty_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('trigger_type');
            $table->text('formula_expression');
            $table->timestamp('start_at');
            $table->timestamp('end_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('photo_url')->nullable();
            $table->date('hire_date')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('employee_sales_facts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('sales_orders')->cascadeOnDelete();
            $table->decimal('net_amount', 12, 2)->default(0);
            $table->decimal('margin_amount', 12, 2)->default(0);
            $table->timestamp('sold_at');
            $table->timestamps();

            $table->index(['tenant_id', 'employee_id', 'sold_at']);
        });

        Schema::create('employee_point_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->integer('points_balance')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'employee_id']);
        });

        Schema::create('employee_point_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->integer('points_delta');
            $table->timestamps();

            $table->index(['tenant_id', 'employee_id', 'created_at']);
        });

        Schema::create('compensation_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->text('formula_expression');
            $table->timestamp('valid_from');
            $table->timestamp('valid_to')->nullable();
            $table->boolean('active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('before_json')->nullable();
            $table->json('after_json')->nullable();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'entity_type', 'entity_id']);
        });

        Schema::create('outbox_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_name');
            $table->json('payload_json');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['published_at']);
        });

        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('key');
            $table->string('request_hash')->nullable();
            $table->string('response_hash')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('outbox_events');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('compensation_rules');
        Schema::dropIfExists('employee_point_ledger');
        Schema::dropIfExists('employee_point_wallets');
        Schema::dropIfExists('employee_sales_facts');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('loyalty_rules');
        Schema::dropIfExists('loyalty_ledger');
        Schema::dropIfExists('loyalty_wallets');
        Schema::dropIfExists('loyalty_cards');
        Schema::dropIfExists('fee_rules');
        Schema::dropIfExists('excise_rules');
        Schema::dropIfExists('excise_rule_sets');
        Schema::dropIfExists('tax_rules');
    }
};
