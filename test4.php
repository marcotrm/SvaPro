<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $ai = app(\App\Services\AiAnalysisService::class);
    $resp = $ai->askGemini(1, "Prevedi le scorte per i prodotti che stanno finendo.");
    echo "AI Reply:\n" . $resp . "\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
