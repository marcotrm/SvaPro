<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HealthScanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenantId = (int) $request->attributes->get('tenant_id');
        
        return response()->json([
            'insights' => [
                ...$this->getSupplierPriceHikes($tenantId),
                ...$this->getSlowMovers($tenantId),
                ...$this->getLowMarginAlerts($tenantId),
            ]
        ]);
    }

    private function getSupplierPriceHikes(int $tenantId): array
    {
        // Confronta l'ultimo costo in fattura d'acquisto con il costo attuale nel database varianti
        $hikes = DB::table('purchase_order_lines as pol')
            ->join('purchase_orders as po', 'po.id', '=', 'pol.purchase_order_id')
            ->join('product_variants as pv', 'pv.id', '=', 'pol.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('suppliers as s', 's.id', '=', 'po.supplier_id')
            ->where('po.tenant_id', $tenantId)
            ->where('po.status', 'received')
            ->where('pol.unit_price', '>', 0)
            ->select([
                'p.name as product_name',
                's.name as supplier_name',
                'pol.unit_price as last_purchase_cost',
                'pv.cost_price as current_variant_cost',
                'pv.sale_price'
            ])
            ->whereRaw('pv.cost_price > (pol.unit_price * 1.05)') // incremento > 5%
            ->orderByDesc('po.created_at')
            ->limit(5)
            ->get();

        return $hikes->map(fn($h) => [
            'type' => 'supplier_hike',
            'severity' => 'high',
            'title' => "Aumento Costo: {$h->supplier_name}",
            'message' => "Il costo di '{$h->product_name}' è aumentato del " . round((($h->current_variant_cost / $h->last_purchase_cost) - 1) * 100, 1) . "% rispetto all'ultimo acquisto.",
            'suggestion' => "Valuta un aumento del prezzo di vendita (attuale €{$h->sale_price}) o un nuovo fornitore."
        ])->toArray();
    }

    private function getSlowMovers(int $tenantId): array
    {
        $startDate = now()->subDays(60);

        // Prodotti con stock alto ma vendite quasi nulle negli ultimi 60 giorni
        $slow = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->join('stock_items as si', 'si.product_variant_id', '=', 'pv.id')
            ->leftJoin('sales_order_lines as sol', function($join) use ($startDate) {
                $join->on('sol.product_variant_id', '=', 'pv.id')
                     ->where('sol.created_at', '>=', $startDate);
            })
            ->where('pv.tenant_id', $tenantId)
            ->select([
                'p.name',
                'pv.flavor',
                DB::raw('SUM(DISTINCT si.on_hand) as stock'),
                DB::raw('SUM(sol.qty) as sold_qty')
            ])
            ->groupBy('pv.id', 'p.name', 'pv.flavor')
            ->having('stock', '>', 50)
            ->havingRaw('COALESCE(SUM(sol.qty), 0) < (SUM(DISTINCT si.on_hand) * 0.05)')
            ->limit(5)
            ->get();

        return $slow->map(fn($s) => [
            'type' => 'slow_mover',
            'severity' => 'medium',
            'title' => "Prodotto Lento: {$s->name}",
            'message' => "Hai {$s->stock} unità in stock ma ne hai vendute solo " . ($s->sold_qty ?: 0) . " negli ultimi 60 giorni.",
            'suggestion' => "Crea una promozione 'Fuori Tutto' o un bundle per liberare magazzino."
        ])->toArray();
    }

    private function getLowMarginAlerts(int $tenantId): array
    {
        $low = DB::table('product_variants as pv')
            ->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('pv.tenant_id', $tenantId)
            ->where('pv.cost_price', '>', 0)
            ->where('pv.sale_price', '>', 0)
            ->select([
                'p.name',
                'pv.cost_price',
                'pv.sale_price'
            ])
            ->whereRaw('(pv.sale_price - pv.cost_price) / pv.sale_price < 0.15') // Margine < 15%
            ->limit(5)
            ->get();

        return $low->map(fn($l) => [
            'type' => 'low_margin',
            'severity' => 'warning',
            'title' => "Margine Ridotto: {$l->name}",
            'message' => "Il margine su questo prodotto è inferiore al 15% (€" . round($l->sale_price - $l->cost_price, 2) . ").",
            'suggestion' => "Controlla le accise o rinegozia il prezzo d'acquisto."
        ])->toArray();
    }
}
