<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ShippingController extends Controller
{
    public function carriers(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        return response()->json([
            'data' => DB::table('carriers')->where('tenant_id', $tenantId)->orderByDesc('id')->get(),
        ]);
    }

    public function storeCarrier(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:100'],
            'api_type' => ['nullable', 'string', 'max:50'],
            'config' => ['nullable', 'array'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $id = DB::table('carriers')->insertGetId([
            'tenant_id' => $tenantId,
            'name' => $request->input('name'),
            'api_type' => $request->input('api_type'),
            'config_encrypted_json' => $request->filled('config') ? json_encode($request->input('config')) : null,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Corriere creato.', 'carrier_id' => $id], 201);
    }

    public function shipments(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $data = DB::table('shipments as s')
            ->leftJoin('carriers as c', 'c.id', '=', 's.carrier_id')
            ->where('s.tenant_id', $tenantId)
            ->select(['s.*', 'c.name as carrier_name'])
            ->orderByDesc('s.id')
            ->get();

        return response()->json(['data' => $data]);
    }

    public function createShipment(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'sales_order_id' => ['required', 'integer'],
            'carrier_id' => ['nullable', 'integer'],
            'service_code' => ['nullable', 'string', 'max:50'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'packages' => ['nullable', 'array'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $orderExists = DB::table('sales_orders')->where('tenant_id', $tenantId)->where('id', $request->integer('sales_order_id'))->exists();
        if (! $orderExists) {
            return response()->json(['message' => 'Ordine non valido per il tenant.'], 422);
        }

        $shipmentId = DB::table('shipments')->insertGetId([
            'tenant_id' => $tenantId,
            'sales_order_id' => $request->integer('sales_order_id'),
            'carrier_id' => $request->input('carrier_id'),
            'service_code' => $request->input('service_code'),
            'tracking_number' => $request->input('tracking_number'),
            'label_url' => null,
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ((array) $request->input('packages', []) as $package) {
            DB::table('shipment_packages')->insert([
                'shipment_id' => $shipmentId,
                'weight_grams' => (int) ($package['weight_grams'] ?? 0),
                'length_mm' => $package['length_mm'] ?? null,
                'width_mm' => $package['width_mm'] ?? null,
                'height_mm' => $package['height_mm'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Spedizione creata.', 'shipment_id' => $shipmentId], 201);
    }

    public function updateShipmentStatus(Request $request, int $shipmentId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        $validator = Validator::make($request->all(), [
            'status' => ['required', 'string', 'max:50'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $updated = DB::table('shipments')
            ->where('tenant_id', $tenantId)
            ->where('id', $shipmentId)
            ->update([
                'status' => $request->input('status'),
                'tracking_number' => $request->input('tracking_number'),
                'shipped_at' => $request->input('status') === 'shipped' ? now() : DB::raw('shipped_at'),
                'delivered_at' => $request->input('status') === 'delivered' ? now() : DB::raw('delivered_at'),
                'updated_at' => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Spedizione non trovata.'], 404);
        }

        return response()->json(['message' => 'Spedizione aggiornata.']);
    }
}
