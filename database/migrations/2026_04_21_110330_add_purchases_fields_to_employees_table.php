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
        Schema::table('employees', function (Blueprint $table) {
            $table->string('employee_code')->nullable()->after('id')->comment('Codice dipendente univoco per acquisti o login');
            $table->decimal('max_spending_limit', 10, 2)->nullable()->after('hourly_rate')->comment('Limite massimo di spesa per il dipendente (es. acquisti a costo)');
            $table->unsignedBigInteger('price_list_id')->nullable()->after('max_spending_limit')->comment('ID del listino applicato al dipendente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['employee_code', 'max_spending_limit', 'price_list_id']);
        });
    }
};
