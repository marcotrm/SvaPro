<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('sdi_status', 30)->default('pending')->after('grand_total')
                ->comment('pending|sent|accepted|rejected|error');
            $table->string('sdi_identifier', 100)->nullable()->after('sdi_status')
                ->comment('Identificativo SDI ricevuto dopo invio');
            $table->string('codice_destinatario', 7)->nullable()->after('sdi_identifier')
                ->comment('Codice univoco SDI del cliente (7 caratteri)');
            $table->string('pec_destinatario')->nullable()->after('codice_destinatario')
                ->comment('PEC del cliente per fatturazione elettronica');
            $table->timestamp('sdi_sent_at')->nullable()->after('pec_destinatario');
            $table->text('sdi_error_message')->nullable()->after('sdi_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'sdi_status',
                'sdi_identifier',
                'codice_destinatario',
                'pec_destinatario',
                'sdi_sent_at',
                'sdi_error_message',
            ]);
        });
    }
};
