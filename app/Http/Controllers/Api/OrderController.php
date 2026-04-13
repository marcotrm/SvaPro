<?php

namespace App\Http\Controllers\Api;

use App\Services\AuditLogger;
use App\Services\LoyaltyPushService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrderController extends Controller
{
    public function __construct(private readonly LoyaltyPushService $loyaltyPushService)
    {
    }

    public function quote(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0'],
            'order_discount_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $orderDiscount = (float) $request->input('order_discount_amount', 0);
        return response()->json($this->buildQuote($tenantId, (array) $request->input('lines'), $orderDiscount));
    }
    
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'status' => ['nullable', 'in:all,draft,paid,pending'],
            'store_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
            'product_type' => ['nullable', 'string', 'max:50'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $status = (string) ($request->input('status') ?: 'all');
        $limit = (int) ($request->input('limit') ?: 80);
        $term = trim((string) $request->input('q', ''));

        $rows = DB::table('sales_orders as so')
            ->leftJoin('customers as c', function ($join) use ($tenantId) {
                $join->on('c.id', '=', 'so.customer_id')
                    ->where('c.tenant_id', '=', $tenantId);
            })
            ->leftJoin('stores as st', function ($join) use ($tenantId) {
                $join->on('st.id', '=', 'so.store_id')
                    ->where('st.tenant_id', '=', $tenantId);
            })
            ->leftJoin('employees as emp', function ($join) use ($tenantId) {
                $join->on('emp.id', '=', DB::raw('COALESCE(so.sold_by_employee_id, so.employee_id)'))
                    ->where('emp.tenant_id', '=', $tenantId);
            })
            ->leftJoin('loyalty_ledger as ll', function ($join) {
                $join->on('ll.order_id', '=', 'so.id')
                    ->where('ll.event_type', '=', 'earn');
            })
            ->where('so.tenant_id', $tenantId)
            ->when($status !== 'all', fn ($query) => $query->where('so.status', $status))
            ->when($request->filled('store_id'), fn ($query) => $query->where('so.store_id', (int) $request->integer('store_id')))
            ->when($request->filled('date_from'), fn ($query) => $query->where('so.created_at', '>=', $request->input('date_from')))
            ->when($request->filled('date_to'), fn ($query) => $query->where('so.created_at', '<=', $request->input('date_to') . ' 23:59:59'))
            ->when($request->filled('supplier_id'), function ($query) use ($request, $tenantId) {
                // Filtra ordini che contengono prodotti del fornitore specificato
                $supplierId = (int) $request->integer('supplier_id');
                $query->whereExists(function ($sub) use ($supplierId, $tenantId) {
                    $sub->select(DB::raw(1))
                        ->from('sales_order_lines as sol_f')
                        ->join('product_variants as pv_f', 'pv_f.id', '=', 'sol_f.product_variant_id')
                        ->join('products as p_f', 'p_f.id', '=', 'pv_f.product_id')
                        ->whereColumn('sol_f.sales_order_id', 'so.id')
                        ->where('p_f.tenant_id', $tenantId)
                        ->where('p_f.default_supplier_id', $supplierId);
                });
            })
            ->when($request->filled('product_type'), function ($query) use ($request, $tenantId) {
                // Filtra ordini che contengono il tipo prodotto specificato
                $productType = (string) $request->input('product_type');
                $query->whereExists(function ($sub) use ($productType, $tenantId) {
                    $sub->select(DB::raw(1))
                        ->from('sales_order_lines as sol_t')
                        ->join('product_variants as pv_t', 'pv_t.id', '=', 'sol_t.product_variant_id')
                        ->join('products as p_t', 'p_t.id', '=', 'pv_t.product_id')
                        ->whereColumn('sol_t.sales_order_id', 'so.id')
                        ->where('p_t.tenant_id', $tenantId)
                        ->where('p_t.product_type', $productType);
                });
            })
            ->when($term !== '', function ($query) use ($term) {
                $query->where(function ($nested) use ($term) {
                    $nested->where('so.id', 'like', '%'.$term.'%')
                        ->orWhere('c.first_name', 'like', '%'.$term.'%')
                        ->orWhere('c.last_name', 'like', '%'.$term.'%');
                });
            })
            ->groupBy([
                'so.id',
                'so.store_id',
                'so.customer_id',
                'so.employee_id',
                'so.sold_by_employee_id',
                'so.status',
                'so.channel',
                'so.grand_total',
                'so.currency',
                'so.created_at',
                'so.updated_at',
                'c.first_name',
                'c.last_name',
                'st.id',
                'st.name',
                'emp.first_name',
                'emp.last_name',
            ])
            ->select([
                'so.id',
                'so.store_id',
                'so.customer_id',
                'so.employee_id',
                'so.sold_by_employee_id',
                'so.status',
                'so.channel',
                'so.grand_total',
                'so.currency',
                'so.created_at',
                'so.updated_at',
                'c.first_name as customer_first_name',
                'c.last_name as customer_last_name',
                'st.id as store_db_id',
                'st.name as store_name',
                'emp.first_name as employee_first_name',
                'emp.last_name as employee_last_name',
                DB::raw('COALESCE(SUM(ll.points_delta), 0) as loyalty_points_awarded'),
            ])
            ->orderByDesc('so.created_at')
            ->orderByDesc('so.id')
            ->limit($limit)
            ->get();

        $data = $rows->map(fn ($row) => $this->mapOrderListRow($row))->values();

        return response()->json(['data' => $data]);
    }

    public function show(Request $request, int $orderId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $row = DB::table('sales_orders as so')
            ->leftJoin('customers as c', function ($join) use ($tenantId) {
                $join->on('c.id', '=', 'so.customer_id')
                    ->where('c.tenant_id', '=', $tenantId);
            })
            ->leftJoin('stores as st', function ($join) use ($tenantId) {
                $join->on('st.id', '=', 'so.store_id')
                    ->where('st.tenant_id', '=', $tenantId);
            })
            ->leftJoin('employees as emp', function ($join) use ($tenantId) {
                $join->on('emp.id', '=', 'so.employee_id')
                    ->where('emp.tenant_id', '=', $tenantId);
            })
            ->leftJoin('loyalty_ledger as ll', function ($join) {
                $join->on('ll.order_id', '=', 'so.id')
                    ->where('ll.event_type', '=', 'earn');
            })
            ->where('so.tenant_id', $tenantId)
            ->where('so.id', $orderId)
            ->groupBy([
                'so.id',
                'so.store_id',
                'so.employee_id',
                'so.sold_by_employee_id',
                'so.customer_id',
                'so.status',
                'so.grand_total',
                'so.currency',
                'so.created_at',
                'so.updated_at',
                'c.first_name',
                'c.last_name',
                'st.id',
                'st.name',
                'emp.first_name',
                'emp.last_name',
            ])
            ->select([
                'so.id',
                'so.store_id',
                'so.employee_id',
                'so.sold_by_employee_id',
                'so.customer_id',
                'so.status',
                'so.grand_total',
                'so.currency',
                'so.created_at',
                'so.updated_at',
                'c.first_name as customer_first_name',
                'c.last_name as customer_last_name',
                'st.id as warehouse_id',
                'st.name as warehouse_name',
                'st.name as store_name',
                'emp.first_name as employee_first_name',
                'emp.last_name as employee_last_name',
                DB::raw('COALESCE(SUM(ll.points_delta), 0) as loyalty_points_awarded'),
            ])
            ->first();

        if (! $row) {
            return response()->json(['message' => 'Ordine non trovato.'], 404);
        }

        $lines = DB::table('sales_order_lines as sol')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'sol.product_variant_id')
            ->leftJoin('products as p', 'p.id', '=', 'pv.product_id')
            ->where('sol.sales_order_id', $orderId)
            ->select([
                'sol.id',
                'sol.product_variant_id',
                'sol.qty',
                'sol.unit_price',
                'sol.discount_amount',
                'sol.tax_amount',
                'sol.excise_amount',
                'sol.line_total',
                'p.sku',
                'p.name as product_name',
                'pv.flavor',
                'pv.resistance_ohm',
            ])
            ->get();

        $data = $this->mapOrderListRow($row);
        $data['lines'] = $lines;

        return response()->json(['data' => $data]);
    }

    public function options(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        $customers = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(300)
            ->get(['id', 'first_name', 'last_name']);

        $employees = DB::table('employees')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(300)
            ->get(['id', 'first_name', 'last_name', 'barcode']);

        $warehouses = DB::table('warehouses')
            ->where('tenant_id', $tenantId)
            ->when($storeId !== null, fn ($query) => $query->where('store_id', $storeId))
            ->orderBy('name')
            ->get(['id', 'store_id', 'name']);

        $variantQuery = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pv.tenant_id', $tenantId)
            ->select([
                'pv.id',
                'pv.sale_price',
                'pv.flavor',
                'pv.resistance_ohm',
                'p.name as product_name',
                'p.sku',
            ])
            ->orderByDesc('pv.id')
            ->limit(600);

        if ($storeId !== null) {
            $variantQuery->join('store_product_variants as spv', function ($join) use ($tenantId, $storeId) {
                $join->on('spv.product_variant_id', '=', 'pv.id')
                    ->where('spv.tenant_id', '=', $tenantId)
                    ->where('spv.store_id', '=', $storeId)
                    ->where('spv.is_enabled', '=', true);
            });
        }

        $variants = $variantQuery->get();

        return response()->json([
            'data' => [
                'customers' => $customers,
                'employees' => $employees,
                'warehouses' => $warehouses,
                'variants' => $variants,
            ],
        ]);
    }

    public function place(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'channel'                    => ['required', 'in:web,pos'],
            'store_id'                   => ['nullable', 'integer'],
            'customer_id'                => ['nullable', 'integer'],
            'employee_id'                => ['nullable', 'integer'],
            'sold_by_employee_id'        => ['nullable', 'integer'],
            'warehouse_id'               => ['nullable', 'integer'],
            'payment_method'             => ['nullable', 'string', 'max:50'],
            'payments'                   => ['nullable', 'array'],
            'payments.*.method'          => ['required', 'string', 'max:50'],
            'payments.*.amount'          => ['required', 'numeric', 'min:0'],
            'notes'                      => ['nullable', 'string', 'max:2000'],
            'status'                     => ['nullable', 'in:draft,paid'],
            'lines'                      => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['nullable', 'integer'],
            'lines.*.qty'                => ['required', 'integer', 'min:1'],
            'lines.*.unit_price'         => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount'           => ['nullable', 'numeric', 'min:0'],
            'lines.*.is_service'         => ['nullable', 'boolean'],
            'lines.*.service_name'       => ['nullable', 'string', 'max:200'],
            'order_discount_amount'      => ['nullable', 'numeric', 'min:0'],
            'is_employee_purchase'       => ['nullable', 'boolean'],
            'points_to_redeem'           => ['nullable', 'integer', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Auto-resolve warehouse_id se non fornito: prende il primo warehouse dello store
        if (! $request->filled('warehouse_id') || (int) $request->integer('warehouse_id') <= 0) {
            $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;
            $autoWarehouse = DB::table('warehouses')
                ->where('tenant_id', $tenantId)
                ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
                ->orderBy('id')
                ->value('id');
            if ($autoWarehouse) {
                $request->merge(['warehouse_id' => $autoWarehouse]);
            } else {
                return response()->json(['message' => 'Nessun magazzino disponibile per questo negozio.'], 422);
            }
        }

        if (! $this->isValidOrderContext($tenantId, $request)) {
            return response()->json(['message' => 'Store, magazzino, cliente o dipendente non validi per il tenant.'], 422);
        }

        $orderDiscount = (float) $request->input('order_discount_amount', 0);
        $quote = $this->buildQuote($tenantId, (array) $request->input('lines'), $orderDiscount);
        $status = (string) ($request->input('status') ?: 'paid');
        $now = now();
        $stockAlerts = [];

        // Points Redemption Pre-processing
        $pointsToRedeem = (int) $request->input('points_to_redeem', 0);
        $pointsDiscount = 0.0;
        if ($pointsToRedeem > 0 && $request->filled('customer_id')) {
            $customerId = (int) $request->input('customer_id');
            $wallet = DB::table('loyalty_wallets')
                ->where('tenant_id', $tenantId)
                ->where('customer_id', $customerId)
                ->first();
            
            if (!$wallet || $wallet->points_balance < $pointsToRedeem) {
                return response()->json(['message' => 'Punti insufficienti nel wallet per il riscatto richiesto.'], 422);
            }

            $pointsDiscount = round($pointsToRedeem * 0.05, 2);
            $quote['totals']['discount_total'] += $pointsDiscount;
            $quote['totals']['grand_total'] = max(0, $quote['totals']['grand_total'] - $pointsDiscount);
        }

        if (($quote['meta']['invalid_lines'] ?? 0) > 0 || count($quote['lines']) === 0) {
            return response()->json(['message' => 'Una o piu righe ordine non sono valide per il tenant.'], 422);
        }

        if ($status === 'paid') {
            $stockAlerts = $this->collectStockAlerts(
                $tenantId,
                (int) $request->integer('warehouse_id'),
                $quote['lines']
            );
        }

        $orderId = DB::transaction(function () use ($request, $tenantId, $quote, $status, $now, $stockAlerts, $pointsToRedeem, $pointsDiscount): int {
            $orderId = DB::table('sales_orders')->insertGetId([
                'tenant_id' => $tenantId,
                'store_id' => $request->input('store_id'),
                'channel' => $request->input('channel'),
                'customer_id' => $request->input('customer_id'),
                'employee_id' => $request->input('employee_id'),
                'sold_by_employee_id' => $request->input('sold_by_employee_id'),
                'status' => $status,
                'currency' => 'EUR',
                'subtotal' => $quote['totals']['subtotal'],
                'discount_total' => $quote['totals']['discount_total'],
                'tax_total' => $quote['totals']['tax_total'],
                'excise_total' => $quote['totals']['excise_total'],
                'grand_total' => $quote['totals']['grand_total'],
                'has_stock_alert' => ! empty($stockAlerts),
                'stock_alert_reason' => ! empty($stockAlerts)
                    ? 'Stock insufficiente su una o piu varianti. Verificare giacenza.'
                    : null,
                'notes' => $request->input('notes'),
                'paid_at' => $status === 'paid' ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if (! empty($stockAlerts)) {
                $alertRows = [];
                foreach ($stockAlerts as $alert) {
                    $alertRows[] = [
                        'tenant_id' => $tenantId,
                        'sales_order_id' => $orderId,
                        'alert_type' => 'insufficient_stock',
                        'details_json' => json_encode($alert),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                DB::table('sales_order_alerts')->insert($alertRows);
            }

            foreach ($quote['lines'] as $line) {
                DB::table('sales_order_lines')->insert([
                    'sales_order_id' => $orderId,
                    'product_variant_id' => $line['product_variant_id'],
                    'qty' => $line['qty'],
                    'unit_price' => $line['unit_price'],
                    'discount_amount' => $line['discount_amount'],
                    'tax_amount' => $line['tax_amount'],
                    'excise_amount' => $line['excise_amount'],
                    'line_total' => $line['line_total'],
                    'tax_snapshot_json' => json_encode($line['tax_snapshot']),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                if ($status === 'paid' && !empty($line['product_variant_id'])) {
                    $stockExists = DB::table('stock_items')
                        ->where('tenant_id', $tenantId)
                        ->where('warehouse_id', (int) $request->input('warehouse_id'))
                        ->where('product_variant_id', (int) $line['product_variant_id'])
                        ->exists();

                    if (! $stockExists) {
                        DB::table('stock_items')->insert([
                            'tenant_id' => $tenantId,
                            'warehouse_id' => (int) $request->input('warehouse_id'),
                            'product_variant_id' => (int) $line['product_variant_id'],
                            'on_hand' => 0,
                            'reserved' => 0,
                            'reorder_point' => 0,
                            'safety_stock' => 0,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }

                    DB::table('stock_items')
                        ->where('tenant_id', $tenantId)
                        ->where('warehouse_id', (int) $request->input('warehouse_id'))
                        ->where('product_variant_id', (int) $line['product_variant_id'])
                        ->update([
                            'on_hand' => DB::raw('on_hand - '.(int) $line['qty']),
                            'updated_at' => $now,
                        ]);

                    DB::table('stock_movements')->insert([
                        'tenant_id' => $tenantId,
                        'warehouse_id' => (int) $request->input('warehouse_id'),
                        'product_variant_id' => (int) $line['product_variant_id'],
                        'movement_type' => 'sale',
                        'qty' => -1 * (int) $line['qty'],
                        'unit_cost' => null,
                        'reference_type' => 'sales_order',
                        'reference_id' => $orderId,
                        'employee_id' => $request->user()->id,
                        'occurred_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            if ($status === 'paid') {
                $requestedPayments = $request->input('payments');
                if (!empty($requestedPayments)) {
                    foreach ($requestedPayments as $p) {
                        DB::table('payments')->insert([
                            'tenant_id' => $tenantId,
                            'sales_order_id' => $orderId,
                            'method' => (string) ($p['method'] ?? 'cash'),
                            'amount' => (float) $p['amount'],
                            'status' => 'paid',
                            'paid_at' => $now,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                } else {
                    DB::table('payments')->insert([
                        'tenant_id' => $tenantId,
                        'sales_order_id' => $orderId,
                        'method' => (string) ($request->input('payment_method') ?: 'cash'),
                        'amount' => $quote['totals']['grand_total'],
                        'status' => 'paid',
                        'paid_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                if ($request->filled('customer_id')) {
                    $customerId = (int) $request->input('customer_id');

                    // Aggiorna statistiche cliente per return analytics
                    DB::table('customers')
                        ->where('tenant_id', $tenantId)
                        ->where('id', $customerId)
                        ->update([
                            'last_purchase_at' => $now,
                            'total_orders' => DB::raw('total_orders + 1'),
                            'total_spent' => DB::raw('total_spent + ' . (float) $quote['totals']['grand_total']),
                            'updated_at' => $now,
                        ]);

                    DB::table('loyalty_wallets')->updateOrInsert(
                        ['tenant_id' => $tenantId, 'customer_id' => $customerId],
                        ['points_balance' => 0, 'tier_code' => 'base', 'created_at' => $now, 'updated_at' => $now]
                    );

                    DB::table('loyalty_wallets')
                        ->where('tenant_id', $tenantId)
                        ->where('customer_id', $customerId)
                        ->update([
                            'points_balance' => DB::raw('points_balance + '.(int) $quote['loyalty']['earned_points']),
                            'updated_at' => $now,
                        ]);

                    $loyaltyLedgerId = DB::table('loyalty_ledger')->insertGetId([
                        'tenant_id' => $tenantId,
                        'customer_id' => $customerId,
                        'order_id' => $orderId,
                        'event_type' => 'earn',
                        'points_delta' => (int) $quote['loyalty']['earned_points'],
                        'monetary_value' => $quote['loyalty']['monetary_value'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    if ($pointsToRedeem > 0) {
                        DB::table('loyalty_wallets')
                            ->where('tenant_id', $tenantId)
                            ->where('customer_id', $customerId)
                            ->update([
                                'points_balance' => DB::raw('points_balance - ' . $pointsToRedeem),
                                'updated_at' => $now,
                            ]);

                        DB::table('loyalty_ledger')->insert([
                            'tenant_id' => $tenantId,
                            'customer_id' => $customerId,
                            'order_id' => $orderId,
                            'event_type' => 'redeem',
                            'points_delta' => -$pointsToRedeem,
                            'monetary_value' => -$pointsDiscount,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }

                    $this->loyaltyPushService->queuePointsEarnedNotification(
                        $tenantId,
                        $customerId,
                        $orderId,
                        (int) $quote['loyalty']['earned_points'],
                        $loyaltyLedgerId,
                    );
                }

                if ($request->filled('employee_id') && !$request->boolean('is_employee_purchase')) {
                    // Logic already exists for standard commissions
                }

                // New logic for points to the seller (Sold By)
                if ($request->filled('sold_by_employee_id')) {
                    $sellerId = (int) $request->input('sold_by_employee_id');
                    $points = (int) $quote['employee']['points']; // Use the same formula for simplicity or adjust as needed

                    DB::table('employee_point_wallets')->updateOrInsert(
                        ['tenant_id' => $tenantId, 'employee_id' => $sellerId],
                        ['points_balance' => 0, 'created_at' => $now, 'updated_at' => $now]
                    );

                    DB::table('employee_point_wallets')
                        ->where('tenant_id', $tenantId)
                        ->where('employee_id', $sellerId)
                        ->update([
                            'points_balance' => DB::raw('points_balance + '.$points),
                            'updated_at' => $now,
                        ]);

                    DB::table('employee_point_ledger')->insert([
                        'tenant_id' => $tenantId,
                        'employee_id' => $sellerId,
                        'source_type' => 'pos_sale',
                        'source_id' => $orderId,
                        'points_delta' => $points,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            return $orderId;
        });

        $pdfUrl = null;
        try {
            $html = "<h1>Ordine Vendita #{$orderId}</h1><p>Totale: EUR " . number_format($quote['totals']['grand_total'], 2) . "</p>";
            $pdfContent = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->output();
            $path = "orders/{$tenantId}/{$orderId}.pdf";
            \Illuminate\Support\Facades\Storage::disk('public')->put($path, $pdfContent);
            $pdfUrl = '/storage/' . $path;
        } catch (\Throwable $e) {}

        AuditLogger::log($request, 'create', 'order', $orderId, 'Ordine #' . $orderId . ' €' . number_format($quote['totals']['grand_total'], 2), null, $pdfUrl);

        return response()->json([
            'message' => 'Ordine creato.',
            'order_id' => $orderId,
            'quote' => $quote,
            'has_stock_alert' => ! empty($stockAlerts),
            'stock_alerts' => $stockAlerts,
        ], 201);
    }

    public function stockAlerts(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'status' => ['nullable', 'in:all,resolved,unresolved'],
            'store_id' => ['nullable', 'integer'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $status = (string) ($request->input('status') ?: 'unresolved');
        $limit = (int) ($request->input('limit') ?: 120);

        $query = DB::table('sales_order_alerts as soa')
            ->join('sales_orders as so', 'so.id', '=', 'soa.sales_order_id')
            ->where('soa.tenant_id', $tenantId)
            ->when($request->filled('store_id'), fn ($q) => $q->where('so.store_id', (int) $request->integer('store_id')))
            ->select([
                'soa.id',
                'soa.sales_order_id',
                'soa.alert_type',
                'soa.details_json',
                'soa.resolved_at',
                'soa.resolved_by',
                'soa.created_at',
                'so.status as order_status',
                'so.grand_total as order_total',
                'so.store_id',
            ])
            ->orderByDesc('soa.created_at');

        if ($status === 'resolved') {
            $query->whereNotNull('soa.resolved_at');
        } elseif ($status === 'unresolved') {
            $query->whereNull('soa.resolved_at');
        }

        $rows = $query->limit($limit)->get();

        $variantIds = [];
        foreach ($rows as $row) {
            $details = json_decode((string) ($row->details_json ?: '{}'), true) ?: [];
            if (! empty($details['product_variant_id'])) {
                $variantIds[] = (int) $details['product_variant_id'];
            }
        }

        $variantIds = array_values(array_unique($variantIds));

        $variantNames = empty($variantIds)
            ? []
            : DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('pv.tenant_id', $tenantId)
                ->whereIn('pv.id', $variantIds)
                ->pluck('p.name', 'pv.id')
                ->map(fn ($name) => (string) $name)
                ->all();

        $data = $rows->map(function ($row) use ($variantNames) {
            $details = json_decode((string) ($row->details_json ?: '{}'), true) ?: [];
            $variantId = (int) ($details['product_variant_id'] ?? 0);

            return [
                'id' => (int) $row->id,
                'sales_order_id' => (int) $row->sales_order_id,
                'alert_type' => (string) $row->alert_type,
                'order_status' => (string) ($row->order_status ?: 'unknown'),
                'order_total' => (float) ($row->order_total ?? 0),
                'store_id' => $row->store_id !== null ? (int) $row->store_id : null,
                'product_variant_id' => $variantId ?: null,
                'product_name' => $variantId ? ($variantNames[$variantId] ?? null) : null,
                'requested_qty' => isset($details['requested_qty']) ? (int) $details['requested_qty'] : null,
                'available_qty' => isset($details['available_qty']) ? (int) $details['available_qty'] : null,
                'shortage_qty' => isset($details['shortage_qty']) ? (int) $details['shortage_qty'] : null,
                'details' => $details,
                'resolved_at' => $row->resolved_at,
                'resolved_by' => $row->resolved_by !== null ? (int) $row->resolved_by : null,
                'created_at' => $row->created_at,
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    public function resolveStockAlert(Request $request, int $alertId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $alert = DB::table('sales_order_alerts')
            ->where('tenant_id', $tenantId)
            ->where('id', $alertId)
            ->first();

        if (! $alert) {
            return response()->json(['message' => 'Alert non trovato.'], 404);
        }

        if ($alert->resolved_at !== null) {
            return response()->json(['message' => 'Alert gia risolto.']);
        }

        $now = now();
        $actorId = (int) $request->user()->id;

        DB::transaction(function () use ($tenantId, $alertId, $alert, $now, $actorId) {
            DB::table('sales_order_alerts')
                ->where('tenant_id', $tenantId)
                ->where('id', $alertId)
                ->update([
                    'resolved_at' => $now,
                    'resolved_by' => $actorId,
                    'updated_at' => $now,
                ]);

            $remaining = DB::table('sales_order_alerts')
                ->where('tenant_id', $tenantId)
                ->where('sales_order_id', (int) $alert->sales_order_id)
                ->whereNull('resolved_at')
                ->count();

            if ($remaining === 0) {
                DB::table('sales_orders')
                    ->where('tenant_id', $tenantId)
                    ->where('id', (int) $alert->sales_order_id)
                    ->update([
                        'has_stock_alert' => false,
                        'stock_alert_reason' => null,
                        'updated_at' => $now,
                    ]);
            }
        });

        AuditLogger::log($request, 'resolve', 'stock_alert', $alertId, 'Alert stock risolto per ordine #' . (int) $alert->sales_order_id);

        return response()->json(['message' => 'Alert risolto con successo.']);
    }

    private function buildQuote(int $tenantId, array $lines, float $globalDiscount = 0.0): array
    {
        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        $exciseTotal = 0.0;
        $marginTotal = 0.0;

        $linePayload = [];
        $invalidLines = 0;

        // First pass: Calculate initial nets to distribute global discount
        $totalInitialNet = 0.0;
        $processedLines = [];

        foreach ($lines as $line) {
            $isService = !empty($line['is_service']);
            $qty = (int) $line['qty'];
            
            if ($isService) {
                $unitPrice = isset($line['unit_price']) ? (float) $line['unit_price'] : 0.0;
                $lineDiscount = isset($line['discount']) ? (float) $line['discount'] : 0.0;
                $lineSubtotal = $qty * $unitPrice;
                $initialLineNet = max(0.0, $lineSubtotal - $lineDiscount);
                $totalInitialNet += $initialLineNet;

                $processedLines[] = [
                    'isService' => true,
                    'variant' => null,
                    'service_name' => $line['service_name'] ?? 'Service',
                    'qty' => $qty,
                    'unitPrice' => $unitPrice,
                    'lineDiscount' => $lineDiscount,
                    'lineSubtotal' => $lineSubtotal,
                    'initialLineNet' => $initialLineNet,
                ];
                continue;
            }

            $variant = DB::table('product_variants as pv')
                ->join('products as p', 'p.id', '=', 'pv.product_id')
                ->where('pv.id', (int) $line['product_variant_id'])
                ->where('pv.tenant_id', $tenantId)
                ->select([
                    'pv.id',
                    'pv.product_id',
                    'pv.sale_price',
                    'pv.cost_price',
                    'pv.tax_class_id',
                    'pv.excise_profile_code',
                    'pv.excise_unit_amount_override',
                    'pv.prevalenza_code',
                    'pv.prevalenza_label',
                    'p.product_type',
                    'p.volume_ml',
                    'p.nicotine_mg',
                ])
                ->first();

            if (! $variant) {
                $invalidLines++;
                continue;
            }

            $unitPrice = isset($line['unit_price']) ? (float) $line['unit_price'] : (float) $variant->sale_price;
            $lineDiscount = isset($line['discount']) ? (float) $line['discount'] : 0.0;
            
            $lineSubtotal = $qty * $unitPrice;
            $initialLineNet = max(0.0, $lineSubtotal - $lineDiscount);
            $totalInitialNet += $initialLineNet;

            $processedLines[] = [
                'isService' => false,
                'variant' => $variant,
                'qty' => $qty,
                'unitPrice' => $unitPrice,
                'lineDiscount' => $lineDiscount,
                'lineSubtotal' => $lineSubtotal,
                'initialLineNet' => $initialLineNet,
            ];
        }

        // Safety cap for global discount
        $globalDiscount = min($globalDiscount, $totalInitialNet);

        // Second pass: distribute global discount and calculate taxes
        foreach ($processedLines as $pl) {
            $qty = $pl['qty'];
            $proportion = $totalInitialNet > 0 ? ($pl['initialLineNet'] / $totalInitialNet) : 0;
            $allocatedGlobalDiscount = $proportion * $globalDiscount;
            
            $totalLineDiscount = $pl['lineDiscount'] + $allocatedGlobalDiscount;
            $lineNet = max(0.0, $pl['lineSubtotal'] - $totalLineDiscount);

            if ($pl['isService']) {
                $taxAmount = round($lineNet * 0.22, 2); // default 22% iva for services
                $exciseAmount = 0.0;
                $lineTotal = round($lineNet + $taxAmount, 2);
                $lineMargin = $lineNet; // 100% margin on services usually
                
                $subtotal += $pl['lineSubtotal'];
                $discountTotal += $totalLineDiscount;
                $taxTotal += $taxAmount;
                $exciseTotal += $exciseAmount;
                $marginTotal += $lineMargin;

                $linePayload[] = [
                    'product_variant_id' => null,
                    'is_service' => true,
                    'service_name' => $pl['service_name'],
                    'qty' => $qty,
                    'unit_price' => round($pl['unitPrice'], 2),
                    'discount_amount' => round($totalLineDiscount, 2),
                    'tax_amount' => $taxAmount,
                    'excise_amount' => $exciseAmount,
                    'line_total' => $lineTotal,
                    'tax_snapshot' => [
                        'vat_rate' => 22,
                        'product_type' => 'service',
                    ],
                ];
                continue;
            }

            $variant = $pl['variant'];

            $vatRate = $this->resolveVatRate($tenantId, $variant->tax_class_id);
            $taxAmount = round($lineNet * ($vatRate / 100), 2);

            $exciseAmount = $this->resolveExcise(
                $tenantId,
                (string) $variant->product_type,
                (int) ($variant->volume_ml ?? 0),
                (int) ($variant->nicotine_mg ?? 0),
                $qty,
                $lineNet,
                isset($variant->excise_unit_amount_override) ? (float) $variant->excise_unit_amount_override : null
            );

            $lineTotal = round($lineNet + $taxAmount + $exciseAmount, 2);
            $lineMargin = round(($pl['unitPrice'] - (float) $variant->cost_price) * $qty, 2);

            $subtotal += $pl['lineSubtotal'];
            $discountTotal += $totalLineDiscount;
            $taxTotal += $taxAmount;
            $exciseTotal += $exciseAmount;
            $marginTotal += $lineMargin;

            $linePayload[] = [
                'product_variant_id' => (int) $variant->id,
                'qty' => $qty,
                'unit_price' => round($pl['unitPrice'], 2),
                'discount_amount' => round($totalLineDiscount, 2),
                'tax_amount' => $taxAmount,
                'excise_amount' => $exciseAmount,
                'line_total' => $lineTotal,
                'tax_snapshot' => [
                    'vat_rate' => $vatRate,
                    'product_type' => (string) $variant->product_type,
                    'excise_profile_code' => $variant->excise_profile_code,
                    'excise_unit_amount_override' => $variant->excise_unit_amount_override !== null ? (float) $variant->excise_unit_amount_override : null,
                    'prevalenza_code' => $variant->prevalenza_code,
                    'prevalenza_label' => $variant->prevalenza_label,
                    'excise_source' => $variant->excise_unit_amount_override !== null ? 'variant_override' : 'rule_set',
                ],
            ];
        }

        $grandTotal = round($subtotal - $discountTotal + $taxTotal + $exciseTotal, 2);

        $earnedLoyaltyPoints = (int) floor($grandTotal / 10);
        $loyaltyMonetary = round($earnedLoyaltyPoints * 0.05, 2);

        $employeeFormula = (string) (DB::table('compensation_rules')
            ->where('active', true)
            ->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })
            ->orderByRaw('tenant_id IS NULL')
            ->orderByDesc('id')
            ->value('formula_expression') ?: 'floor((margin_amount * 0.8 + net_amount * 0.2) / 10)');

        $employeePoints = (int) max(0, floor($this->evaluateFormula($employeeFormula, [
            'margin_amount' => $marginTotal,
            'net_amount' => $subtotal - $discountTotal,
        ])));

        return [
            'lines' => $linePayload,
            'totals' => [
                'subtotal' => round($subtotal, 2),
                'discount_total' => round($discountTotal, 2),
                'tax_total' => round($taxTotal, 2),
                'excise_total' => round($exciseTotal, 2),
                'grand_total' => $grandTotal,
            ],
            'loyalty' => [
                'earned_points' => $earnedLoyaltyPoints,
                'monetary_value' => $loyaltyMonetary,
            ],
            'employee' => [
                'formula' => $employeeFormula,
                'net_amount' => round($subtotal - $discountTotal, 2),
                'margin_amount' => round($marginTotal, 2),
                'points' => $employeePoints,
            ],
            'meta' => [
                'invalid_lines' => $invalidLines,
            ],
        ];
    }

    private function isValidOrderContext(int $tenantId, Request $request): bool
    {
        $warehouseId = (int) $request->integer('warehouse_id');

        if ($warehouseId <= 0) {
            return false;
        }

        $warehouse = DB::table('warehouses')
            ->where('id', $warehouseId)
            ->where('tenant_id', $tenantId)
            ->select(['id', 'store_id'])
            ->first();

        if (! $warehouse) {
            return false;
        }

        if ($request->filled('store_id')) {
            $storeId = (int) $request->integer('store_id');

            $storeExists = DB::table('stores')
                ->where('id', $storeId)
                ->where('tenant_id', $tenantId)
                ->exists();

            if (! $storeExists) {
                return false;
            }

            // Se il warehouse appartiene a uno store specifico, deve coincidere
            // Se warehouse.store_id è null (magazzino centrale), accettiamo qualsiasi store
            if ($warehouse->store_id !== null && (int) $warehouse->store_id !== $storeId) {
                return false;
            }
        }

        if ($request->filled('customer_id') && ! DB::table('customers')
            ->where('id', (int) $request->integer('customer_id'))
            ->where('tenant_id', $tenantId)
            ->exists()) {
            return false;
        }

        // employee_id=0 o mancante: accettato (admin senza record employee)
        $empId = (int) $request->integer('employee_id');
        if ($empId > 0 && ! DB::table('employees')
            ->where('id', $empId)
            ->where('tenant_id', $tenantId)
            ->exists()) {
            return false;
        }

        return true;
    }

    private function collectStockAlerts(int $tenantId, int $warehouseId, array $lines): array
    {
        $alerts = [];

        foreach ($lines as $line) {
            $stock = DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->where('warehouse_id', $warehouseId)
                ->where('product_variant_id', (int) $line['product_variant_id'])
                ->select(['on_hand', 'reserved'])
                ->first();

            $availableQty = (int) (($stock->on_hand ?? 0) - ($stock->reserved ?? 0));

            if ($availableQty < (int) $line['qty']) {
                $requestedQty = (int) $line['qty'];
                $alerts[] = [
                    'product_variant_id' => (int) $line['product_variant_id'],
                    'requested_qty' => $requestedQty,
                    'available_qty' => $availableQty,
                    'shortage_qty' => $requestedQty - $availableQty,
                ];
            }
        }

        return $alerts;
    }

    private function resolveVatRate(int $tenantId, ?int $taxClassId): float
    {
        if (! $taxClassId) {
            return 22.0;
        }

        $now = now()->toDateTimeString();

        $rate = DB::table('tax_rules')
            ->where('tenant_id', $tenantId)
            ->where('tax_class_id', $taxClassId)
            ->where('active', true)
            ->where('valid_from', '<=', $now)
            ->where(function ($q) use ($now) {
                $q->whereNull('valid_to')->orWhere('valid_to', '>=', $now);
            })
            ->orderBy('priority')
            ->value('vat_rate');

        return $rate !== null ? (float) $rate : 22.0;
    }

    // Aliquote fisse accisa italiana (AAMS/ADM)
    private const EXCISE_RATE_NICOTINE_PER_ML = 0.172623;    // liquidi CON nicotina
    private const EXCISE_RATE_NO_NICOTINE_PER_ML = 0.124672;  // liquidi SENZA nicotina

    private function resolveExcise(int $tenantId, string $productType, int $volumeMl, int $nicotineMg, int $qty, float $lineNet, ?float $exciseUnitAmountOverride = null): float
    {
        if ($exciseUnitAmountOverride !== null) {
            return round($qty * $exciseUnitAmountOverride, 2);
        }

        $now = now()->toDateTimeString();

        $rule = DB::table('excise_rules as er')
            ->join('excise_rule_sets as ers', 'ers.id', '=', 'er.rule_set_id')
            ->where('er.active', true)
            ->where('ers.status', 'active')
            ->where('ers.valid_from', '<=', $now)
            ->where(function ($q) use ($now) {
                $q->whereNull('ers.valid_to')->orWhere('ers.valid_to', '>=', $now);
            })
            ->where(function ($q) use ($tenantId) {
                $q->where('ers.tenant_id', $tenantId)->orWhereNull('ers.tenant_id');
            })
            ->where(function ($q) use ($productType) {
                $q->whereNull('er.product_type')->orWhere('er.product_type', $productType);
            })
            ->where(function ($q) use ($nicotineMg) {
                $q->whereNull('er.nicotine_min')
                    ->orWhere(function ($inner) use ($nicotineMg) {
                        $inner->where('er.nicotine_min', '<=', $nicotineMg)
                            ->where(function ($max) use ($nicotineMg) {
                                $max->whereNull('er.nicotine_max')->orWhere('er.nicotine_max', '>=', $nicotineMg);
                            });
                    });
            })
            ->where(function ($q) use ($volumeMl) {
                $q->whereNull('er.volume_min_ml')
                    ->orWhere(function ($inner) use ($volumeMl) {
                        $inner->where('er.volume_min_ml', '<=', $volumeMl)
                            ->where(function ($max) use ($volumeMl) {
                                $max->whereNull('er.volume_max_ml')->orWhere('er.volume_max_ml', '>=', $volumeMl);
                            });
                    });
            })
            ->orderByRaw('ers.tenant_id IS NULL')
            ->orderByDesc('er.id')
            ->select(['er.rate_type', 'er.rate_value', 'er.min_amount'])
            ->first();

        // Se non c'è regola custom, applica le aliquote fisse italiane per i liquidi
        if (! $rule && $volumeMl > 0 && in_array($productType, ['liquido', 'liquid', 'e-liquid', 'eliquid'], true)) {
            $rate = $nicotineMg > 0 ? self::EXCISE_RATE_NICOTINE_PER_ML : self::EXCISE_RATE_NO_NICOTINE_PER_ML;
            return round($qty * $volumeMl * $rate, 2);
        }

        if (! $rule) {
            return 0.0;
        }

        $value = 0.0;
        $rateValue = (float) $rule->rate_value;

        if ($rule->rate_type === 'per_ml') {
            $value = $qty * $volumeMl * $rateValue;
        } elseif ($rule->rate_type === 'per_unit') {
            $value = $qty * $rateValue;
        } elseif ($rule->rate_type === 'percent') {
            $value = $lineNet * ($rateValue / 100);
        }

        $minAmount = (float) ($rule->min_amount ?? 0);
        return round(max($value, $minAmount), 2);
    }

    private function evaluateFormula(string $expression, array $variables): float
    {
        $sanitized = strtolower(trim($expression));

        foreach ($variables as $key => $value) {
            $sanitized = preg_replace('/\\b'.preg_quote(strtolower($key), '/').'\\b/', (string) ((float) $value), $sanitized);
        }

        // Allow only numbers, operators, spaces, parentheses and floor().
        if (preg_match('/[^0-9\+\-\*\/\(\)\.\s,a-z_]/', $sanitized)) {
            return 0.0;
        }

        if (preg_match('/\b(?!floor\b)[a-z_][a-z0-9_]*\b/', $sanitized)) {
            return 0.0;
        }

        return $this->safeMathEval($sanitized);
    }

    private function safeMathEval(string $expression): float
    {
        // Resolve floor(...) recursively first.
        while (preg_match('/floor\s*\(([^()]+)\)/', $expression, $matches)) {
            $inner = $this->safeMathEval($matches[1]);
            $expression = preg_replace('/floor\s*\(([^()]+)\)/', (string) floor($inner), $expression, 1) ?? $expression;
        }

        $tokens = preg_split('/\s+/', trim(preg_replace('/([\+\-\*\/\(\)])/', ' $1 ', $expression) ?? '')) ?: [];
        if ($tokens === []) {
            return 0.0;
        }

        $output = [];
        $ops = [];
        $precedence = ['+' => 1, '-' => 1, '*' => 2, '/' => 2];

        foreach ($tokens as $token) {
            if ($token === '') {
                continue;
            }

            if (is_numeric($token)) {
                $output[] = (float) $token;
                continue;
            }

            if (isset($precedence[$token])) {
                while (! empty($ops)) {
                    $top = end($ops);
                    if (! is_string($top) || ! isset($precedence[$top]) || $precedence[$top] < $precedence[$token]) {
                        break;
                    }
                    $output[] = array_pop($ops);
                }
                $ops[] = $token;
                continue;
            }

            if ($token === '(') {
                $ops[] = $token;
                continue;
            }

            if ($token === ')') {
                while (! empty($ops) && end($ops) !== '(') {
                    $output[] = array_pop($ops);
                }
                if (empty($ops) || array_pop($ops) !== '(') {
                    return 0.0;
                }
                continue;
            }

            return 0.0;
        }

        while (! empty($ops)) {
            $op = array_pop($ops);
            if ($op === '(' || $op === ')') {
                return 0.0;
            }
            $output[] = $op;
        }

        $stack = [];
        foreach ($output as $item) {
            if (is_float($item) || is_int($item)) {
                $stack[] = (float) $item;
                continue;
            }

            if (count($stack) < 2 || ! is_string($item)) {
                return 0.0;
            }

            $b = array_pop($stack);
            $a = array_pop($stack);

            $result = match ($item) {
                '+' => $a + $b,
                '-' => $a - $b,
                '*' => $a * $b,
                '/' => $b == 0.0 ? 0.0 : $a / $b,
                default => 0.0,
            };

            $stack[] = $result;
        }

        return count($stack) === 1 ? (float) $stack[0] : 0.0;
    }

    private function mapOrderListRow(object $row): array
    {
        $empName = trim(($row->employee_first_name ?? '') . ' ' . ($row->employee_last_name ?? ''));
        return [
            'id' => (int) $row->id,
            'status' => (string) $row->status,
            'channel' => (string) ($row->channel ?? 'pos'),
            'store_id' => $row->store_id !== null ? (int) $row->store_id : null,
            'store_name' => $row->store_name ?? null,
            'employee_id' => $row->employee_id !== null ? (int) $row->employee_id : null,
            'sold_by_employee_id' => $row->sold_by_employee_id !== null ? (int) $row->sold_by_employee_id : null,
            'employee_name' => $empName ?: null,
            'customer_id' => $row->customer_id !== null ? (int) $row->customer_id : null,
            'grand_total' => (float) $row->grand_total,
            'total' => (float) $row->grand_total,
            'currency' => (string) ($row->currency ?: 'EUR'),
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
            'loyalty_points_awarded' => (int) $row->loyalty_points_awarded,
            'customer_name' => $row->customer_first_name
                ? trim(($row->customer_first_name ?? '') . ' ' . ($row->customer_last_name ?? ''))
                : null,
            'customer' => ($row->customer_first_name || $row->customer_last_name)
                ? [
                    'first_name' => (string) ($row->customer_first_name ?: ''),
                    'last_name' => (string) ($row->customer_last_name ?: ''),
                ]
                : null,
            'warehouse' => $row->store_id
                ? [
                    'id' => (int) $row->store_id,
                    'name' => (string) ($row->store_name ?? 'Negozio'),
                ]
                : null,
        ];
    }
}
