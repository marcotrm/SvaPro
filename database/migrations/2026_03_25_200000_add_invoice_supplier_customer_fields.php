<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Campi mancanti sulla tabella invoices (dalla foto gestionale)
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('document_type', 10)->default('TD01')->after('invoice_number');
            $table->string('causale', 50)->default('Fattura Vendita')->after('document_type');
            $table->string('sezionale', 10)->default('FPS')->after('causale');
            $table->string('payment_method', 50)->nullable()->after('currency');
            $table->boolean('is_paid')->default(false)->after('payment_method');
            $table->timestamp('paid_at')->nullable()->after('is_paid');
            $table->foreignId('warehouse_id')->nullable()->after('customer_id');
            $table->timestamp('email_sent_at')->nullable()->after('sdi_error_message');
            $table->timestamp('pdf_generated_at')->nullable()->after('email_sent_at');

            $table->index(['tenant_id', 'document_type']);
            $table->index(['tenant_id', 'sezionale']);
        });

        // Fatture Passive (ricevute da fornitori)
        Schema::create('supplier_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained()->cascadeOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('invoice_number', 50);
            $table->string('document_type', 10)->default('TD01');
            $table->string('causale', 80)->default('Fattura Fornitore');
            $table->string('sezionale', 10)->default('FPS');
            $table->string('payment_method', 50)->nullable();
            $table->boolean('is_paid')->default(false);
            $table->timestamp('paid_at')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_total', 12, 2)->default(0);
            $table->decimal('grand_total', 12, 2)->default(0);
            $table->string('currency', 3)->default('EUR');
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->string('sdi_status', 30)->default('pending');
            $table->string('sdi_identifier', 100)->nullable();
            $table->timestamp('email_sent_at')->nullable();
            $table->timestamp('pdf_generated_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'supplier_id']);
            $table->index(['tenant_id', 'document_type']);
            $table->index(['tenant_id', 'issued_at']);
        });

        // Righe fattura fornitore
        Schema::create('supplier_invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supplier_invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description', 255)->nullable();
            $table->integer('qty')->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('line_total', 12, 2)->default(0);
            $table->timestamps();
        });

        // Clienti: tracking ritorno + analytics
        Schema::table('customers', function (Blueprint $table) {
            $table->timestamp('last_purchase_at')->nullable()->after('email_verified');
            $table->timestamp('loyalty_card_issued_at')->nullable()->after('last_purchase_at');
            $table->integer('total_orders')->default(0)->after('loyalty_card_issued_at');
            $table->decimal('total_spent', 12, 2)->default(0)->after('total_orders');
            $table->decimal('avg_days_between_purchases', 8, 2)->nullable()->after('total_spent');
        });

        // Prodotti: giorni_riordino + qty_minima per smart reorder auto
        Schema::table('products', function (Blueprint $table) {
            $table->integer('giorni_riordino')->nullable()->after('pli_code');
            $table->integer('qty_minima_magazzino')->nullable()->after('giorni_riordino');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_invoice_lines');
        Schema::dropIfExists('supplier_invoices');

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'document_type', 'causale', 'sezionale', 'payment_method',
                'is_paid', 'paid_at', 'warehouse_id', 'email_sent_at', 'pdf_generated_at',
            ]);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn([
                'last_purchase_at', 'loyalty_card_issued_at',
                'total_orders', 'total_spent', 'avg_days_between_purchases',
            ]);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['giorni_riordino', 'qty_minima_magazzino']);
        });
    }
};
