<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('store_product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();

            $table->unique(['store_id', 'product_variant_id']);
            $table->index(['tenant_id', 'store_id', 'is_enabled']);
        });

        $now = now();
        $rows = [];

        $variants = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stores as s', 's.tenant_id', '=', 'p.tenant_id')
            ->select(['p.tenant_id', 's.id as store_id', 'pv.id as product_variant_id'])
            ->get();

        foreach ($variants as $variant) {
            $rows[] = [
                'tenant_id' => $variant->tenant_id,
                'store_id' => $variant->store_id,
                'product_variant_id' => $variant->product_variant_id,
                'is_enabled' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('store_product_variants')->insert($chunk);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('store_product_variants');
    }
};