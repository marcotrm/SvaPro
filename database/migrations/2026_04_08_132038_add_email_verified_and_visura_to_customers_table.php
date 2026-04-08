<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Email OTP verification
            if (!Schema::hasColumn('customers', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            }

            // Upload visura camerale (path al file PDF)
            if (!Schema::hasColumn('customers', 'visura_camerale_path')) {
                $table->string('visura_camerale_path')->nullable()->after('pec_email');
            }

            // Data di nascita, comune, sesso (per CF auto)
            if (!Schema::hasColumn('customers', 'birth_place_code')) {
                $table->string('birth_place_code', 10)->nullable()->after('birth_date');
            }
            if (!Schema::hasColumn('customers', 'gender')) {
                $table->char('gender', 1)->nullable()->after('birth_place_code'); // M o F
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumnIfExists('email_verified_at');
            $table->dropColumnIfExists('visura_camerale_path');
            $table->dropColumnIfExists('birth_place_code');
            $table->dropColumnIfExists('gender');
        });
    }
};
