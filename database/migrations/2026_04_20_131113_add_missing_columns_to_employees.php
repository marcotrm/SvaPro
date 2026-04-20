<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            // Usato da AttendanceController per badge/timbratura
            if (!Schema::hasColumn('employees', 'barcode')) {
                $table->string('barcode', 100)->nullable()->unique()->after('last_name');
            }
            // Usato da AttendanceController per calcolo ritardi
            if (!Schema::hasColumn('employees', 'expected_start_time')) {
                $table->string('expected_start_time', 5)->nullable()->after('hire_date')
                    ->comment('Orario atteso di arrivo, es: 09:00');
            }
            // Ruolo del dipendente (info aggiuntiva)
            if (!Schema::hasColumn('employees', 'role')) {
                $table->string('role', 50)->nullable()->after('status');
            }
            // Contatto diretto dipendente
            if (!Schema::hasColumn('employees', 'phone')) {
                $table->string('phone', 30)->nullable()->after('role');
            }
            // Codice fiscale
            if (!Schema::hasColumn('employees', 'fiscal_code')) {
                $table->string('fiscal_code', 20)->nullable()->after('phone');
            }
            // Compenso orario (per KPI)
            if (!Schema::hasColumn('employees', 'hourly_rate')) {
                $table->decimal('hourly_rate', 8, 2)->nullable()->after('fiscal_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumnIfExists('barcode');
            $table->dropColumnIfExists('expected_start_time');
            $table->dropColumnIfExists('role');
            $table->dropColumnIfExists('phone');
            $table->dropColumnIfExists('fiscal_code');
            $table->dropColumnIfExists('hourly_rate');
        });
    }
};
