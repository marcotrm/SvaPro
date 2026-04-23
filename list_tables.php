<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$tables = DB::select("SELECT name FROM sqlite_master WHERE type='table'");
foreach($tables as $t) echo $t->name . "\n";
