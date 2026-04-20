<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create('/api/inventory/cross-store?product_id=1', 'GET');
// mimic tenant and user auth if needed, but cross-store needs tenant_id
$request->attributes->set('tenant_id', 1);
$response = app()->make('App\Http\Controllers\Api\InventoryController')->crossStore($request);
echo $response->getContent();
