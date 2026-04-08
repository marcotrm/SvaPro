<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_attendances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');
            $table->unsignedBigInteger('employee_id');

            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('checked_out_at')->nullable();

            // Orario previsto di inizio (es: "09:00") — preso dall'employee al momento del check-in
            $table->string('expected_start_time', 5)->nullable();

            // Minuti di ritardo al check-in (positivo = in ritardo)
            $table->smallInteger('late_minutes')->nullable();

            // Flag: notifica WhatsApp già inviata per questo ritardo
            $table->boolean('late_notified')->default(false);

            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'store_id', 'checked_in_at']);
            $table->index(['employee_id', 'checked_in_at']);
        });

        // Aggiungi expected_start_time agli employee se non esiste
        if (Schema::hasTable('employees') && !Schema::hasColumn('employees', 'expected_start_time')) {
            Schema::table('employees', function (Blueprint $table) {
                $table->string('expected_start_time', 5)->nullable()->after('hire_date')
                    ->comment('Orario previsto arrivo in negozio, es: 09:00');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_attendances');
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumnIfExists('expected_start_time');
        });
    }
};
