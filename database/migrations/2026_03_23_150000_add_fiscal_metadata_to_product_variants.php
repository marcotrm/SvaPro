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
        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('excise_profile_code', 50)->nullable()->after('tax_class_id');
            $table->decimal('excise_unit_amount_override', 12, 2)->nullable()->after('excise_profile_code');
            $table->string('prevalenza_code', 50)->nullable()->after('excise_unit_amount_override');
            $table->string('prevalenza_label', 120)->nullable()->after('prevalenza_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn([
                'excise_profile_code',
                'excise_unit_amount_override',
                'prevalenza_code',
                'prevalenza_label',
            ]);
        });
    }
};