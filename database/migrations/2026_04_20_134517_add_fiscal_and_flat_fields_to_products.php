<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'fiscal_group')) {
                $table->string('fiscal_group', 50)->nullable()->after('brand');
            }
            if (!Schema::hasColumn('products', 'excise_tax')) {
                $table->decimal('excise_tax', 10, 2)->nullable()->after('fiscal_group');
            }
            if (!Schema::hasColumn('products', 'prevalence')) {
                $table->string('prevalence', 100)->nullable()->after('excise_tax');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumnIfExists('fiscal_group');
            $table->dropColumnIfExists('excise_tax');
            $table->dropColumnIfExists('prevalence');
        });
    }
};
