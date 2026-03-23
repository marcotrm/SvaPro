<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
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
            ->assertJsonPath('email', 'superadmin@demo.local')
            ->assertJsonPath('tenant_code', 'DEMO');
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

        $this->withHeaders($headers)->postJson('/api/loyalty/customers/1/devices', [
            'platform' => 'android',
            'device_token' => 'device-token-loyalty-1',
            'device_name' => 'Pixel Demo',
            'app_version' => '1.0.0',
        ])->assertOk();

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

        $this->assertDatabaseHas('loyalty_push_notifications', [
            'customer_id' => 1,
            'notification_type' => 'points_earned',
            'status' => 'queued',
        ]);

        $this->assertDatabaseHas('outbox_events', [
            'tenant_id' => 1,
            'event_name' => 'loyalty.push.notification.created',
        ]);

        $walletResponse = $this->withHeaders($headers)->getJson('/api/loyalty/customers/1/wallet');

        $walletResponse->assertOk()
            ->assertJsonPath('wallet.points_balance', 1)
            ->assertJsonPath('wallet.card_code', 'CARD-0001')
            ->assertJsonPath('devices.0.platform', 'android')
            ->assertJsonPath('notifications.0.notification_type', 'points_earned');

        $notificationsResponse = $this->withHeaders($headers)->getJson('/api/loyalty/customers/1/notifications');
        $notificationsResponse->assertOk()
            ->assertJsonPath('meta.unread', 1)
            ->assertJsonPath('data.0.status', 'queued');

        $notificationId = (int) $notificationsResponse->json('data.0.id');

        $this->withHeaders($headers)->postJson('/api/loyalty/customers/1/notifications/'.$notificationId.'/read')
            ->assertOk()
            ->assertJsonPath('message', 'Notifica segnata come letta.');

        $this->withHeaders($headers)->postJson('/api/loyalty/customers/1/redeem-preview', [
            'points' => 1,
        ])->assertOk()
            ->assertJsonPath('remaining_balance', 0)
            ->assertJsonPath('monetary_value', 0.05);
    }

    public function test_loyalty_push_dispatch_command_processes_queued_notifications(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $this->withHeaders($headers)->postJson('/api/loyalty/customers/1/devices', [
            'platform' => 'android',
            'device_token' => 'device-token-loyalty-dispatch-1',
            'device_name' => 'Pixel Dispatch',
            'app_version' => '1.0.1',
        ])->assertOk();

        $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 1,
            'warehouse_id' => 1,
            'customer_id' => 1,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 2],
            ],
        ])->assertCreated();

        $queuedNotification = DB::table('loyalty_push_notifications')
            ->where('tenant_id', 1)
            ->where('customer_id', 1)
            ->where('status', 'queued')
            ->orderByDesc('id')
            ->first();

        $this->assertNotNull($queuedNotification);
        $this->assertNull($queuedNotification->sent_at);

        Artisan::call('loyalty:dispatch-push', [
            '--tenantId' => 1,
            '--limit' => 50,
        ]);

        $dispatchedNotification = DB::table('loyalty_push_notifications')
            ->where('id', $queuedNotification->id)
            ->first();

        $this->assertSame('dispatched', $dispatchedNotification->status);
        $this->assertNotNull($dispatchedNotification->sent_at);

        $this->assertDatabaseHas('outbox_events', [
            'tenant_id' => 1,
            'event_name' => 'loyalty.push.notification.dispatch',
        ]);
    }

    public function test_paid_order_is_created_with_alert_when_stock_is_insufficient(): void
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

        $response = $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 1,
            'warehouse_id' => 1,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 999],
            ],
        ])->assertCreated()
            ->assertJsonPath('has_stock_alert', true)
            ->assertJsonPath('stock_alerts.0.product_variant_id', 1);

        $orderId = (int) $response->json('order_id');

        $this->assertDatabaseHas('sales_orders', [
            'id' => $orderId,
            'has_stock_alert' => true,
        ]);

        $this->assertDatabaseHas('sales_order_alerts', [
            'sales_order_id' => $orderId,
            'alert_type' => 'insufficient_stock',
        ]);

        $afterStock = DB::table('stock_items')
            ->where('tenant_id', 1)
            ->where('warehouse_id', 1)
            ->where('product_variant_id', 1)
            ->value('on_hand');

        $this->assertLessThan(0, (int) $afterStock);

        $this->assertSame($beforeCount + 1, DB::table('sales_orders')->count());
    }

    public function test_employee_cannot_adjust_inventory_manually(): void
    {
        $loginResponse = $this->postJson('/api/login', [
            'email' => 'staff@demo.local',
            'password' => 'ChangeMe123!',
            'device_name' => 'phpunit-staff',
        ]);

        $token = $loginResponse->json('token');

        $headers = [
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-Code' => 'DEMO',
        ];

        $this->withHeaders($headers)->postJson('/api/inventory/adjust', [
            'warehouse_id' => 1,
            'product_variant_id' => 1,
            'qty' => 5,
            'movement_type' => 'manual_adjustment',
        ])->assertStatus(403)
            ->assertJsonPath('message', 'Permessi insufficienti.');

        $this->assertDatabaseMissing('stock_movements', [
            'tenant_id' => 1,
            'warehouse_id' => 1,
            'product_variant_id' => 1,
            'movement_type' => 'manual_adjustment',
            'qty' => 5,
        ]);
    }

    public function test_inventory_movements_endpoint_returns_and_filters_records(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $this->withHeaders($headers)->postJson('/api/inventory/adjust', [
            'warehouse_id' => 1,
            'product_variant_id' => 1,
            'qty' => 7,
            'movement_type' => 'manual_adjustment',
            'reference_type' => 'cycle_count',
            'reference_id' => 101,
        ])->assertOk()
            ->assertJsonPath('message', 'Movimento registrato.');

        $allMovements = $this->withHeaders($headers)->getJson('/api/inventory/movements');
        $allMovements->assertOk()
            ->assertJsonPath('data.0.warehouse_name', 'Magazzino Centrale');

        $manualAdjustments = $this->withHeaders($headers)->getJson('/api/inventory/movements?movement_type=manual_adjustment&warehouse_id=1');
        $manualAdjustments->assertOk()
            ->assertJsonPath('data.0.movement_type', 'manual_adjustment')
            ->assertJsonPath('data.0.reference_type', 'cycle_count');
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

    public function test_customer_return_analytics_support_city_breakdown_and_frequency(): void
    {
        $headers = $this->authenticateAsSuperAdmin();
        $now = now();

        DB::table('customer_addresses')->insert([
            'customer_id' => 1,
            'type' => 'shipping',
            'line1' => 'Via Roma 1',
            'line2' => null,
            'city' => 'Afragola',
            'zip' => '80021',
            'country' => 'IT',
            'is_default' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $historicOrderId = DB::table('sales_orders')->insertGetId([
            'tenant_id' => 1,
            'store_id' => 1,
            'channel' => 'pos',
            'customer_id' => 1,
            'status' => 'paid',
            'currency' => 'EUR',
            'subtotal' => 20.00,
            'discount_total' => 0,
            'tax_total' => 4.40,
            'excise_total' => 0,
            'grand_total' => 24.40,
            'paid_at' => $now->copy()->subDays(11),
            'created_at' => $now->copy()->subDays(11),
            'updated_at' => $now->copy()->subDays(11),
        ]);

        DB::table('sales_order_lines')->insert([
            'sales_order_id' => $historicOrderId,
            'product_variant_id' => 1,
            'qty' => 1,
            'unit_price' => 20.00,
            'discount_amount' => 0,
            'tax_amount' => 4.40,
            'excise_amount' => 0,
            'line_total' => 24.40,
            'tax_snapshot_json' => json_encode(['vat_rate' => 22]),
            'created_at' => $now->copy()->subDays(11),
            'updated_at' => $now->copy()->subDays(11),
        ]);

        $this->withHeaders($headers)->getJson('/api/customers?city=Afragola')
            ->assertOk()
            ->assertJsonPath('data.0.city', 'Afragola')
            ->assertJsonPath('data.0.paid_orders_count', 2);

        $this->withHeaders($headers)->getJson('/api/customers/analytics/return-frequency')
            ->assertOk()
            ->assertJsonPath('overview.total_customers', 1)
            ->assertJsonPath('overview.returning_customers', 1)
            ->assertJsonPath('overview.loyalty_card_customers', 1)
            ->assertJsonPath('overview.app_ready_customers', 0)
            ->assertJsonPath('city_breakdown.0.city', 'Afragola')
            ->assertJsonPath('top_returners.0.customer_id', 1);
    }

    public function test_employee_top_performers_analytics_are_available(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $this->withHeaders($headers)->postJson('/api/orders/place', [
            'channel' => 'pos',
            'store_id' => 1,
            'warehouse_id' => 1,
            'employee_id' => 1,
            'status' => 'paid',
            'lines' => [
                ['product_variant_id' => 1, 'qty' => 2],
            ],
        ])->assertCreated();

        $this->withHeaders($headers)->getJson('/api/employees/analytics/top-performers')
            ->assertOk()
            ->assertJsonPath('overview.total_employees', 1)
            ->assertJsonPath('overview.active_employees', 1)
            ->assertJsonPath('top_performers.0.employee_id', 1)
            ->assertJsonPath('top_performers.0.rank', 1);
    }

    public function test_catalog_can_be_filtered_by_store_assignments(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $storesResponse = $this->withHeaders($headers)->getJson('/api/stores');
        $storesResponse->assertOk()
            ->assertJsonPath('data.0.name', 'Negozio Centrale');

        $this->withHeaders($headers)->postJson('/api/catalog/products', [
            'sku' => 'LIQ-ZONA-001',
            'name' => 'Liquido Zona Roma',
            'product_type' => 'liquid',
            'brand_id' => 1,
            'category_id' => 1,
            'default_supplier_id' => 1,
            'store_ids' => [1],
            'variants' => [
                [
                    'sale_price' => 7.90,
                    'cost_price' => 3.20,
                    'pack_size' => 1,
                    'flavor' => 'Mint Roma',
                    'tax_class_id' => 1,
                ],
            ],
        ])->assertCreated();

        $this->withHeaders($headers)->getJson('/api/catalog/products?store_id=1')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Liquido Zona Roma']);

        $milanCatalog = $this->withHeaders($headers)->getJson('/api/catalog/products?store_id=2');
        $milanCatalog->assertOk();

        $productNames = collect($milanCatalog->json('data'))->pluck('name')->all();
        $this->assertNotContains('Liquido Zona Roma', $productNames);
    }

    public function test_catalog_variant_fiscal_metadata_can_be_saved_updated_and_used_in_quote(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $createResponse = $this->withHeaders($headers)->postJson('/api/catalog/products', [
            'sku' => 'LIQ-FISC-001',
            'name' => 'Liquido Fiscale Demo',
            'product_type' => 'liquid',
            'default_supplier_id' => 1,
            'volume_ml' => 10,
            'nicotine_mg' => 4,
            'store_ids' => [1],
            'variants' => [
                [
                    'sale_price' => 8.90,
                    'cost_price' => 3.10,
                    'pack_size' => 1,
                    'flavor' => 'Fiscal Mint',
                    'tax_class_id' => 1,
                    'excise_profile_code' => 'LIQUID-IT',
                    'excise_unit_amount_override' => 0.50,
                    'prevalenza_code' => 'PV-LIQ',
                    'prevalenza_label' => 'Liquidi pronta vendita',
                ],
            ],
        ])->assertCreated();

        $productId = (int) $createResponse->json('product_id');

        $createdProduct = $this->withHeaders($headers)->getJson('/api/catalog/products')
            ->assertOk()
            ->json('data');

        $created = collect($createdProduct)->firstWhere('id', $productId);

        $this->assertSame('LIQ-FISC-001', $created['sku']);
        $this->assertSame('LIQUID-IT', $created['variants'][0]['excise_profile_code']);
        $this->assertSame('PV-LIQ', $created['variants'][0]['prevalenza_code']);

        $this->withHeaders($headers)->putJson('/api/catalog/products/'.$productId, [
            'sku' => 'LIQ-FISC-001',
            'name' => 'Liquido Fiscale Demo Aggiornato',
            'product_type' => 'liquid',
            'default_supplier_id' => 1,
            'volume_ml' => 10,
            'nicotine_mg' => 4,
            'store_ids' => [1, 2],
            'variants' => [
                [
                    'id' => $created['variants'][0]['id'],
                    'sale_price' => 9.40,
                    'cost_price' => 3.10,
                    'pack_size' => 1,
                    'flavor' => 'Fiscal Mint',
                    'tax_class_id' => 1,
                    'excise_profile_code' => 'LIQUID-IT-REV',
                    'excise_unit_amount_override' => 0.75,
                    'prevalenza_code' => 'PV-LIQ-REV',
                    'prevalenza_label' => 'Liquidi revisione rete',
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('message', 'Prodotto aggiornato.');

        $variantId = (int) $created['variants'][0]['id'];

        $this->assertDatabaseHas('product_variants', [
            'id' => $variantId,
            'excise_profile_code' => 'LIQUID-IT-REV',
            'prevalenza_code' => 'PV-LIQ-REV',
        ]);

        $quote = $this->withHeaders($headers)->postJson('/api/orders/quote', [
            'lines' => [
                ['product_variant_id' => $variantId, 'qty' => 2],
            ],
        ]);

        $quote->assertOk()
            ->assertJsonPath('totals.excise_total', 1.5)
            ->assertJsonPath('lines.0.tax_snapshot.excise_profile_code', 'LIQUID-IT-REV')
            ->assertJsonPath('lines.0.tax_snapshot.prevalenza_code', 'PV-LIQ-REV')
            ->assertJsonPath('lines.0.tax_snapshot.excise_source', 'variant_override');

        $storeTwoCatalog = $this->withHeaders($headers)->getJson('/api/catalog/products?store_id=2');
        $storeTwoCatalog->assertOk();

        $storeTwoNames = collect($storeTwoCatalog->json('data'))->pluck('name')->all();
        $this->assertContains('Liquido Fiscale Demo Aggiornato', $storeTwoNames);
    }

    public function test_smart_inventory_creates_purchase_order_for_best_seller_low_stock_in_milan(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        DB::table('products')
            ->where('id', 1)
            ->update([
                'auto_reorder_enabled' => true,
                'reorder_days' => 30,
                'min_stock_qty' => 10,
            ]);

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
            ->assertJsonPath('alerts.0.available', 2)
            ->assertJsonPath('alerts.0.threshold', 10);

        $run = $this->withHeaders($headers)->postJson('/api/inventory/smart-reorder/run-auto');
        $run->assertOk()
            ->assertJsonPath('created_orders.0.store_id', 2)
            ->assertJsonPath('created_orders.0.supplier_id', 1);

        $this->assertDatabaseHas('purchase_orders', [
            'store_id' => 2,
            'supplier_id' => 1,
            'source' => 'auto_reorder',
            'auto_generated_by' => 'smart_reorder',
        ]);

        $this->assertDatabaseHas('purchase_order_lines', [
            'product_variant_id' => 1,
        ]);
    }

    public function test_loyalty_push_monitoring_stats_endpoint_returns_aggregates(): void
    {
        $headers = $this->authenticateAsSuperAdmin();
        $now = now();

        DB::table('outbox_events')->delete();
        DB::table('loyalty_push_notifications')->delete();
        DB::table('loyalty_device_tokens')->delete();

        DB::table('loyalty_device_tokens')->insert([
            [
                'tenant_id' => 1,
                'customer_id' => 1,
                'platform' => 'android',
                'device_token' => 'monitor-device-1',
                'device_name' => 'Pixel Monitor',
                'app_version' => '1.0.0',
                'notifications_enabled' => true,
                'last_seen_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tenant_id' => 1,
                'customer_id' => 1,
                'platform' => 'ios',
                'device_token' => 'monitor-device-2',
                'device_name' => 'iPhone Monitor',
                'app_version' => '1.0.0',
                'notifications_enabled' => false,
                'last_seen_at' => $now,
                'created_at' => $now->copy()->subDays(1),
                'updated_at' => $now->copy()->subDays(1),
            ],
        ]);

        DB::table('loyalty_push_notifications')->insert([
            [
                'tenant_id' => 1,
                'customer_id' => 1,
                'notification_type' => 'points_earned',
                'title' => 'Hai guadagnato punti',
                'message' => 'Test monitor 1',
                'status' => 'queued',
                'target_devices_count' => 0,
                'queued_at' => $now,
                'sent_at' => null,
                'delivered_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tenant_id' => 1,
                'customer_id' => 1,
                'notification_type' => 'points_earned',
                'title' => 'Push in consegna',
                'message' => 'Test monitor 2',
                'status' => 'dispatched',
                'target_devices_count' => 1,
                'queued_at' => $now->copy()->subDay(),
                'sent_at' => $now->copy()->subDay(),
                'delivered_at' => null,
                'created_at' => $now->copy()->subDay(),
                'updated_at' => $now->copy()->subDay(),
            ],
            [
                'tenant_id' => 1,
                'customer_id' => 1,
                'notification_type' => 'new_offer',
                'title' => 'Promozione attiva',
                'message' => 'Test monitor 3',
                'status' => 'delivered',
                'target_devices_count' => 1,
                'queued_at' => $now->copy()->subDays(2),
                'sent_at' => $now->copy()->subDays(2),
                'delivered_at' => $now->copy()->subDays(2),
                'created_at' => $now->copy()->subDays(2),
                'updated_at' => $now->copy()->subDays(2),
            ],
        ]);

        DB::table('outbox_events')->insert([
            [
                'tenant_id' => 1,
                'event_name' => 'loyalty.push.notification.dispatch',
                'payload_json' => json_encode(['notification_id' => 1]),
                'event_data' => json_encode(['notification_id' => 1]),
                'published_at' => null,
                'processed_at' => $now,
                'processing_status' => 'success',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tenant_id' => 1,
                'event_name' => 'loyalty.push.notification.dispatch',
                'payload_json' => json_encode(['notification_id' => 2]),
                'event_data' => json_encode(['notification_id' => 2]),
                'published_at' => null,
                'processed_at' => $now->copy()->subDay(),
                'processing_status' => 'failed',
                'created_at' => $now->copy()->subDay(),
                'updated_at' => $now->copy()->subDay(),
            ],
        ]);

        $this->withHeaders($headers)->getJson('/api/loyalty/monitoring/push-stats?days=7')
            ->assertOk()
            ->assertJsonPath('summary.pending_queue', 1)
            ->assertJsonPath('summary.in_flight', 1)
            ->assertJsonPath('summary.success_count', 1)
            ->assertJsonPath('summary.failed_count', 1)
            ->assertJsonPath('summary.processed_count', 2)
            ->assertJsonPath('summary.success_rate', 50)
            ->assertJsonPath('summary.active_devices', 1)
            ->assertJsonPath('summary.total_devices', 2)
            ->assertJsonPath('status_breakdown.queued', 1)
            ->assertJsonPath('status_breakdown.dispatched', 1)
            ->assertJsonPath('status_breakdown.delivered', 1)
            ->assertJsonPath('meta.days', 7);
    }

    public function test_store_filter_scopes_inventory_and_employees_endpoints(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $inventoryRome = $this->withHeaders($headers)->getJson('/api/inventory/stock?store_id=1');
        $inventoryRome->assertOk();
        $romeWarehouseNames = collect($inventoryRome->json('data'))->pluck('warehouse_name')->unique()->values()->all();
        $this->assertSame(['Magazzino Centrale'], $romeWarehouseNames);

        $inventoryMilan = $this->withHeaders($headers)->getJson('/api/inventory/stock?store_id=2');
        $inventoryMilan->assertOk();
        $milanWarehouseNames = collect($inventoryMilan->json('data'))->pluck('warehouse_name')->unique()->values()->all();
        $this->assertSame(['Magazzino Milano'], $milanWarehouseNames);

        $employeesRome = $this->withHeaders($headers)->getJson('/api/employees?store_id=1');
        $employeesRome->assertOk()
            ->assertJsonPath('data.0.store_name', 'Negozio Centrale');

        $employeesMilan = $this->withHeaders($headers)->getJson('/api/employees?store_id=2');
        $employeesMilan->assertOk();
        $this->assertCount(0, $employeesMilan->json('data'));
    }

    public function test_superadmin_can_list_and_switch_tenants(): void
    {
        $headers = $this->authenticateAsSuperAdmin();

        $tenantsResponse = $this->withHeaders($headers)->getJson('/api/tenants');
        $tenantsResponse->assertOk();
        $tenantCodes = collect($tenantsResponse->json('data'))->pluck('code')->all();
        $this->assertContains('DEMO', $tenantCodes);
        $this->assertContains('NORD', $tenantCodes);

        $northStoresResponse = $this->withHeaders([
            'Authorization' => $headers['Authorization'],
            'X-Tenant-Code' => 'NORD',
        ])->getJson('/api/stores');

        $northStoresResponse->assertOk()
            ->assertJsonPath('data.0.name', 'Negozio Torino');
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
