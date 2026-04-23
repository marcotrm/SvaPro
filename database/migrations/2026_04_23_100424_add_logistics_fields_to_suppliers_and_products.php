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
        Schema::table('suppliers', function (Blueprint $table) {
            $table->integer('lead_time_medio')->default(7)->after('email')->comment('Tempo medio di consegna in giorni');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->integer('scorta_sicurezza')->default(0)->after('status')->comment('Quantità minima intoccabile');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('lead_time_medio');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('scorta_sicurezza');
        });
    }
};
