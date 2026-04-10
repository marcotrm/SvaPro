<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_discrepancies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('delivery_note_id')->nullable(); // bolla collegata
            $table->unsignedBigInteger('product_variant_id')->nullable();
            $table->string('product_name');
            $table->integer('expected_qty');
            $table->integer('received_qty');
            $table->integer('difference');             // received - expected (negativo = manca)
            $table->enum('status', ['open', 'resolved', 'accepted'])->default('open');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']); // per il pallino rosso admin
            $table->foreign('delivery_note_id')->references('id')->on('delivery_notes')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_discrepancies');
    }
};
