<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Sconto personalizzato permanente collegato alla fidelity
            // Ex: 10.00 = 10% di sconto applicato automaticamente ad ogni vendita
            $table->decimal('personal_discount', 5, 2)->default(0)->nullable()->after('code');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('personal_discount');
        });
    }
};
