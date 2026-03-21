<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LoyaltyController extends Controller
{
    public function showWallet(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $wallet = DB::table('loyalty_wallets as lw')
            ->join('customers as c', 'c.id', '=', 'lw.customer_id')
            ->leftJoin('loyalty_cards as lc', 'lc.customer_id', '=', 'c.id')
            ->where('lw.tenant_id', $tenantId)
            ->where('lw.customer_id', $customerId)
            ->select([
                'lw.customer_id',
                'lw.points_balance',
                'lw.tier_code',
                'c.first_name',
                'c.last_name',
                'c.email',
                'lc.card_code',
                'lc.status as card_status',
            ])
            ->first();

        if (! $wallet) {
            return response()->json(['message' => 'Wallet loyalty non trovato.'], 404);
        }

        $ledger = DB::table('loyalty_ledger')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        return response()->json([
            'wallet' => $wallet,
            'ledger' => $ledger,
        ]);
    }

    public function redeemPreview(Request $request, int $customerId): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');

        $validator = Validator::make($request->all(), [
            'points' => ['required', 'integer', 'min:1'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $wallet = DB::table('loyalty_wallets')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->first();

        if (! $wallet) {
            return response()->json(['message' => 'Wallet loyalty non trovato.'], 404);
        }

        $requestedPoints = (int) $request->integer('points');
        $currentBalance = (int) $wallet->points_balance;

        if ($requestedPoints > $currentBalance) {
            return response()->json(['message' => 'Punti insufficienti per il riscatto.'], 422);
        }

        $monetaryValue = round($requestedPoints * 0.05, 2);

        return response()->json([
            'customer_id' => $customerId,
            'requested_points' => $requestedPoints,
            'current_balance' => $currentBalance,
            'remaining_balance' => $currentBalance - $requestedPoints,
            'monetary_value' => $monetaryValue,
        ]);
    }
}
