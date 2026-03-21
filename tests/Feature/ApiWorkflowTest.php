<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ApiWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_login_and_me_endpoint_work(): void
    {
        $loginResponse = $this->postJson('/api/login', [
            'email' => 'superadmin@demo.local',
            'password' => 'ChangeMe123!',
            'device_name' => 'phpunit',
        ]);

        $loginResponse->assertOk()->assertJsonStructure([
            'token',
            'token_type',
            'user' => ['id', 'email', 'roles'],
        ]);

        $token = $loginResponse->json('token');

        $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Code' => 'DEMO',
        ])->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'superadmin@demo.local');
    }

    public function test_quote_and_place_reduce_stock(): void
    {
        $loginResponse = $this->postJson('/api/login', [
            'email' => 'superadmin@demo.local',
            'password' => 'ChangeMe123!',
            'device_name' => 'phpunit-2',
        ]);

        $token = $loginResponse->json('token');

        $headers = [
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Code' => 'DEMO',
        ];

        $quoteResponse = $this->withHeaders($headers)->postJson('/api/orders/quote', [
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 2],
            ],
        ]);

        $quoteResponse->assertOk()->assertJsonPath('totals.grand_total', 18.84);

        $before = DB::table('stock_items')
            ->where('tenant_id', 1)
            ->where('warehouse_id', 1)
            ->where('product_variant_id', 1)
            ->value('on_hand');

        $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 1,
            'warehouse_id' => 1,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 1],
            ],
        ])->assertCreated();

        $after = DB::table('stock_items')
            ->where('tenant_id', 1)
            ->where('warehouse_id', 1)
            ->where('product_variant_id', 1)
            ->value('on_hand');

        $this->assertSame((int) $before - 1, (int) $after);
    }

    public function test_paid_order_grants_loyalty_and_employee_points(): void
    {
        $loginResponse = $this->postJson('/api/login', [
            'email' => 'superadmin@demo.local',
            'password' => 'ChangeMe123!',
            'device_name' => 'phpunit-3',
        ]);

        $token = $loginResponse->json('token');

        $headers = [
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Code' => 'DEMO',
        ];

        $beforeCount = DB::table('sales_orders')->count();

        $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 1,
            'warehouse_id' => 1,
            'customer_id' => 1,
            'employee_id' => 1,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 2],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('loyalty_ledger', [
            'customer_id' => 1,
            'event_type' => 'earn',
            'points_delta' => 1,
        ]);

        $this->assertDatabaseHas('employee_sales_facts', [
            'employee_id' => 1,
            'tenant_id' => 1,
        ]);

        $this->assertDatabaseHas('employee_point_ledger', [
            'employee_id' => 1,
            'source_type' => 'sale',
        ]);

        $walletResponse = $this->withHeaders($headers)->getJson('/api/loyalty/customers/1/wallet');

        $walletResponse->assertOk()
            ->assertJsonPath('wallet.points_balance', 1)
            ->assertJsonPath('wallet.card_code', 'CARD-0001');

        $this->withHeaders($headers)->postJson('/api/loyalty/customers/1/redeem-preview', [
            'points' => 1,
        ])->assertOk()
            ->assertJsonPath('remaining_balance', 0)
            ->assertJsonPath('monetary_value', 0.05);
    }

    public function test_paid_order_is_rejected_when_stock_is_insufficient(): void
    {
        $loginResponse = $this->postJson('/api/login', [
            'email' => 'superadmin@demo.local',
            'password' => 'ChangeMe123!',
            'device_name' => 'phpunit-4',
        ]);

        $token = $loginResponse->json('token');

        $headers = [
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Code' => 'DEMO',
        ];

        $beforeCount = DB::table('sales_orders')->count();

        $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 1,
            'warehouse_id' => 1,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 999],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Stock insufficiente per la variante 1');

        $this->assertSame($beforeCount, DB::table('sales_orders')->count());
    }

    public function test_customer_employee_and_shipping_crud_flow_works(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $customerResponse = $this->withHeaders($headers)->postJson('/api/customers', [
            'code' => 'CUST-NEW-01',
            'first_name' => 'Giulia',
            'last_name' => 'Verdi',
            'email' => 'giulia@example.com',
            'marketing_consent' => true,
        ])->assertCreated();

        $customerId = $customerResponse->json('customer_id');

        $this->withHeaders($headers)->putJson('/api/customers/'.$customerId, [
            'first_name' => 'Giulia',
            'last_name' => 'Bianchi',
            'email' => 'giulia@example.com',
            'phone' => '3200000000',
            'marketing_consent' => false,
        ])->assertOk();

        $employeeResponse = $this->withHeaders($headers)->postJson('/api/employees', [
            'store_id' => 1,
            'first_name' => 'Marco',
            'last_name' => 'Neri',
        ])->assertCreated();

        $employeeId = $employeeResponse->json('employee_id');

        $this->withHeaders($headers)->putJson('/api/employees/'.$employeeId, [
            'first_name' => 'Marco',
            'last_name' => 'Neri',
            'status' => 'active',
        ])->assertOk();

        $orderResponse = $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'web',
            'store_id' => 1,
            'warehouse_id' => 1,
            'customer_id' => $customerId,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 1],
            ],
        ])->assertCreated();

        $carrierResponse = $this->withHeaders($headers)->postJson('/api/shipping/carriers', [
            'name' => 'Corriere Demo',
            'api_type' => 'manual',
            'config' => ['pickup' => 'daily'],
        ])->assertCreated();

        $shipmentResponse = $this->withHeaders($headers)->postJson('/api/shipping/shipments', [
            'sales_order_id' => $orderResponse->json('order_id'),
            'carrier_id' => $carrierResponse->json('carrier_id'),
            'tracking_number' => 'TRACK123',
            'packages' => [
                ['weight_grams' => 250],
            ],
        ])->assertCreated();

        $this->withHeaders($headers)->putJson('/api/shipping/shipments/'.$shipmentResponse->json('shipment_id'), [
            'status' => 'shipped',
            'tracking_number' => 'TRACK123',
        ])->assertOk();

        $this->assertDatabaseHas('customers', ['id' => $customerId, 'last_name' => 'Bianchi']);
        $this->assertDatabaseHas('employees', ['id' => $employeeId, 'first_name' => 'Marco']);
        $this->assertDatabaseHas('shipments', ['id' => $shipmentResponse->json('shipment_id'), 'status' => 'shipped']);
    }

    public function test_smart_inventory_creates_purchase_order_for_best_seller_low_stock_in_milan(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 2,
            'warehouse_id' => 2,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 1],
            ],
        ])->assertCreated();

        $preview = $this->withHeaders($headers)->getJson('/api/inventory/smart-reorder/preview');
        $preview->assertOk()
            ->assertJsonPath('alerts.0.store_name', 'Negozio Milano')
            ->assertJsonPath('alerts.0.available', 2);

        $run = $this->withHeaders($headers)->postJson('/api/inventory/smart-reorder/run');
        $run->assertOk()
            ->assertJsonPath('created_orders.0.store_id', 2)
            ->assertJsonPath('created_orders.0.supplier_id', 1);

        $this->assertDatabaseHas('purchase_orders', [
            'store_id' => 2,
            'supplier_id' => 1,
            'source' => 'auto_reorder',
        ]);

        $this->assertDatabaseHas('purchase_order_lines', [
            'product_variant_id' => 1,
        ]);
    }

    private function authenticateAsSuperAdmin(): array
    {
        $loginResponse = $this->postJson('/api/login', [
            'email' => 'superadmin@demo.local',
            'password' => 'ChangeMe123!',
            'device_name' => 'phpunit-admin',
        ]);

        return [
            'Authorization' => 'Bearer '.$loginResponse->json('token'),
            'X-Tenant-Code' => 'DEMO',
        ];
    }
}
