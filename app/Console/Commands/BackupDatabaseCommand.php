<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'ops:backup-database {--keep=14 : Numero backup giornalieri da mantenere}';

    protected $description = 'Crea backup giornaliero del database (sqlite) e applica retention.';

    public function handle(): int
    {
        $connection = (string) config('database.default');

        if ($connection !== 'sqlite') {
            $this->warn('Backup automatico implementato solo per sqlite in questa versione.');
            return self::SUCCESS;
        }

        $dbPath = (string) config('database.connections.sqlite.database');
        if ($dbPath === '' || ! File::exists($dbPath)) {
            $this->error('Database sqlite non trovato: '.$dbPath);
            return self::FAILURE;
        }

        $backupDir = storage_path('app/backups');
        File::ensureDirectoryExists($backupDir);

        $timestamp = now()->format('Ymd_His');
        $backupPath = $backupDir.DIRECTORY_SEPARATOR.'database_'.$timestamp.'.sqlite';

        File::copy($dbPath, $backupPath);
        $this->info('Backup creato: '.$backupPath);

        $keep = max(1, (int) $this->option('keep'));
        $files = collect(File::files($backupDir))
            ->filter(fn ($file) => str_starts_with($file->getFilename(), 'database_') && str_ends_with($file->getFilename(), '.sqlite'))
            ->sortByDesc(fn ($file) => $file->getMTime())
            ->values();

        $toDelete = $files->slice($keep);
        foreach ($toDelete as $file) {
            File::delete($file->getPathname());
        }

        if ($toDelete->count() > 0) {
            $this->info('Retention applicata: rimossi '.$toDelete->count().' backup vecchi.');
        }

        return self::SUCCESS;
    }
}
