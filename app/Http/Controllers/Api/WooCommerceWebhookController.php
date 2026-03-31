<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WooCommerceWebhookController extends Controller
{
    /**
     * Gestisce l'aggiornamento dei punti fedeltà da un ordine WooCommerce.
     * Si aspetta un webhook da WooCommerce (es. Topic: order.updated o order.paid)
     */
    public function handleOrder(Request $request)
    {
        $order = $request->all();
        $status = $order['status'] ?? '';
        $email = $order['billing']['email'] ?? null;
        $total = (float) ($order['total'] ?? 0);
        $orderId = $order['id'] ?? 'external';

        Log::info("WooCommerce Webhook received for order {$orderId}", ['status' => $status, 'email' => $email]);

        // Consideriamo l'ordine "valido" per i punti se è in stato 'processing', 'completed' o 'paid'
        if (in_array($status, ['processing', 'completed', 'paid'])) {
            if (!$email) {
                return response()->json(['message' => 'Email mancante'], 400);
            }

            // Trova il cliente per email
            $customer = DB::table('customers')->where('email', $email)->first();

            if ($customer) {
                $tenantId = $customer->tenant_id;
                $pointsEarned = floor($total); // 1 punto per ogni 1€ speso

                if ($pointsEarned > 0) {
                    DB::transaction(function () use ($tenantId, $customer, $orderId, $pointsEarned) {
                        // Assicura l'esistenza del wallet
                        DB::table('loyalty_wallets')->updateOrInsert(
                            ['tenant_id' => $tenantId, 'customer_id' => $customer->id],
                            ['updated_at' => now()]
                        );

                        // Incrementa punti
                        DB::table('loyalty_wallets')
                            ->where('customer_id', $customer->id)
                            ->increment('points_balance', $pointsEarned, ['updated_at' => now()]);

                        // Registra nel ledger
                        DB::table('loyalty_ledger')->insert([
                            'tenant_id' => $tenantId,
                            'customer_id' => $customer->id,
                            'order_id' => null, // O un riferimento a woo_order_id se avessimo la colonna
                            'event_type' => 'earn',
                            'points_delta' => $pointsEarned,
                            'description' => "Ordine WooCommerce #{$orderId}",
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    });

                    Log::info("Points updated for customer {$customer->id} via WooCommerce order {$orderId}");
                }
            } else {
                Log::warning("Customer with email {$email} not found for WooCommerce order {$orderId}");
            }
        }

        return response()->json(['success' => true]);
    }
}
