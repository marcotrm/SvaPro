<?php
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
$app = require $root . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== SvaPro Insert Tests ===\n\n";

// ---- Test 1: Cliente Privato ----
echo "1. INSERT Cliente Privato: ";
try {
    $id = DB::table('customers')->insertGetId([
        'tenant_id' => 1,
        'customer_type' => 'privato',
        'code' => 'TEST_PRIV_001',
        'first_name' => 'Mario',
        'last_name' => 'Rossi',
        'codice_fiscale' => 'RSSMRA85T10A562S',
        'email' => 'mario.rossi@test.it',
        'phone' => '3331234567',
        'birth_date' => '1985-12-10',
        'address' => 'Via Roma 1',
        'city' => 'Napoli',
        'province' => 'NA',
        'zip_code' => '80100',
        'country' => 'IT',
        'marketing_consent' => 1,
        'total_orders' => 0,
        'total_spent' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "OK (id=$id)\n";
    DB::table('customers')->where('id', $id)->delete();
    echo "   Cleanup: OK\n";
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
}

// ---- Test 2: Cliente Azienda ----
echo "\n2. INSERT Cliente Azienda: ";
try {
    $id = DB::table('customers')->insertGetId([
        'tenant_id' => 1,
        'customer_type' => 'azienda',
        'code' => 'TEST_AZ_001',
        'first_name' => 'Luca',
        'last_name' => 'Verdi',
        'company_name' => 'Acme Srl',
        'vat_number' => 'IT12345678901',
        'sdi_code' => 'XXXXXXX',
        'pec_email' => 'acme@pec.it',
        'contact_person' => 'Luca Verdi',
        'email' => 'acme@acme.it',
        'phone' => '0815551234',
        'city' => 'Napoli',
        'province' => 'NA',
        'zip_code' => '80100',
        'country' => 'IT',
        'marketing_consent' => 0,
        'total_orders' => 0,
        'total_spent' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "OK (id=$id)\n";
    DB::table('customers')->where('id', $id)->delete();
    echo "   Cleanup: OK\n";
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
}

// ---- Test 3: Dipendente senza hire_date ----
$storeId = DB::table('stores')->where('tenant_id', 1)->value('id');
$tenantId = 1;
echo "\n3. INSERT Dipendente (senza hire_date): ";
try {
    $empId = DB::table('employees')->insertGetId([
        'tenant_id' => $tenantId,
        'store_id' => $storeId,
        'first_name' => 'Anna',
        'last_name' => 'Bianchi',
        'hire_date' => null,
        'status' => 'active',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    echo "OK (id=$empId)\n";
    DB::table('employees')->where('id', $empId)->delete();
    echo "   Cleanup: OK\n";
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
}

// ---- Test 4: Validation CustomerController ----
echo "\n4. Validator CustomController - cliente privato valido: ";
$validator = \Illuminate\Support\Facades\Validator::make([
    'customer_type' => 'privato',
    'first_name' => 'Mario',
    'last_name' => 'Rossi',
    'email' => 'mario@test.it',
], [
    'customer_type' => ['nullable', 'in:privato,azienda'],
    'first_name' => ['required', 'string', 'max:100'],
    'last_name' => ['required', 'string', 'max:100'],
    'email' => ['nullable', 'email', 'max:255'],
]);
echo ($validator->fails() ? "FAIL: " . json_encode($validator->errors()->all()) : "OK") . "\n";

echo "\n5. Validator CustomController - cliente azienda mancante company_name: ";
$validator2 = \Illuminate\Support\Facades\Validator::make([
    'customer_type' => 'azienda',
    'email' => 'test@test.it',
], [
    'customer_type' => ['nullable', 'in:privato,azienda'],
    'company_name' => ['required', 'string', 'max:255'],
    'email' => ['nullable', 'email', 'max:255'],
]);
echo ($validator2->fails() ? "OK (validazione corretta - company_name mancante rilevata)" : "FAIL (doveva fallire)") . "\n";

// ---- Test 5: Ordini table ----
echo "\n6. Tabella sales_orders esiste e ha le colonne giuste: ";
try {
    $cols = array_column(DB::select('PRAGMA table_info(sales_orders)'), 'name');
    $needed = ['has_stock_alert', 'stock_alert_reason', 'notes'];
    $missing = array_diff($needed, $cols);
    if (empty($missing)) {
        echo "OK (has_stock_alert, stock_alert_reason, notes presenti)\n";
    } else {
        echo "WARN - mancano: " . implode(', ', $missing) . "\n";
    }
} catch (Exception $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
}

echo "\n=== Fine Test ===\n";
