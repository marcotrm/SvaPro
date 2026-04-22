<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_week_locks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('store_id');
            $table->date('week_start'); // lunedì della settimana
            $table->unsignedBigInteger('locked_by')->nullable(); // user_id dello store_manager
            $table->timestamp('locked_at')->nullable();
            $table->unsignedBigInteger('confirmed_by')->nullable(); // user_id del project_manager
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'store_id', 'week_start'], 'swl_unique');
            $table->index(['tenant_id', 'week_start'], 'swl_week');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_week_locks');
    }
};
