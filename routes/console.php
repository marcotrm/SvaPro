<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('loyalty:dispatch-push --limit=200')->everyMinute();
Schedule::command('loyalty:process-firebase-deliveries --limit=50')->everyMinute();
Schedule::command('inventory:auto-reorder --all --central')->dailyAt('04:10');
Schedule::command('ops:backup-database --keep=14')->dailyAt('03:40');
Schedule::command('woocommerce:sync')->hourly();
Schedule::command('app:daily-report')->dailyAt('21:00');
