<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PromotionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $status = $request->input('status'); // active, inactive, expired, all

        $query = DB::table('promotions')
            ->where('tenant_id', $tenantId);

        if ($status === 'active') {
            $query->where('active', true)
                ->where(function ($q) {
                    $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
                });
        } elseif ($status === 'inactive') {
            $query->where('active', false);
        } elseif ($status === 'expired') {
            $query->where('ends_at', '<', now());
        }

        $promotions = $query->orderByDesc('id')->get();

        return response()->json(['data' => $promotions]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $promotion = DB::table('promotions')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (! $promotion) {
            return response()->json(['message' => 'Promozione non trovata.'], 404);
        }

        $products = DB::table('promotion_products as pp')
            ->leftJoin('products as p', 'p.id', '=', 'pp.product_id')
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'pp.variant_id')
            ->where('pp.promotion_id', $id)
            ->select(['pp.*', 'p.name as product_name', 'p.sku as product_sku', 'pv.flavor as variant_flavor'])
            ->get();

        return response()->json([
            'data' => $promotion,
            'products' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'type' => ['required', 'in:percentage,fixed,buy_x_get_y,bundle'],
            'value' => ['required', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'products' => ['nullable', 'array'],
            'products.*.product_id' => ['nullable', 'integer'],
            'products.*.variant_id' => ['nullable', 'integer'],
            'products.*.bundle_qty' => ['nullable', 'integer', 'min:1'],
            'products.*.bundle_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if ($request->filled('code')) {
            $exists = DB::table('promotions')
                ->where('tenant_id', $tenantId)
                ->where('code', $request->input('code'))
                ->exists();

            if ($exists) {
                return response()->json(['message' => 'Codice promozione già utilizzato.'], 422);
            }
        }

        $promoId = DB::table('promotions')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => $request->input('name'),
            'code' => $request->input('code'),
            'type' => $request->input('type'),
            'value' => $request->input('value'),
            'min_order_amount' => $request->input('min_order_amount'),
            'max_uses' => $request->input('max_uses'),
            'starts_at' => $request->input('starts_at'),
            'ends_at' => $request->input('ends_at'),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ((array) $request->input('products', []) as $product) {
            DB::table('promotion_products')->insert([
                'promotion_id' => $promoId,
                'product_id' => $product['product_id'] ?? null,
                'variant_id' => $product['variant_id'] ?? null,
                'bundle_qty' => $product['bundle_qty'] ?? null,
                'bundle_price' => $product['bundle_price'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        AuditLogger::log($request, 'create', 'promotion', $promoId, $request->input('name'));

        return response()->json(['message' => 'Promozione creata.', 'id' => $promoId], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:50'],
            'type' => ['required', 'in:percentage,fixed,buy_x_get_y,bundle'],
            'value' => ['required', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $updated = DB::table('promotions')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->update([
                'name' => $request->input('name'),
                'code' => $request->input('code'),
                'type' => $request->input('type'),
                'value' => $request->input('value'),
                'min_order_amount' => $request->input('min_order_amount'),
                'max_uses' => $request->input('max_uses'),
                'starts_at' => $request->input('starts_at'),
                'ends_at' => $request->input('ends_at'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Promozione non trovata.'], 404);
        }

        AuditLogger::log($request, 'update', 'promotion', $id, $request->input('name'));

        return response()->json(['message' => 'Promozione aggiornata.']);
    }

    public function toggleActive(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $promo = DB::table('promotions')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (! $promo) {
            return response()->json(['message' => 'Promozione non trovata.'], 404);
        }

        DB::table('promotions')
            ->where('id', $id)
            ->update([
                'active' => ! $promo->active,
                'updated_at' => now(),
            ]);

        $newState = $promo->active ? 'disattivata' : 'attivata';
        AuditLogger::log($request, 'toggle', 'promotion', $id, $promo->name . " ({$newState})");

        return response()->json(['message' => "Promozione {$newState}.", 'active' => ! $promo->active]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $promo = DB::table('promotions')
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->first();

        if (! $promo) {
            return response()->json(['message' => 'Promozione non trovata.'], 404);
        }

        DB::table('promotions')->where('id', $id)->delete();

        AuditLogger::log($request, 'delete', 'promotion', $id, $promo->name);

        return response()->json(['message' => 'Promozione eliminata.']);
    }

    /**
     * POST /promotions/validate-code
     * Valida un codice promozionale inserito nel POS.
     * Corpo: { code: string, cart_total: float }
     */
    public function validateCode(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'code'       => ['required', 'string'],
            'cart_total' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Dati non validi.'], 422);
        }

        $code      = trim($request->input('code'));
        $cartTotal = (float) $request->input('cart_total');

        $promo = DB::table('promotions')
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(code) = ?', [strtolower($code)])
            ->first();

        if (! $promo) {
            return response()->json(['message' => 'Codice promozionale non valido.'], 404);
        }

        if (! $promo->active) {
            return response()->json(['message' => 'Questo codice promozionale non è attivo.'], 422);
        }

        if ($promo->starts_at && now()->lt($promo->starts_at)) {
            return response()->json(['message' => 'Questo codice non è ancora valido.'], 422);
        }

        if ($promo->ends_at && now()->gt($promo->ends_at)) {
            return response()->json(['message' => 'Questo codice è scaduto.'], 422);
        }

        if ($promo->min_order_amount && $cartTotal < (float) $promo->min_order_amount) {
            return response()->json([
                'message' => "Importo minimo richiesto: €" . number_format($promo->min_order_amount, 2, ',', '.'),
            ], 422);
        }

        if ($promo->max_uses) {
            $used = DB::table('sales_orders')
                ->where('tenant_id', $tenantId)
                ->where('promotion_id', $promo->id)
                ->count();
            if ($used >= $promo->max_uses) {
                return response()->json(['message' => 'Questo codice ha raggiunto il numero massimo di utilizzi.'], 422);
            }
        }

        // Calcola lo sconto
        $discount = 0;
        if ($promo->type === 'percentage') {
            $discount = round($cartTotal * ((float) $promo->value / 100), 2);
        } elseif ($promo->type === 'fixed') {
            $discount = min((float) $promo->value, $cartTotal);
        }

        return response()->json([
            'valid'           => true,
            'promotion'       => $promo,
            'discount_amount' => $discount,
            'message'         => "Codice applicato: {$promo->name}" . ($discount > 0 ? " (-€" . number_format($discount, 2, ',', '.') . ")" : ''),
        ]);
    }
}
