<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // Tipo cliente
            if (! Schema::hasColumn('customers', 'customer_type')) {
                $table->string('customer_type', 20)->default('privato')->after('uuid');
            }

            // Campi azienda
            if (! Schema::hasColumn('customers', 'company_name')) {
                $table->string('company_name')->nullable()->after('customer_type');
            }
            if (! Schema::hasColumn('customers', 'vat_number')) {
                $table->string('vat_number', 30)->nullable()->after('company_name');
            }
            if (! Schema::hasColumn('customers', 'sdi_code')) {
                $table->string('sdi_code', 10)->nullable()->after('vat_number');
            }
            if (! Schema::hasColumn('customers', 'pec_email')) {
                $table->string('pec_email')->nullable()->after('sdi_code');
            }
            if (! Schema::hasColumn('customers', 'contact_person')) {
                $table->string('contact_person', 200)->nullable()->after('pec_email');
            }

            // Verifica email/phone
            if (! Schema::hasColumn('customers', 'email_verified')) {
                $table->boolean('email_verified')->default(false)->after('email');
            }
            if (! Schema::hasColumn('customers', 'phone_verified')) {
                $table->boolean('phone_verified')->default(false)->after('phone');
            }

            // Indirizzo (direttamente nella tabella customers)
            if (! Schema::hasColumn('customers', 'address')) {
                $table->string('address')->nullable()->after('marketing_consent');
            }
            if (! Schema::hasColumn('customers', 'city')) {
                $table->string('city', 100)->nullable()->after('address');
            }
            if (! Schema::hasColumn('customers', 'province')) {
                $table->string('province', 3)->nullable()->after('city');
            }
            if (! Schema::hasColumn('customers', 'zip_code')) {
                $table->string('zip_code', 10)->nullable()->after('province');
            }
            if (! Schema::hasColumn('customers', 'country')) {
                $table->string('country', 2)->default('IT')->after('zip_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $columns = [
                'customer_type', 'company_name', 'vat_number', 'sdi_code',
                'pec_email', 'contact_person', 'email_verified', 'phone_verified',
                'address', 'city', 'province', 'zip_code', 'country',
            ];

            foreach ($columns as $col) {
                if (Schema::hasColumn('customers', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
