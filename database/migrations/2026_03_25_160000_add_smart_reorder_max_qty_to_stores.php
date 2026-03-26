<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->unsignedInteger('smart_reorder_max_qty')->default(0)->after('smart_reorder_threshold')
                ->comment('Cap massimo per riga riordino automatico (0 = nessun limite)');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('smart_reorder_max_qty');
        });
    }
};
