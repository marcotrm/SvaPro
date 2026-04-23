<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$ai = app(\App\Services\AiAnalysisService::class);
echo $ai->askGemini(1, 'Dimmi quante promozioni ci sono');
