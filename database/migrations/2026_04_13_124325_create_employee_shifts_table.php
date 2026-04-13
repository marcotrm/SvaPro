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
        Schema::create('employee_shifts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('employee_id');
            $table->date('date');
            $table->string('start_time', 5)->nullable(); // es. "09:00"
            $table->string('end_time', 5)->nullable();   // es. "18:00"
            $table->string('color', 20)->nullable();
            $table->timestamps();

            // Indici per velocità di lookup nella griglia
            $table->index(['tenant_id', 'store_id', 'date']);
            $table->index(['employee_id', 'date']);
            
            // Assicura che ci sia massimo un turno per dipendente al giorno, in questa versione base.
            $table->unique(['tenant_id', 'employee_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_shifts');
    }
};
