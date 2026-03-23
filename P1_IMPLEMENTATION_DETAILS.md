# IMPLEMENTATION ROADMAP - PRIORITY 1 (BLOCKING)

---

## 🚩 1. PERMISSION LAYER - RETAIL CANNOT MODIFY STOCK/PRICES

**Current state:** Retail store CAN call `POST /inventory/adjust` and `PUT /products/{id}`  
**Target state:** Retail store BLOCKED from modifying inventory/prices (only admin & warehouse staff)

### 1.1 Database Changes
```sql
-- Option A: Add 'can_modify_inventory' permission to roles table
ALTER TABLE roles ADD COLUMN can_modify_inventory BOOLEAN DEFAULT FALSE;

-- Seed: 
UPDATE roles SET can_modify_inventory = TRUE WHERE code IN ('superadmin', 'admin_cliente', 'warehouse_staff');
UPDATE roles SET can_modify_inventory = FALSE WHERE code = 'dipendente'; -- retail
```

### 1.2 Middleware Changes
**File:** `app/Http/Middleware/CheckRole.php`

Add new method:
```php
public function checkInventoryModification($role)
{
    // Only superadmin, admin_cliente, magazzino can modify
    $allowed = ['superadmin', 'admin_cliente'];
    
    if (!in_array($role, $allowed)) {
        return abort(403, 'Non autorizzato a modificare giacenze');
    }
}
```

### 1.3 Route Protection
**File:** `routes/api.php`

```php
// Inventory adjustments - PROTECTED
Route::post('/inventory/adjust', [InventoryController::class, 'adjust'])
    ->middleware(['auth:sanctum', 'tenant', 'check.inventory.permission'])
    ->name('inventory.adjust');

// Product price updates - PROTECTED  
Route::put('/products/{id}/price', [CatalogController::class, 'updatePrice'])
    ->middleware(['auth:sanctum', 'tenant', 'check.inventory.permission'])
    ->name('products.update.price');
```

### 1.4 Testing
- [ ] Try POST /inventory/adjust as dipendente (should 403)
- [ ] Try POST /inventory/adjust as admin_cliente (should 200)

**Effort:** 1.5 hours  
**Status:** Ready to implement

---

## 🚩 2. STOCK ALERT (Allow oversell, flag it)

**Current state:** Order with insufficient stock → AJAX error response (blocked)  
**Target state:** Order is created, but flag is set for manual review (TenPro model)

### 2.1 Database Changes
```sql
-- Add alert column to sales_orders
ALTER TABLE sales_orders ADD COLUMN has_stock_alert BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_orders ADD COLUMN stock_alert_reason TEXT NULL;

-- Create alerts table for audit
CREATE TABLE sales_order_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    sales_order_id BIGINT NOT NULL,
    alert_type VARCHAR(50), -- 'insufficient_stock', 'price_mismatch', etc
    details JSON,
    resolved_at TIMESTAMP NULL,
    resolved_by BIGINT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);
```

### 2.2 Logic Changes
**File:** `app/Http/Controllers/Api/OrderController.php` → `place()` method

Current flow:
```php
// Check stock - if fail, return error
if ($available < $quantity) {
    return response()->json(['error' => 'Insufficient stock'], 422);
}
```

New flow:
```php
// Create order regardless
$order = DB::transaction(function () {
    $order = SalesOrder::create([...]);
    
    // Check stock for each line
    foreach ($lines as $line) {
        if ($available < $line['qty']) {  
            // Create alert instead of blocking
            SalesOrderAlert::create([
                'sales_order_id' => $order->id,
                'alert_type' => 'insufficient_stock',
                'details' => [
                    'product_id' => $line['product_id'],
                    'requested' => $line['qty'],
                    'available' => $available,
                    'shortage' => $line['qty'] - $available
                ]
            ]);
            
            $order->update(['has_stock_alert' => true]);
        }
    }
    
    // Still deduct stock (but it goes negative if needed)
    // - OR - keep it at 0 for negative inventory tracking
    $stock->decrement('on_hand', $quantity);
    
    return $order;
});

return response()->json($order, 201);
```

### 2.3 API Response
**Endpoint:** `POST /orders/place`

Old response:
```json
{
  "error": "Insufficient stock for Product X"
}
```

New response:
```json
{
  "id": 12345,
  "status": "pending",
  "has_stock_alert": true,
  "alerts": [
    {
      "type": "insufficient_stock",
      "product": "Product X",
      "requested": 100,
      "available": 50,
      "shortage": 50
    }
  ],
  "grand_total": 1250.00
}
```

### 2.4 Frontend - Alert Dashboard
New view/section:
- `GET /orders/with-alerts` → lists all orders with stock issues
- Show shortage amount
- Button to approve/resolve alert
- Logging of who resolved it

### 2.5 Testing
- [ ] Place order with qty > available
- [ ] Verify order is created (201)
- [ ] Verify alert is in DB
- [ ] Verify stock_alerts table has entry

**Effort:** 3-4 hours  
**Status:** Requires schema + logic + frontend alert dashboard

---

## 🚩 3. SMART REORDER - AUTOMATIC TO SVAPOGROUP

**Current state:** Smart reorder shows PREVIEW only (manual PO creation)  
**Target state:** Automatically generates PO to SvapoGroup based on threshold

### 3.1 Database Changes
```sql
-- Add settings to products table
ALTER TABLE products ADD COLUMN giorni_riordino INT DEFAULT 30;
ALTER TABLE products ADD COLUMN qty_minima_magazzino INT DEFAULT 10;
ALTER TABLE products ADD COLUMN auto_reorder_enabled BOOLEAN DEFAULT FALSE;

-- Track auto-generated POs
ALTER TABLE purchase_orders ADD COLUMN auto_generated_at TIMESTAMP NULL;
ALTER TABLE purchase_orders ADD COLUMN auto_generated_by VARCHAR(50) NULL; -- 'smart_reorder'
```

### 3.2 Logic Changes
**File:** `app/Services/SmartReorderService.php`

Add new method:
```php
public function runAutoReorderForTenant($tenantId, $dryRun = false)
{
    $alerts = $this->previewForTenant($tenantId);
    
    if ($dryRun) return $alerts;
    
    DB::transaction(function () use ($alerts) {
        foreach ($alerts as $alert) {
            $this->createPurchaseOrder(
                store_id: $alert['store_id'],
                supplier_id: SVAPOGROUP_ID,  // constant - central warehouse
                lines: $alert['lines'],
                auto_generated: true
            );
        }
    });
}

private function createPurchaseOrder($storeId, $supplierId, $lines, $autoGenerated = false)
{
    $po = PurchaseOrder::create([
        'store_id' => $storeId,
        'supplier_id' => $supplierId,
        'status' => 'draft',
        'auto_generated_at' => $autoGenerated ? now() : null,
        'auto_generated_by' => $autoGenerated ? 'smart_reorder' : null,
        'total_net' => $lines->sum('line_total'),
    ]);
    
    foreach ($lines as $line) {
        PurchaseOrderLine::create([
            'purchase_order_id' => $po->id,
            'product_variant_id' => $line['variant_id'],
            'qty' => $line['suggested_qty'],
            'unit_price' => $line['supplier_price'],
        ]);
    }
    
    return $po;
}
```

### 3.3 Endpoint to Run Auto-Reorder
**File:** `app/Http/Controllers/Api/SmartInventoryController.php`

```php
// GET /inventory/smart-reorder/run-auto -> dry preview
public function runAutoPreview(Request $request)
{
    $preview = $this->service->previewForTenant(auth()->user()->tenant_id);
    return response()->json($preview);
}

// POST /inventory/smart-reorder/run -> actually create POs
public function runAuto(Request $request)
{
    // Only admin/magazzino can trigger
    $this->authorize('create-purchase-orders', 'inventory');
    
    $result = $this->service->runAutoReorderForTenant(
        auth()->user()->tenant_id,
        dryRun: false
    );
    
    return response()->json([
        'message' => 'POs generated',
        'count' => count($result['po_created']),
        'details' => $result
    ]);
}
```

### 3.4 Scheduler (Optional - auto-run daily)
**File:** `app/Console/Kernel.php`

```php
protected function schedule(Schedule $schedule)
{
    $schedule->call(function () {
        foreach (Tenant::all() as $tenant) {
            tenancy()->initialize($tenant);
            
            app(SmartReorderService::class)->runAutoReorderForTenant(
                $tenant->id,
                dryRun: false
            );
        }
    })->daily()->at('06:00'); // 6 AM daily
}
```

### 3.5 Parameters Per Product
Product management screen should show:
- `giorni_riordino` - how many days of sales to look back (default 30)
- `qty_minima_magazzino` - minimum stock before alert
- `auto_reorder_enabled` - toggle to enable auto

### 3.6 Testing
- [ ] Set product with auto_reorder_enabled = true, qty_minima = 10
- [ ] Create sales orders to deplete stock
- [ ] Run POST /inventory/smart-reorder/run
- [ ] Verify PurchaseOrder created in DB
- [ ] Verify status = 'draft'

**Effort:** 4-5 hours (logic mostly exists, just need to add auto-trigger)  
**Status:** Ready to implement

---

## 📅 IMPLEMENTATION SCHEDULE

### Day 1 - Permission Layer
- [ ] DB migration (add can_modify_inventory column)
- [ ] Update middleware
- [ ] Update routes
- [ ] Test with Postman

### Day 2 - Stock Alert
- [ ] DB migration (alerts table + columns)
- [ ] Update OrderController.place()
- [ ] Create alerts dashboard view
- [ ] Test with Postman

### Day 3 - Smart Reorder Auto
- [ ] DB migration (giorni_riordino, qty_minima, auto_generated fields)
- [ ] Update SmartReorderService
- [ ] Create endpoints
- [ ] Set up scheduler (optional)
- [ ] Test

### Days 4-5 - QA + Refinement
- [ ] Test full flows
- [ ] Deploy to staging
- [ ] Get capo approval

---

## 🎬 Ready to Start?

Which priority should I implement first?

1. Permission Layer (fastest - 1.5h)
2. Smart Reorder Auto (differenziale - 5h)
3. Stock Alert (critical for business - 4h)

