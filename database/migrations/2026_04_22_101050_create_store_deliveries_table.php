<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_deliveries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id')->index();
            $table->unsignedBigInteger('store_id')->nullable()->index();
            $table->string('store_name', 120);
            $table->date('scheduled_date');
            $table->enum('status', ['pending', 'in_progress', 'done', 'issue'])->default('pending');
            $table->enum('priority', ['high', 'normal', 'low'])->default('normal');
            $table->text('items')->nullable();
            $table->text('notes')->nullable();
            $table->text('driver_note')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'scheduled_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_deliveries');
    }
};
