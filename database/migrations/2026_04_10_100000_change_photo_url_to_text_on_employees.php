<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $conn = config('database.default');

        if ($conn === 'pgsql') {
            DB::statement('ALTER TABLE employees ALTER COLUMN photo_url TYPE TEXT');
        } elseif ($conn === 'mysql') {
            DB::statement('ALTER TABLE employees MODIFY COLUMN photo_url LONGTEXT NULL');
        }
        // SQLite: VARCHAR e TEXT sono identici, nessuna azione necessaria
    }

    public function down(): void
    {
        $conn = config('database.default');

        if ($conn === 'pgsql') {
            DB::statement('ALTER TABLE employees ALTER COLUMN photo_url TYPE VARCHAR(255)');
        } elseif ($conn === 'mysql') {
            DB::statement('ALTER TABLE employees MODIFY COLUMN photo_url VARCHAR(255) NULL');
        }
    }
};
