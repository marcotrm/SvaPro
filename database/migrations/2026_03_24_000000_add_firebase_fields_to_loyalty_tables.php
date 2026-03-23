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
        Schema::table('loyalty_push_notifications', function (Blueprint $table) {
            $table->timestamp('delivered_at')->nullable()->after('sent_at');
            $table->json('delivery_status')->nullable()->after('delivered_at');
            $table->json('notification_details')->nullable()->after('delivery_status');
        });

        Schema::table('outbox_events', function (Blueprint $table) {
            $table->timestamp('processed_at')->nullable()->after('published_at');
            $table->string('processing_status', 20)->nullable()->after('processed_at');
            $table->json('event_data')->nullable()->after('payload_json');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loyalty_push_notifications', function (Blueprint $table) {
            $table->dropColumn(['delivered_at', 'delivery_status', 'notification_details']);
        });

        Schema::table('outbox_events', function (Blueprint $table) {
            $table->dropColumn(['processed_at', 'processing_status', 'event_data']);
        });
    }
};
