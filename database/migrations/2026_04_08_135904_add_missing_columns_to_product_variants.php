<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            if (!Schema::hasColumn('product_variants', 'nicotine_strength')) {
                $table->decimal('nicotine_strength', 6, 2)->nullable()->after('resistance_ohm');
            }
            if (!Schema::hasColumn('product_variants', 'volume_ml')) {
                $table->decimal('volume_ml', 8, 2)->nullable()->after('nicotine_strength');
            }
            if (!Schema::hasColumn('product_variants', 'color')) {
                $table->string('color', 80)->nullable()->after('volume_ml');
            }
            if (!Schema::hasColumn('product_variants', 'barcode')) {
                $table->string('barcode', 100)->nullable()->after('color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumnIfExists('nicotine_strength');
            $table->dropColumnIfExists('volume_ml');
            $table->dropColumnIfExists('color');
            $table->dropColumnIfExists('barcode');
        });
    }
};
