<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            // Contatti
            if (!Schema::hasColumn('stores', 'phone')) {
                $table->string('phone', 30)->nullable()->after('city');
            }
            if (!Schema::hasColumn('stores', 'email')) {
                $table->string('email', 150)->nullable()->after('phone');
            }
            if (!Schema::hasColumn('stores', 'zip_code')) {
                $table->string('zip_code', 10)->nullable()->after('city');
            }

            // Orari apertura:
            // JSON con struttura: { "mon": {"open": "09:00", "close": "19:00", "closed": false}, ... }
            // Giorni: mon, tue, wed, thu, fri, sat, sun
            if (!Schema::hasColumn('stores', 'opening_hours')) {
                $table->text('opening_hours')->nullable()->after('timezone')
                    ->comment('JSON: {"mon":{"open":"09:00","close":"19:00","closed":false},...}');
            }

            // Orario default per le timbrature dei dipendenti (override per chi non ha expected_start_time)
            if (!Schema::hasColumn('stores', 'default_start_time')) {
                $table->string('default_start_time', 5)->nullable()->after('opening_hours')
                    ->comment('Orario apertura default per notifiche ritardo, es: 09:00');
            }

            // Tolleranza ritardo in minuti prima di inviare notifica WhatsApp
            if (!Schema::hasColumn('stores', 'late_tolerance_minutes')) {
                $table->unsignedTinyInteger('late_tolerance_minutes')->default(10)->after('default_start_time');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumnIfExists('phone');
            $table->dropColumnIfExists('email');
            $table->dropColumnIfExists('zip_code');
            $table->dropColumnIfExists('opening_hours');
            $table->dropColumnIfExists('default_start_time');
            $table->dropColumnIfExists('late_tolerance_minutes');
        });
    }
};
