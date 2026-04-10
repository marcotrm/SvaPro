<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $rows = DB::table('stock_items as si')
            ->join('warehouses as w', 'w.id', '=', 'si.warehouse_id')
            ->join('product_variants as pv', 'pv.id', '=', 'si.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('si.tenant_id', $tenantId)
            ->when($storeId !== null, fn ($query) => $query->where('w.store_id', $storeId))
            ->select([
                'si.id',
                'si.warehouse_id',
                'w.name as warehouse_name',
                'si.product_variant_id',
                'pv.barcode',
                'pv.sku as variant_sku',
                'p.sku',
                'p.name as product_name',
                'pv.flavor',
                'pv.sale_price',
                'pv.cost_price',
                'si.on_hand',
                'si.reserved',
                'si.reorder_point',
                'si.safety_stock',
                DB::raw('(si.on_hand - si.reserved) as available'),
            ])
            ->orderBy('p.name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function movements(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'warehouse_id' => ['nullable', 'integer'],
            'product_variant_id' => ['nullable', 'integer'],
            'movement_type' => ['nullable', 'string', 'max:40'],
            'q' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $storeId = $request->filled('store_id') ? (int) $request->integer('store_id') : null;

        if ($storeId !== null && ! DB::table('stores')->where('tenant_id', $tenantId)->where('id', $storeId)->exists()) {
            return response()->json(['message' => 'Store non valido per il tenant.'], 422);
        }

        $rows = DB::table('stock_movements as sm')
            ->join('warehouses as w', 'w.id', '=', 'sm.warehouse_id')
            ->join('product_variants as pv', 'pv.id', '=', 'sm.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->leftJoin('users as u', 'u.id', '=', 'sm.employee_id')
            ->where('sm.tenant_id', $tenantId)
            ->when($storeId !== null, fn ($query) => $query->where('w.store_id', $storeId))
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('sm.warehouse_id', (int) $request->integer('warehouse_id')))
            ->when($request->filled('product_variant_id'), fn ($query) => $query->where('sm.product_variant_id', (int) $request->integer('product_variant_id')))
            ->when($request->filled('movement_type'), fn ($query) => $query->where('sm.movement_type', (string) $request->input('movement_type')))
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = trim((string) $request->input('q'));
                $query->where(function ($inner) use ($term) {
                    $inner->where('p.name', 'like', '%'.$term.'%')
                        ->orWhere('p.sku', 'like', '%'.$term.'%')
                        ->orWhere('pv.flavor', 'like', '%'.$term.'%')
                        ->orWhere('sm.movement_type', 'like', '%'.$term.'%');
                });
            })
            ->when($request->filled('date_from'), fn ($query) => $query->where('sm.occurred_at', '>=', $request->input('date_from').' 00:00:00'))
            ->when($request->filled('date_to'), fn ($query) => $query->where('sm.occurred_at', '<=', $request->input('date_to').' 23:59:59'))
            ->select([
                'sm.id',
                'sm.warehouse_id',
                'w.name as warehouse_name',
                'sm.product_variant_id',
                'p.sku',
                'p.name as product_name',
                'pv.flavor',
                'sm.movement_type',
                'sm.qty',
                'sm.unit_cost',
                'sm.reference_type',
                'sm.reference_id',
                'sm.occurred_at',
                'u.name as actor_name',
            ])
            ->orderByDesc('sm.occurred_at')
            ->orderByDesc('sm.id')
            ->limit((int) $request->input('limit', 80))
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function adjust(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'warehouse_id' => ['required', 'integer'],
            'product_variant_id' => ['required', 'integer'],
            'qty' => ['required', 'integer', 'not_in:0'],
            'movement_type' => ['required', 'string', 'max:40'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'reference_type' => ['nullable', 'string', 'max:100'],
            'reference_id' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $warehouseExists = DB::table('warehouses')
            ->where('id', $request->integer('warehouse_id'))
            ->where('tenant_id', $tenantId)
            ->exists();

        $variantExists = DB::table('product_variants')
            ->where('id', $request->integer('product_variant_id'))
            ->where('tenant_id', $tenantId)
            ->exists();

        if (! $warehouseExists || ! $variantExists) {
            return response()->json(['message' => 'Magazzino o variante non validi per il tenant.'], 404);
        }

        $now = now();

        DB::transaction(function () use ($request, $tenantId, $now): void {
            $stockExists = DB::table('stock_items')
                ->where('tenant_id', $tenantId)
                ->where('warehouse_id', $request->integer('warehouse_id'))
                ->where('product_variant_id', $request->integer('product_variant_id'))
                ->exists();

            if (! $stockExists) {
                DB::table('stock_items')->insert([
                    'tenant_id' => $tenantId,
                    'warehouse_id' => $request->integer('warehouse_id'),
                    'product_variant_id' => $request->integer('product_variant_id'),
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
                ->where('warehouse_id', $request->integer('warehouse_id'))
                ->where('product_variant_id', $request->integer('product_variant_id'))
                ->update([
                    'on_hand' => DB::raw('on_hand + '.(int) $request->integer('qty')),
                    'updated_at' => $now,
                ]);

            DB::table('stock_movements')->insert([
                'tenant_id' => $tenantId,
                'warehouse_id' => $request->integer('warehouse_id'),
                'product_variant_id' => $request->integer('product_variant_id'),
                'movement_type' => (string) $request->input('movement_type'),
                'qty' => (int) $request->integer('qty'),
                'unit_cost' => $request->input('unit_cost'),
                'reference_type' => $request->input('reference_type'),
                'reference_id' => $request->input('reference_id'),
                'employee_id' => $request->user()->id,
                'occurred_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        AuditLogger::log($request, 'adjust', 'inventory', $request->integer('product_variant_id'), 'Mov. ' . $request->input('movement_type') . ' qty:' . $request->integer('qty'));

        return response()->json(['message' => 'Movimento registrato.']);
    }
}
