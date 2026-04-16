<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'denominazione_prodotto')) {
                $table->string('denominazione_prodotto', 255)->nullable()->after('pli_code')
                    ->comment('Denominazione ufficiale prodotto ADM/PLI');
            }
            if (!Schema::hasColumn('products', 'numero_confezioni')) {
                $table->unsignedInteger('numero_confezioni')->nullable()->after('denominazione_prodotto')
                    ->comment('Numero confezioni per unità');
            }
        });

        Schema::table('product_variants', function (Blueprint $table) {
            if (!Schema::hasColumn('product_variants', 'cli_code')) {
                $table->string('cli_code', 50)->nullable()->after('prevalenza_label')
                    ->comment('Codice CLI accise doganali');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumnIfExists('denominazione_prodotto');
            $table->dropColumnIfExists('numero_confezioni');
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumnIfExists('cli_code');
        });
    }
};
