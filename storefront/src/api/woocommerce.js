/**
 * ─── WooCommerce REST API Client ──────────────────────────────────────────────
 * Connette il Storefront Headless a WooCommerce via REST API v3.
 *
 * Per configurare: crea un file .env.local nella cartella storefront/ con:
 *   VITE_WC_URL=https://tuosito.it
 *   VITE_WC_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxx
 *   VITE_WC_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxx
 */

const WC_BASE = import.meta.env.VITE_WC_URL
  ? `${import.meta.env.VITE_WC_URL}/wp-json/wc/v3`
  : null;

const WC_KEY = import.meta.env.VITE_WC_KEY || '';
const WC_SECRET = import.meta.env.VITE_WC_SECRET || '';

// Genera le query params di autenticazione (Basic Auth via Consumer Key/Secret)
const authParams = WC_KEY && WC_SECRET
  ? `consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`
  : '';

/**
 * Richiesta generica all'API WooCommerce
 */
async function wcFetch(endpoint, params = {}) {
  if (!WC_BASE) {
    console.warn('[WooCommerce] URL negozio non configurato. Imposta VITE_WC_URL nel .env.local');
    return null;
  }

  const queryString = new URLSearchParams({ ...params, consumer_key: WC_KEY, consumer_secret: WC_SECRET }).toString();
  const url = `${WC_BASE}/${endpoint}?${queryString}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WooCommerce API error: ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error('[WooCommerce]', err.message);
    return null;
  }
}

// ─── Prodotti ────────────────────────────────────────────────────────────────

/** Recupera lista prodotti con filtri opzionali */
export async function getProducts(params = {}) {
  const defaultParams = { per_page: 24, status: 'publish', ...params };
  return await wcFetch('products', defaultParams);
}

/** Recupera un singolo prodotto per ID */
export async function getProduct(id) {
  if (!WC_BASE) return null;
  const queryString = new URLSearchParams({ consumer_key: WC_KEY, consumer_secret: WC_SECRET }).toString();
  const url = `${WC_BASE}/products/${id}?${queryString}`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error('[WooCommerce]', err.message);
    return null;
  }
}

/** Cerca prodotti per nome/SKU */
export async function searchProducts(query) {
  return await wcFetch('products', { search: query, per_page: 20, status: 'publish' });
}

/** Recupera i prodotti in primo piano (featured) */
export async function getFeaturedProducts() {
  return await wcFetch('products', { featured: true, per_page: 8, status: 'publish' });
}

// ─── Categorie ───────────────────────────────────────────────────────────────

/** Recupera tutte le categorie */
export async function getCategories(params = {}) {
  const defaultParams = { per_page: 50, hide_empty: true, ...params };
  return await wcFetch('products/categories', defaultParams);
}

// ─── Prodotti per Categoria ──────────────────────────────────────────────────

/** Recupera prodotti filtrati per categoria */
export async function getProductsByCategory(categoryId, params = {}) {
  return await wcFetch('products', { category: categoryId, per_page: 24, status: 'publish', ...params });
}

// ─── Ordini ──────────────────────────────────────────────────────────────────

/**
 * Crea un nuovo ordine WooCommerce dal carrello
 * @param {Object} orderData - { billing, shipping, line_items, payment_method, ... }
 */
export async function createOrder(orderData) {
  if (!WC_BASE) return null;
  const url = `${WC_BASE}/orders?consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    return await res.json();
  } catch (err) {
    console.error('[WooCommerce] createOrder failed:', err.message);
    return null;
  }
}

// ─── Mock data per sviluppo senza WooCommerce attivo ─────────────────────────

export const MOCK_PRODUCTS = [
  {
    id: 1,
    name: 'Liquido Premium Mango Ice',
    price: '8.90',
    regular_price: '8.90',
    short_description: 'Gusto tropicale con freschezza mentolata – 50ml Shortfill',
    images: [{ src: 'https://images.unsplash.com/photo-1574871864461-b2a2a5a0ac2b?w=400', alt: 'Mango Ice' }],
    categories: [{ id: 1, name: 'Liquidi' }],
    attributes: [{ name: 'Nicotina', options: ['0mg', '3mg', '6mg', '12mg'] }],
    stock_status: 'instock',
    slug: 'liquido-mango-ice',
  },
  {
    id: 2,
    name: 'Pod Mod Ultra Slim',
    price: '24.90',
    regular_price: '34.90',
    short_description: 'Dispositivo pod ultraleggero da 1000mAh – ricarica USB-C',
    images: [{ src: 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=400', alt: 'Pod Mod' }],
    categories: [{ id: 2, name: 'Hardware' }],
    attributes: [],
    stock_status: 'instock',
    slug: 'pod-mod-ultra-slim',
  },
  {
    id: 3,
    name: 'Salt Nic Strawberry Cream',
    price: '5.90',
    regular_price: '5.90',
    short_description: 'Sali di nicotina 20mg – fragola e panna – 10ml',
    images: [{ src: 'https://images.unsplash.com/photo-1614483888-c84fdaae28b2?w=400', alt: 'Salt Nic' }],
    categories: [{ id: 1, name: 'Liquidi' }],
    attributes: [],
    stock_status: 'instock',
    slug: 'salt-nic-strawberry',
  },
  {
    id: 4,
    name: 'Kit Starter Box Mod',
    price: '49.90',
    regular_price: '64.90',
    short_description: 'Kit completo: mod 80W + tank da 5ml – perfetto per chi inizia',
    images: [{ src: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=400', alt: 'Starter Kit' }],
    categories: [{ id: 2, name: 'Hardware' }],
    attributes: [],
    stock_status: 'instock',
    slug: 'starter-kit-box-mod',
  },
  {
    id: 5,
    name: 'Resistenza Coil Pack (5pz)',
    price: '7.90',
    regular_price: '7.90',
    short_description: 'Pack da 5 resistenze mesh 0.2Ω – compatibili sub-ohm',
    images: [{ src: 'https://images.unsplash.com/photo-1603903631918-a3c0ee7db0f2?w=400', alt: 'Coils' }],
    categories: [{ id: 3, name: 'Accessori' }],
    attributes: [],
    stock_status: 'instock',
    slug: 'coil-pack-mesh',
  },
  {
    id: 6,
    name: 'Batteria 18650 3000mAh',
    price: '9.90',
    regular_price: '9.90',
    short_description: 'Batteria al litio ad alta scarica – certificata Samsung SDI',
    images: [{ src: 'https://images.unsplash.com/photo-1509741102003-ca64bfe5a900?w=400', alt: 'Batteria' }],
    categories: [{ id: 3, name: 'Accessori' }],
    attributes: [],
    stock_status: 'instock',
    slug: 'batteria-18650',
  },
];
