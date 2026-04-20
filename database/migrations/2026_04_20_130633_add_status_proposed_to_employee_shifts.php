<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_shifts', function (Blueprint $table) {
            if (!Schema::hasColumn('employee_shifts', 'status')) {
                // 'confirmed' = turno approvato dall'admin, 'proposed' = proposta del dipendente
                $table->string('status', 20)->default('confirmed')->after('color');
            }
            if (!Schema::hasColumn('employee_shifts', 'proposed_by')) {
                // ID del dipendente che ha proposto il turno (null se inserito dall'admin)
                $table->unsignedBigInteger('proposed_by')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('employee_shifts', function (Blueprint $table) {
            $table->dropColumnIfExists('proposed_by');
            $table->dropColumnIfExists('status');
        });
    }
};
