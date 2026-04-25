<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * PATCH /api/v1/products/bulk-update
 *
 * Aggiornamento massivo parziale dei prodotti tramite array JSON già parsato.
 * La chiave di match è lo SKU. Solo i campi presenti nel payload vengono
 * aggiornati — gli altri rimangono invariati (no sovrascrittura con NULL).
 *
 * Sicurezza (Agente Ispettore):
 * - Whitelist esplicita dei campi accettati: nessuna colonna arbitraria.
 * - Tutti i valori numerici sono castati server-side.
 * - Il tenant_id è sempre iniettato dal middleware (non dal client).
 * - category_name è risolto a category_id server-side per evitare injection.
 * - Transazione ACID sull'intero batch.
 */
class ProductBulkUpdateController extends Controller
{
    /** Campi aggiornabili sulla tabella `products` (whitelist) */
    private const PRODUCT_FIELDS = [
        'barcode', 'fiscal_group', 'excise_tax', 'prevalence',
        'min_stock_qty', 'pli_code', 'denominazione_prodotto',
    ];

    /** Campi aggiornabili sulla tabella `product_variants` (whitelist) */
    private const VARIANT_FIELDS = [
        'cost_price', 'sale_price', 'price_list_2', 'price_list_3',
        'barcode', 'flavor', 'nicotine_strength', 'volume_ml',
    ];

    public function __invoke(Request $request): JsonResponse
    {
        set_time_limit(1800); // 30 minuti per l'aggiornamento massivo
        
        $tenantId = (int) $request->attributes->get('tenant_id');

        // ── Validazione struttura payload ───────────────────────────────────
        $validator = Validator::make($request->all(), [
            'rows'              => ['required', 'array', 'min:1', 'max:5000'],
            'rows.*.sku'        => ['required', 'string', 'max:100'],
            // Campi prodotto
            'rows.*.barcode'            => ['nullable', 'string', 'max:100'],
            'rows.*.fiscal_group'       => ['nullable', 'string', 'max:50'],
            'rows.*.excise_tax'         => ['nullable', 'numeric', 'min:0'],
            'rows.*.prevalence'         => ['nullable', 'string', 'max:100'],
            'rows.*.min_stock_qty'      => ['nullable', 'integer', 'min:0'],
            'rows.*.pli_code'           => ['nullable', 'string', 'max:50'],
            'rows.*.denominazione_prodotto' => ['nullable', 'string', 'max:255'],
            // Risoluzione categoria per nome
            'rows.*.category_name'      => ['nullable', 'string', 'max:120'],
            // Campi variante
            'rows.*.cost_price'         => ['nullable', 'numeric', 'min:0'],
            'rows.*.sale_price'         => ['nullable', 'numeric', 'min:0'],
            'rows.*.price_list_2'       => ['nullable', 'numeric', 'min:0'],
            'rows.*.price_list_3'       => ['nullable', 'numeric', 'min:0'],
            'rows.*.flavor'             => ['nullable', 'string', 'max:120'],
            'rows.*.nicotine_strength'  => ['nullable', 'numeric', 'min:0'],
            'rows.*.volume_ml'          => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $rows = $request->input('rows');

        // Pre-carica la mappa SKU → product_id per questo tenant
        $skus = collect($rows)->pluck('sku')->map(fn ($s) => strtolower(trim($s)))->unique()->values()->all();

        $productMap = DB::table('products')
            ->where('tenant_id', $tenantId)
            ->whereIn(DB::raw('LOWER(sku)'), $skus)
            ->select(['id', 'sku'])
            ->get()
            ->keyBy(fn ($p) => strtolower(trim($p->sku)));

        // Pre-carica mappa categoria_name → category_id per questo tenant
        $categoryNames = collect($rows)
            ->pluck('category_name')
            ->filter()
            ->map(fn ($n) => strtolower(trim($n)))
            ->unique()
            ->values()
            ->all();

        $categoryMap = $categoryNames
            ? DB::table('categories')
                ->where('tenant_id', $tenantId)
                ->whereIn(DB::raw('LOWER(name)'), $categoryNames)
                ->select(['id', 'name'])
                ->get()
                ->keyBy(fn ($c) => strtolower(trim($c->name)))
            : collect();

        $updated  = 0;
        $skipped  = 0;
        $errors   = [];
        $now      = now();

        DB::transaction(function () use (
            $rows, $tenantId, $productMap, $categoryMap,
            $now, &$updated, &$skipped, &$errors
        ) {
            foreach ($rows as $row) {
                $skuKey  = strtolower(trim($row['sku'] ?? ''));
                $product = $productMap->get($skuKey);

                if (! $product) {
                    $errors[] = ['sku' => $row['sku'], 'reason' => 'SKU non trovato'];
                    $skipped++;
                    continue;
                }

                $productId = (int) $product->id;

                // ── Aggiornamento parziale `products` ──────────────────────
                $productPatch = [];

                foreach (self::PRODUCT_FIELDS as $field) {
                    if (array_key_exists($field, $row) && $row[$field] !== null && $row[$field] !== '') {
                        $productPatch[$field] = $this->castProductField($field, $row[$field]);
                    }
                }

                // Risoluzione categoria per nome (server-side, non per ID diretto)
                if (!empty($row['category_name'])) {
                    $catKey = strtolower(trim($row['category_name']));
                    $cat    = $categoryMap->get($catKey);
                    if ($cat) {
                        $productPatch['category_id'] = (int) $cat->id;
                    }
                    // Se non trovata, non aggiorniamo category_id (skip silenzioso)
                }

                if (!empty($productPatch)) {
                    $productPatch['updated_at'] = $now;
                    DB::table('products')
                        ->where('tenant_id', $tenantId)
                        ->where('id', $productId)
                        ->update($productPatch);
                }

                // ── Aggiornamento parziale `product_variants` (prima variante) ──
                $variantPatch = [];

                foreach (self::VARIANT_FIELDS as $field) {
                    if (array_key_exists($field, $row) && $row[$field] !== null && $row[$field] !== '') {
                        $variantPatch[$field] = $this->castVariantField($field, $row[$field]);
                    }
                }

                if (!empty($variantPatch)) {
                    $variantPatch['updated_at'] = $now;
                    // Aggiorna tutte le varianti del prodotto (normalmente 1 per i liquidi)
                    DB::table('product_variants')
                        ->where('tenant_id', $tenantId)
                        ->where('product_id', $productId)
                        ->update($variantPatch);
                }

                $updated++;
            }
        });

        AuditLogger::log(
            $request,
            'bulk_update',
            'product',
            0,
            "CSV bulk update: {$updated} prodotti aggiornati, {$skipped} saltati"
        );

        return response()->json([
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ]);
    }

    /** Cast sicuro per campi prodotto (whitelist). */
    private function castProductField(string $field, mixed $value): mixed
    {
        return match ($field) {
            'excise_tax'    => round((float) $value, 6),
            'min_stock_qty' => max(0, (int) $value),
            default         => (string) $value,
        };
    }

    /** Cast sicuro per campi variante (whitelist). */
    private function castVariantField(string $field, mixed $value): mixed
    {
        return match ($field) {
            'cost_price', 'sale_price',
            'price_list_2', 'price_list_3',
            'nicotine_strength', 'volume_ml' => round((float) $value, 4),
            default                           => (string) $value,
        };
    }
}
