<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('employee_notifications', 'user_id')) {
                // Permette di notificare admin che non hanno un employee record
                $table->unsignedBigInteger('user_id')->nullable()->after('employee_id');
            }
            // employee_id diventa nullable per gli admin (non sempre hanno un employee)
            $table->unsignedBigInteger('employee_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('employee_notifications', function (Blueprint $table) {
            $table->dropColumnIfExists('user_id');
        });
    }
};
