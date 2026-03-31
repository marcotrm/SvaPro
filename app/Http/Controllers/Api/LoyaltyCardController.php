<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoyaltyCardController extends Controller
{
    public function show($uuid)
    {
        $customer = DB::table('customers')
            ->where('uuid', $uuid)
            ->first();

        if (!$customer) {
            return response()->json(['message' => 'Cliente non trovato'], 404);
        }

        $wallet = DB::table('loyalty_wallets')
            ->where('customer_id', $customer->id)
            ->first();

        $history = DB::table('loyalty_ledger')
            ->where('customer_id', $customer->id)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'customer' => [
                'first_name' => $customer->first_name,
                'last_name' => $customer->last_name,
                'code' => $customer->code,
            ],
            'wallet' => [
                'points_balance' => $wallet ? $wallet->points_balance : 0,
                'tier_code' => $wallet ? $wallet->tier_code : 'base',
            ],
            'history' => $history
        ]);
    }
}
