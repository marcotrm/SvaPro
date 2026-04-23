<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$ai = app(\App\Services\AiAnalysisService::class);
try {
    echo $ai->askGemini(1, 'Ciao test');
} catch (\Exception $e) {
    echo $e->getMessage();
}
