<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_otp_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('channel', 10); // sms, email
            $table->string('code', 6);
            $table->boolean('verified')->default(false);
            $table->timestamp('expires_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'customer_id', 'code']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('phone_verified')->default(false)->after('phone');
            $table->boolean('email_verified')->default(false)->after('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_otp_codes');

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['phone_verified', 'email_verified']);
        });
    }
};
