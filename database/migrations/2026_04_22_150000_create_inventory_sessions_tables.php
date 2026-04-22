<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Bolle inventario (testata) ──────────────────────────────────────
        Schema::create('inventory_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->string('inventory_number', 50)->index(); // INV-2026-0001
            $table->string('title');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('store_id');
            $table->string('status', 50)->default('DRAFT');
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamp('closed_by_store_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes_internal')->nullable();
            $table->text('notes_store')->nullable();
            $table->json('filters')->nullable(); // filtri usati per la creazione
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'store_id']);
        });

        // ── Righe della bolla (prodotti da contare) ─────────────────────────
        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('inventory_session_id');
            $table->unsignedBigInteger('product_variant_id');
            $table->integer('theoretical_quantity')->default(0); // snapshot al momento della creazione
            $table->integer('counted_quantity')->default(0);     // inserito dallo store
            // difference calcolato in PHP: counted - theoretical
            $table->string('status', 50)->default('NOT_COUNTED');
            $table->text('store_note')->nullable();
            $table->text('admin_note')->nullable();
            $table->timestamp('last_counted_at')->nullable();
            $table->timestamps();

            $table->unique(['inventory_session_id', 'product_variant_id']);
            $table->index(['tenant_id', 'inventory_session_id']);
        });

        // ── Scansioni barcode (ogni sparata = 1 record) ─────────────────────
        Schema::create('inventory_scans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('inventory_session_id');
            $table->unsignedBigInteger('inventory_item_id')->nullable();
            $table->unsignedBigInteger('product_variant_id')->nullable();
            $table->string('barcode', 150);
            $table->unsignedBigInteger('scanned_by');
            $table->timestamp('scanned_at')->useCurrent();
            $table->string('source', 50)->default('BARCODE'); // BARCODE | MANUAL
            $table->integer('quantity_delta')->default(1);
            $table->text('note')->nullable();
            $table->boolean('is_unexpected')->default(false);
            $table->timestamps();

            $table->index(['tenant_id', 'inventory_session_id']);
        });

        // ── Commenti / richieste chiarimento ───────────────────────────────
        Schema::create('inventory_comments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('inventory_session_id');
            $table->unsignedBigInteger('inventory_item_id')->nullable();
            $table->unsignedBigInteger('author_id');
            $table->string('author_role', 50); // admin | store
            $table->text('message');
            $table->timestamps();

            $table->index(['tenant_id', 'inventory_session_id']);
        });

        // ── Audit log completo ─────────────────────────────────────────────
        Schema::create('inventory_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('inventory_session_id')->nullable();
            $table->unsignedBigInteger('inventory_item_id')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->string('action', 100);
            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'inventory_session_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_audit_logs');
        Schema::dropIfExists('inventory_comments');
        Schema::dropIfExists('inventory_scans');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('inventory_sessions');
    }
};
