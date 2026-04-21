<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coin_shipments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('from_user_id');       // chi ha preparato il pacco
            $table->unsignedBigInteger('to_store_id');         // negozio destinatario
            $table->decimal('total_amount', 10, 2);            // valore totale in €
            $table->jsonb('coin_breakdown')->nullable();        // {"0.01":10,"0.05":5,...}
            $table->string('status', 20)->default('pending');  // pending|confirmed|rejected
            $table->unsignedBigInteger('confirmed_by')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->foreign('to_store_id')->references('id')->on('stores')->onDelete('cascade');
            $table->index(['tenant_id', 'to_store_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coin_shipments');
    }
};
