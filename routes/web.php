<?php

use Illuminate\Support\Facades\Route;

// React App - Catch all routes for SPA
Route::get('{any}', function () {
    return view('app');
})->where('any', '.*');
