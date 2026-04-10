<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bolla di carico/scarico creata dall'admin per un negozio
        Schema::create('delivery_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');                // negozio destinazione
            $table->unsignedBigInteger('created_by');              // admin/superadmin che crea
            $table->unsignedBigInteger('received_by')->nullable(); // dipendente che riceve
            $table->string('note_number')->unique();               // es. BDC-2026-001
            $table->enum('type', ['carico', 'scarico', 'trasferimento'])->default('carico');
            $table->enum('status', ['pending', 'in_progress', 'received', 'discrepancy'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamp('expected_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'store_id']);
            $table->index(['tenant_id', 'status']);
        });

        // Righe della bolla
        Schema::create('delivery_note_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('delivery_note_id');
            $table->unsignedBigInteger('product_variant_id')->nullable();
            $table->string('product_name');
            $table->string('barcode')->nullable();
            $table->string('sku')->nullable();
            $table->integer('expected_qty');
            $table->integer('received_qty')->nullable(); // null = non ancora scansionato
            $table->decimal('unit_cost', 10, 2)->default(0);
            $table->timestamps();

            $table->foreign('delivery_note_id')->references('id')->on('delivery_notes')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_note_items');
        Schema::dropIfExists('delivery_notes');
    }
};
