<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('products')) {
            return;
        }

        $driver = DB::getDriverName();

        if (!Schema::hasColumn('products', 'image_url')) {
            // Colonna non esiste: aggiungila
            if ($driver === 'pgsql') {
                DB::statement('ALTER TABLE products ADD COLUMN image_url TEXT');
            } else {
                // SQLite TEXT e MySQL LONGTEXT
                Schema::table('products', function (Blueprint $table) {
                    $table->longText('image_url')->nullable()->after('image_path');
                });
            }
        } else {
            // Colonna esiste: aggiorna il tipo (solo MySQL/PgSQL — SQLite TEXT è già illimitato)
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE products MODIFY COLUMN image_url LONGTEXT');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE products ALTER COLUMN image_url TYPE TEXT');
            }
            // SQLite: TEXT è già illimitato, nessuna modifica necessaria
        }
    }

    public function down(): void
    {
        // Non necessario fare rollback del tipo colonna
    }
};
