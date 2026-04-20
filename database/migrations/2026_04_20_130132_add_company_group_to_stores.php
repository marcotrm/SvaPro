<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            if (!Schema::hasColumn('stores', 'company_group')) {
                $table->string('company_group', 100)->nullable()->after('parent_store_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumnIfExists('company_group');
        });
    }
};
