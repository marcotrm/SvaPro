<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WooCommerceSyncService
{
    /**
     * Sincronizza i prodotti da Laravel a WooCommerce o viceversa.
     */
    public function syncProductsForTenant(int $tenantId): void
    {
        $credentials = $this->getTenantCredentials($tenantId);
        if (!$credentials) {
            Log::warning("WooCommerce credentials not configured for tenant {$tenantId}");
            return;
        }

        // Recupera prodotti e varianti
        $products = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->get();

        $client = Http::withBasicAuth($credentials['key'], $credentials['secret'])
            ->baseUrl(rtrim($credentials['url'], '/') . '/wp-json/wc/v3/');

        foreach ($products as $product) {
            $variants = DB::table('product_variants')
                ->where('product_id', $product->id)
                ->get();

            $wooPayload = [
                'name' => $product->name,
                'type' => count($variants) > 1 ? 'variable' : 'simple',
                'sku' => count($variants) === 1 ? $product->sku : $product->sku . '-VAR',
                'images' => $product->image_url ? [['src' => url($product->image_url)]] : [],
            ];

            // Aggiungi prezzo base se semplice
            if (count($variants) === 1) {
                $variant = $variants->first();
                $wooPayload['regular_price'] = (string) $variant->sale_price;
                $wooPayload['manage_stock'] = true;
                // Qui servirebbe una logica per sommare on_hand di tutti i magazzini o centralizzato
                $totalStock = DB::table('stock_items')
                    ->where('product_variant_id', $variant->id)
                    ->sum('on_hand');
                $wooPayload['stock_quantity'] = (int) $totalStock;
            }

            try {
                // Pseudo logic: supponiamo che $product->woo_id sia mappato o lo cerchiamo per SKU
                // Se volessimo mappare woo_id, dovremmo aggiungere un campo a db. Per ora lo cerchiamo per sku.
                $response = $client->get('products', ['sku' => $wooPayload['sku']]);
                $existing = $response->json();

                if (!empty($existing) && is_array($existing) && count($existing) > 0) {
                    // Update
                    $wooId = $existing[0]['id'];
                    $client->put("products/{$wooId}", $wooPayload);
                    Log::info("Updated Woo Product {$wooId} for SvaPro Product {$product->id}");
                } else {
                    // Create
                    $res = $client->post('products', $wooPayload);
                    Log::info("Created Woo Product for SvaPro Product {$product->id}", ['response' => $res->json()]);
                }
            } catch (\Exception $e) {
                Log::error("Failed to sync SvaPro Product {$product->id} to WooCommerce: " . $e->getMessage());
            }
        }
    }

    private function getTenantCredentials(int $tenantId): ?array
    {
        $settings = DB::table('tenant_settings')
            ->where('tenant_id', $tenantId)
            ->whereIn('setting_key', [
                'woocommerce_api_url',
                'woocommerce_consumer_key',
                'woocommerce_consumer_secret'
            ])
            ->pluck('setting_value', 'setting_key');

        if (
            !isset($settings['woocommerce_api_url']) || 
            !isset($settings['woocommerce_consumer_key']) || 
            !isset($settings['woocommerce_consumer_secret']) ||
            trim($settings['woocommerce_api_url']) === ''
        ) {
            return null;
        }

        return [
            'url' => $settings['woocommerce_api_url'],
            'key' => $settings['woocommerce_consumer_key'],
            'secret' => $settings['woocommerce_consumer_secret'],
        ];
    }
}
