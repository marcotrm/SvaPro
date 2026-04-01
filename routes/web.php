<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\LoyaltyCardController;

Route::get('/api/test-route', function() { return response()->json(['status' => 'OK']); });
Route::get('/api/loyalty-card/{uuid}', [LoyaltyCardController::class, 'show']);

// React App - Catch all routes for SPA (excluding /api)
Route::get('{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
