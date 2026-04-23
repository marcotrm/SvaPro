<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $ai = app(\App\Services\AiAnalysisService::class);
    $resp = $ai->askGemini(1, "Quali negozi ci sono nel sistema?");
    echo "AI Reply (Negozi):\n" . $resp . "\n\n";

    $resp2 = $ai->askGemini(1, "Che vendite ci sono state in Centrale?");
    echo "AI Reply (Centrale):\n" . $resp2 . "\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
