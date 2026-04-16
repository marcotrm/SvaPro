<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            // Numero di esercizio ADM (es: 001)
            if (!Schema::hasColumn('stores', 'numero_esercizio')) {
                $table->string('numero_esercizio', 20)->nullable()->after('code')
                    ->comment('Numero esercizio fiscale ADM');
            }
            // Numero ordinale ADM (es: 001)
            if (!Schema::hasColumn('stores', 'numero_ordinale')) {
                $table->string('numero_ordinale', 20)->nullable()->after('numero_esercizio')
                    ->comment('Numero ordinale fiscale ADM');
            }
            // Negozio madre (parent store per gerarchia categoria/sottocategoria)
            if (!Schema::hasColumn('stores', 'parent_store_id')) {
                $table->unsignedBigInteger('parent_store_id')->nullable()->after('is_main')
                    ->comment('ID del negozio madre (categoria padre)');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumnIfExists('numero_esercizio');
            $table->dropColumnIfExists('numero_ordinale');
            $table->dropColumnIfExists('parent_store_id');
        });
    }
};
