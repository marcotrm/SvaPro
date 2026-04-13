<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$cols = DB::select("PRAGMA table_info(customers)");
foreach ($cols as $c) { echo $c->name . "\n"; }
