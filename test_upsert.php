<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$c = new App\Http\Controllers\Api\PrestashopController();
$ref = new ReflectionMethod($c, 'upsertProduct');
$ref->setAccessible(true);
try {
    $psp = ['id'=>9999,'reference'=>'TEST999','name'=>['1'=>'Test'],'price'=>10,'active'=>1];
    $ref->invoke($c, $psp, 1, [], collect(), null);
    echo "SUCCESS\n";
} catch(\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
