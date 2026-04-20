<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Stores: campi mancanti ───────────────────────────────────────────
        Schema::table('stores', function (Blueprint $table) {
            if (!Schema::hasColumn('stores', 'whatsapp_notify_phone')) {
                $table->string('whatsapp_notify_phone', 30)->nullable()->after('phone');
            }
        });

        // ── Users: employee_id (per collegare utente dipendente all'anagrafica) ─
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'employee_id')) {
                $table->unsignedBigInteger('employee_id')->nullable()->after('tenant_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumnIfExists('whatsapp_notify_phone');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumnIfExists('employee_id');
        });
    }
};
