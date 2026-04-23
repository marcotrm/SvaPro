<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $ai = app(\App\Services\AiAnalysisService::class);
    $resp = $ai->askGemini(1, "Analizza le vendite di questo mese");
    echo "AI Reply:\n";
    print_r($resp);
    echo "\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
