<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('cash_movements', 'balance_after_transaction')) {
                $table->decimal('balance_after_transaction', 12, 2)->nullable()->after('note');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->dropColumnIfExists('balance_after_transaction');
        });
    }
};
