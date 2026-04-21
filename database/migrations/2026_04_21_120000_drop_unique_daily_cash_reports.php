<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_cash_reports', function (Blueprint $table) {
            // Rimuovi il vincolo unique per permettere invii multipli al giorno
            $table->dropUnique(['tenant_id', 'store_id', 'report_date']);
        });
    }

    public function down(): void
    {
        Schema::table('daily_cash_reports', function (Blueprint $table) {
            $table->unique(['tenant_id', 'store_id', 'report_date']);
        });
    }
};
