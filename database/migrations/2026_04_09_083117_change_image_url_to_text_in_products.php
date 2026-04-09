<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Cambia image_url a LONGTEXT per supportare immagini base64
        // (necessario per la persistenza su Railway senza filesystem)
        if (Schema::hasTable('products')) {
            // SQLite non supporta changeColumn, usiamo SQL raw
            $driver = DB::getDriverName();

            if ($driver === 'sqlite') {
                // SQLite TEXT è già illimitato — nessuna modifica necessaria
                // Aggiungi image_url se non esiste
                if (!Schema::hasColumn('products', 'image_url')) {
                    Schema::table('products', function (Blueprint $table) {
                        $table->text('image_url')->nullable()->after('image_path');
                    });
                }
            } else {
                // PostgreSQL / MySQL: cambia a text
                Schema::table('products', function (Blueprint $table) {
                    if (!Schema::hasColumn('products', 'image_url')) {
                        $table->longText('image_url')->nullable()->after('image_path');
                    } else {
                        $table->longText('image_url')->nullable()->change();
                    }
                });
            }
        }
    }

    public function down(): void
    {
        // Non necessario fare rollback del tipo colonna
    }
};
