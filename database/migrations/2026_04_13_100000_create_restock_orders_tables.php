<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ordini di riassortimento store (admin → negozio)
        Schema::create('restock_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('created_by');
            $table->string('order_number')->unique();
            $table->enum('status', ['draft', 'confirmed', 'preparing', 'shipped', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->unsignedBigInteger('delivery_note_id')->nullable(); // bolla generata alla spedizione
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('preparing_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'store_id']);
            $table->index(['tenant_id', 'status']);
        });

        // Righe dell'ordine di riassortimento
        Schema::create('restock_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('restock_order_id');
            $table->unsignedBigInteger('product_variant_id')->nullable();
            $table->string('product_name');
            $table->string('barcode')->nullable();
            $table->string('sku')->nullable();
            $table->integer('requested_qty')->default(1);
            $table->timestamps();

            $table->foreign('restock_order_id')
                ->references('id')->on('restock_orders')
                ->onDelete('cascade');
        });

        // Aggiunge colonne avanzate a delivery_notes
        Schema::table('delivery_notes', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_notes', 'source')) {
                $table->string('source')->default('manual')->after('type'); // 'manual' | 'restock_order'
            }
            if (!Schema::hasColumn('delivery_notes', 'restock_order_id')) {
                $table->unsignedBigInteger('restock_order_id')->nullable()->after('source');
            }
            if (!Schema::hasColumn('delivery_notes', 'prepared_at')) {
                $table->timestamp('prepared_at')->nullable()->after('received_at');
            }
            if (!Schema::hasColumn('delivery_notes', 'shipped_at')) {
                $table->timestamp('shipped_at')->nullable()->after('prepared_at');
            }
            if (!Schema::hasColumn('delivery_notes', 'verification_started_at')) {
                $table->timestamp('verification_started_at')->nullable()->after('shipped_at');
            }
            if (!Schema::hasColumn('delivery_notes', 'verification_completed_at')) {
                $table->timestamp('verification_completed_at')->nullable()->after('verification_started_at');
            }
            if (!Schema::hasColumn('delivery_notes', 'has_discrepancy')) {
                $table->boolean('has_discrepancy')->default(false)->after('verification_completed_at');
            }
            if (!Schema::hasColumn('delivery_notes', 'brt_api_response')) {
                $table->json('brt_api_response')->nullable()->after('has_discrepancy');
            }
        });

        // Aggiunge scanned_qty a delivery_note_items (per il riscontro scan-per-scan)
        Schema::table('delivery_note_items', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_note_items', 'scanned_qty')) {
                $table->integer('scanned_qty')->default(0)->after('received_qty');
            }
        });

        // Aggiunge credenziali BRT a tenant_settings
        Schema::table('tenant_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('tenant_settings', 'brt_user_id')) {
                $table->string('brt_user_id')->nullable()->after('qscare_price');
                $table->string('brt_password')->nullable()->after('brt_user_id');
                $table->string('brt_numeric_sender_id')->nullable()->after('brt_password');
                $table->string('brt_department')->nullable()->after('brt_numeric_sender_id');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restock_order_items');
        Schema::dropIfExists('restock_orders');

        Schema::table('delivery_notes', function (Blueprint $table) {
            $table->dropColumn([
                'source', 'restock_order_id', 'prepared_at', 'shipped_at',
                'verification_started_at', 'verification_completed_at',
                'has_discrepancy', 'brt_api_response',
            ]);
        });

        Schema::table('delivery_note_items', function (Blueprint $table) {
            $table->dropColumn('scanned_qty');
        });

        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->dropColumn(['brt_user_id', 'brt_password', 'brt_numeric_sender_id', 'brt_department']);
        });
    }
};
