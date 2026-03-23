<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('audit_logs', 'user_name')) {
                $table->string('user_name')->nullable()->after('actor_user_id');
            }
            if (! Schema::hasColumn('audit_logs', 'entity_label')) {
                $table->string('entity_label')->nullable()->after('entity_id');
            }
            if (! Schema::hasColumn('audit_logs', 'changes_json')) {
                $table->json('changes_json')->nullable()->after('entity_label');
            }
            if (! Schema::hasColumn('audit_logs', 'performed_at')) {
                $table->timestamp('performed_at')->nullable()->after('changes_json');
                $table->index(['tenant_id', 'performed_at']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropColumn(['user_name', 'entity_label', 'changes_json', 'performed_at']);
        });
    }
};
