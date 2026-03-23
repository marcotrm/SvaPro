<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrderController extends Controller
{
    public function quote(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        return response()->json($this->buildQuote($tenantId, (array) $request->input('lines')));
    }

    public function place(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'channel' => ['required', 'in:web,pos'],
            'store_id' => ['nullable', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'employee_id' => ['nullable', 'integer'],
            'warehouse_id' => ['required', 'integer'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:draft,paid'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_variant_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.discount' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (! $this->isValidOrderContext($tenantId, $request)) {
            return response()->json(['message' => 'Store, magazzino, cliente o dipendente non validi per il tenant.'], 422);
        }

        $quote = $this->buildQuote($tenantId, (array) $request->input('lines'));
        $status = (string) ($request->input('status') ?: 'paid');
        $now = now();
        $stockAlerts = [];

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

        $orderId = DB::transaction(function () use ($request, $tenantId, $quote, $status, $now, $stockAlerts): int {
            $orderId = DB::table('sales_orders')->insertGetId([
                'tenant_id' => $tenantId,
                'store_id' => $request->input('store_id'),
                'channel' => $request->input('channel'),
                'customer_id' => $request->input('customer_id'),
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

                if ($status === 'paid') {
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

                if ($request->filled('customer_id')) {
                    $customerId = (int) $request->input('customer_id');
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

                    DB::table('loyalty_ledger')->insert([
                        'tenant_id' => $tenantId,
                        'customer_id' => $customerId,
                        'order_id' => $orderId,
                        'event_type' => 'earn',
                        'points_delta' => (int) $quote['loyalty']['earned_points'],
                        'monetary_value' => $quote['loyalty']['monetary_value'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }

                if ($request->filled('employee_id')) {
                    $employeeId = (int) $request->input('employee_id');
                    $employeePoints = (int) $quote['employee']['points'];

                    DB::table('employee_sales_facts')->insert([
                        'tenant_id' => $tenantId,
                        'employee_id' => $employeeId,
                        'order_id' => $orderId,
                        'net_amount' => $quote['employee']['net_amount'],
                        'margin_amount' => $quote['employee']['margin_amount'],
                        'sold_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    DB::table('employee_point_wallets')->updateOrInsert(
                        ['tenant_id' => $tenantId, 'employee_id' => $employeeId],
                        ['points_balance' => 0, 'created_at' => $now, 'updated_at' => $now]
                    );

                    DB::table('employee_point_wallets')
                        ->where('tenant_id', $tenantId)
                        ->where('employee_id', $employeeId)
                        ->update([
                            'points_balance' => DB::raw('points_balance + '.$employeePoints),
                            'updated_at' => $now,
                        ]);

                    DB::table('employee_point_ledger')->insert([
                        'tenant_id' => $tenantId,
                        'employee_id' => $employeeId,
                        'source_type' => 'sale',
                        'source_id' => $orderId,
                        'points_delta' => $employeePoints,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            return $orderId;
        });

        return response()->json([
            'message' => 'Ordine creato.',
            'order_id' => $orderId,
            'quote' => $quote,
            'has_stock_alert' => ! empty($stockAlerts),
            'stock_alerts' => $stockAlerts,
        ], 201);
    }

    private function buildQuote(int $tenantId, array $lines): array
    {
        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        $exciseTotal = 0.0;
        $marginTotal = 0.0;

        $linePayload = [];
        $invalidLines = 0;

        foreach ($lines as $line) {
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

            $qty = (int) $line['qty'];
            $unitPrice = isset($line['unit_price']) ? (float) $line['unit_price'] : (float) $variant->sale_price;
            $discount = isset($line['discount']) ? (float) $line['discount'] : 0.0;

            $lineSubtotal = $qty * $unitPrice;
            $lineNet = max(0.0, $lineSubtotal - $discount);

            $vatRate = $this->resolveVatRate($tenantId, $variant->tax_class_id);
            $taxAmount = round($lineNet * ($vatRate / 100), 2);

            $exciseAmount = $this->resolveExcise(
                $tenantId,
                (string) $variant->product_type,
                (int) ($variant->volume_ml ?? 0),
                $qty,
                $lineNet,
                isset($variant->excise_unit_amount_override) ? (float) $variant->excise_unit_amount_override : null
            );

            $lineTotal = round($lineNet + $taxAmount + $exciseAmount, 2);
            $lineMargin = round(($unitPrice - (float) $variant->cost_price) * $qty, 2);

            $subtotal += $lineSubtotal;
            $discountTotal += $discount;
            $taxTotal += $taxAmount;
            $exciseTotal += $exciseAmount;
            $marginTotal += $lineMargin;

            $linePayload[] = [
                'product_variant_id' => (int) $variant->id,
                'qty' => $qty,
                'unit_price' => round($unitPrice, 2),
                'discount_amount' => round($discount, 2),
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

            if (! $storeExists || ((int) ($warehouse->store_id ?? 0) !== 0 && (int) $warehouse->store_id !== $storeId)) {
                return false;
            }
        }

        if ($request->filled('customer_id') && ! DB::table('customers')
            ->where('id', (int) $request->integer('customer_id'))
            ->where('tenant_id', $tenantId)
            ->exists()) {
            return false;
        }

        if ($request->filled('employee_id') && ! DB::table('employees')
            ->where('id', (int) $request->integer('employee_id'))
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

    private function resolveExcise(int $tenantId, string $productType, int $volumeMl, int $qty, float $lineNet, ?float $exciseUnitAmountOverride = null): float
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
            ->orderByRaw('ers.tenant_id IS NULL')
            ->orderByDesc('er.id')
            ->select(['er.rate_type', 'er.rate_value', 'er.min_amount'])
            ->first();

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
}
