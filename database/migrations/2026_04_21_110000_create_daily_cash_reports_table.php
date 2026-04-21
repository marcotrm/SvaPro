<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_cash_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->date('report_date');
            $table->decimal('cash_total', 12, 2)->default(0);   // vendite contanti POS
            $table->decimal('pos_total', 12, 2)->default(0);    // vendite carta POS
            $table->decimal('total', 12, 2)->default(0);         // totale generale
            $table->integer('transactions_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'store_id', 'report_date']); // un report per store per giorno
            $table->index(['tenant_id', 'store_id', 'report_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_cash_reports');
    }
};
