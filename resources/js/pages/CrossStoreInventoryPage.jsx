import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inventory, stores as storesApi } from '../api.jsx';
import { MapPin, Search, RefreshCw, Store, Package, X, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CrossStoreInventoryPage() {
  const { selectedStoreId } = useOutletContext?.() || {};

  // ── Dati globali ─────────────────────────────────────────────────────
  const [allData, setAllData]     = useState([]);   // righe cross-store raw
  const [storesList, setStoresList] = useState([]); // lista negozi
  const [loading, setLoading]     = useState(true);

  // ── Ricerca ──────────────────────────────────────────────────────────
  const [storeSearch, setStoreSearch]   = useState('');   // filtro colonna sinistra
  const [productSearch, setProductSearch] = useState(''); // cerca per codice/sku/nome prodotto

  // ── Negozio selezionato (colonna sinistra → destra) ──────────────────
  const [selectedStore, setSelectedStore] = useState(null);

  // ── Carica dati ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, stRes] = await Promise.all([
        inventory.getCrossStore(),
        storesApi.getStores(),
      ]);

      // Normalizza inventario cross-store
      const payload = invRes.data?.data || invRes.data || [];
      let flat = [];
      if (payload.length > 0 && payload[0]?.stores) {
        flat = payload.flatMap(v =>
          v.stores.map(s => ({
            ...s,
            product_name: v.product_name || v.name,
            sku:          v.sku,
            flavor:       v.flavor,
          }))
        );
      } else {
        flat = Array.isArray(payload) ? payload : [];
      }
      setAllData(flat);

      // Lista negozi definitiva
      const slist = stRes.data?.data || [];
      setStoresList(slist);

      // Auto-seleziona il primo negozio se non ce n'è uno selezionato
      if (slist.length > 0 && !selectedStore) {
        setSelectedStore(slist[0]);
      }
    } catch {
      toast.error('Impossibile caricare le giacenze locali');
      setAllData([]);
      setStoresList([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  // ── Utilità ──────────────────────────────────────────────────────────
  const cleanName = (name) => {
    if (!name) return 'Negozio Sconosciuto';
    return name.replace(/^(Magazzino\s*(?:\d+\.)?\s*)?(?:Negozio\s*)?/i, '').trim() || name;
  };

  // ── Negozi filtrati (colonna sinistra) ───────────────────────────────
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return storesList;
    const q = storeSearch.toLowerCase();
    return storesList.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q)
    );
  }, [storesList, storeSearch]);

  // ── Se c'è ricerca prodotto → mostra negozi che hanno quel prodotto ──
  const productSearchActive = productSearch.trim().length > 0;

  // Aggregazione: per negozio → prodotti con qty
  const byStore = useMemo(() => {
    const map = {};
    allData.forEach(row => {
      const stName = row.store?.name || row.store_name || row.warehouse?.name || 'Negozio Sconosciuto';
      const stId   = row.store?.id   || row.store_id   || row.warehouse?.id;
      const key    = stId ? String(stId) : stName;
      if (!map[key]) map[key] = { stId, stName, products: [] };

      const qty = Number(row.on_hand ?? row.available ?? row.quantity) || 0;
      const prodName = row.product_name || row.name || 'Prodotto Sconosciuto';
      const existing = map[key].products.find(p => p.name === prodName);
      if (existing) {
        existing.totalQty += qty;
        if (row.flavor || row.sku) existing.variants.push({ flavor: row.flavor, sku: row.sku, qty });
      } else {
        map[key].products.push({
          name: prodName,
          sku:  row.sku,
          totalQty: qty,
          variants: (row.flavor || row.sku) ? [{ flavor: row.flavor, sku: row.sku, qty }] : [],
        });
      }
    });
    return map;
  }, [allData]);

  // ── Prodotti del negozio selezionato (con filtro ricerca) ─────────────
  const selectedStoreKey = useMemo(() => {
    if (!selectedStore) return null;
    // Prova prima per id, poi per nome
    const byId = Object.values(byStore).find(s => String(s.stId) === String(selectedStore.id));
    if (byId) return byId;
    const byName = Object.values(byStore).find(s =>
      cleanName(s.stName).toLowerCase() === cleanName(selectedStore.name).toLowerCase()
    );
    return byName || null;
  }, [byStore, selectedStore]);

  const productsToShow = useMemo(() => {
    const prods = selectedStoreKey?.products || [];
    if (!productSearch.trim()) return prods;
    const q = productSearch.toLowerCase();
    return prods.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      p.variants.some(v => v.sku && v.sku.toLowerCase().includes(q) || v.flavor && v.flavor.toLowerCase().includes(q))
    );
  }, [selectedStoreKey, productSearch]);

  // ── Ricerca globale prodotto → negozi che lo tengono ─────────────────
  const storesWithProduct = useMemo(() => {
    if (!productSearchActive) return [];
    const q = productSearch.toLowerCase();
    return Object.values(byStore).filter(s =>
      s.products.some(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.variants.some(v =>
          (v.sku && v.sku.toLowerCase().includes(q)) ||
          (v.flavor && v.flavor.toLowerCase().includes(q))
        )
      )
    );
  }, [byStore, productSearch, productSearchActive]);

  // ────────────────────────────────────────────────────────────────────
  const thStyle = {
    padding: '10px 14px',
    borderBottom: '2px solid var(--color-border)',
    background: 'var(--color-bg)',
    fontWeight: 700,
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#10B981,#059669)', borderRadius: 14, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
            <MapPin size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--color-text)' }}>Giacenze Locali</h1>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>
              {storesList.length} negozi · {productSearchActive ? `${storesWithProduct.length} con "${productSearch}"` : 'Stock multi-store'}
            </div>
          </div>
        </div>

        {/* Barra ricerca prodotto centrale */}
        <div style={{ flex: '1 1 320px', maxWidth: 420, position: 'relative' }}>
          <Package size={14} color="var(--color-text-tertiary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            id="product-search"
            className="sp-input"
            placeholder="🔍 Cerca prodotto / SKU / codice..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: productSearch ? 32 : 14, width: '100%', fontWeight: 600, fontSize: 13 }}
          />
          {productSearch && (
            <button onClick={() => setProductSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        <button onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Aggiorna
        </button>
      </div>

      {/* ── Se c'è ricerca prodotto attiva → mostra pannello risultati globali ── */}
      {productSearchActive && (
        <div style={{ background: 'var(--color-surface)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 12px rgba(16,185,129,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#10B981', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} />
            Negozi con "{productSearch}" in store
          </div>
          {storesWithProduct.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              Nessun negozio ha questo prodotto in giacenza.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {storesWithProduct.map((s, i) => {
                const prods = s.products.filter(p => {
                  const q = productSearch.toLowerCase();
                  return p.name.toLowerCase().includes(q) ||
                    (p.sku && p.sku.toLowerCase().includes(q)) ||
                    p.variants.some(v => (v.sku && v.sku.toLowerCase().includes(q)) || (v.flavor && v.flavor.toLowerCase().includes(q)));
                });
                const totalQty = prods.reduce((acc, p) => acc + p.totalQty, 0);
                // Trova il negozio nella lista
                const st = storesList.find(st => String(st.id) === String(s.stId)) || { name: s.stName };
                return (
                  <button key={i} onClick={() => { setSelectedStore(st); setProductSearch(''); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 16px', background: 'var(--color-bg)', border: '1.5px solid rgba(16,185,129,0.25)', borderRadius: 12, cursor: 'pointer', textAlign: 'left', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: 'var(--color-text)' }}>
                      <MapPin size={12} color="#10B981" />
                      {cleanName(st.name || s.stName)}
                    </div>
                    {prods.map((p, pi) => (
                      <div key={pi} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {p.name}: <span style={{ fontWeight: 800, color: totalQty > 0 ? '#10B981' : '#EF4444' }}>{p.totalQty} pz</span>
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Layout due colonne ── */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
          <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          Caricamento giacenze...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

          {/* ── Colonna SX: Lista negozi ── */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* Ricerca negozio */}
            <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--color-border)', position: 'relative' }}>
              <Search size={13} color="var(--color-text-tertiary)" style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="store-search"
                className="sp-input"
                placeholder="Cerca negozio..."
                value={storeSearch}
                onChange={e => setStoreSearch(e.target.value)}
                style={{ paddingLeft: 30, width: '100%', fontSize: 12, padding: '7px 10px 7px 28px' }}
              />
            </div>

            {/* Lista */}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {filteredStores.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Nessun negozio trovato</div>
              ) : filteredStores.map(st => {
                const stData  = Object.values(byStore).find(s => String(s.stId) === String(st.id) || cleanName(s.stName).toLowerCase() === cleanName(st.name).toLowerCase());
                const totalQty = stData?.products.reduce((acc, p) => acc + p.totalQty, 0) ?? null;
                const isActive = selectedStore?.id === st.id;
                return (
                  <button key={st.id} onClick={() => setSelectedStore(st)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent', border: 'none', borderLeft: isActive ? '3px solid #10B981' : '3px solid transparent', cursor: 'pointer', textAlign: 'left', gap: 8, transition: 'all 0.1s' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {st.name}
                      </div>
                      {st.city && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{st.city}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {totalQty !== null && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: totalQty > 0 ? '#10B981' : '#EF4444', background: totalQty > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: 6 }}>
                          {totalQty}
                        </span>
                      )}
                      {isActive && <ChevronRight size={12} color="#10B981" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
              {filteredStores.length} negozi
            </div>
          </div>

          {/* ── Colonna DX: Prodotti del negozio selezionato ── */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {!selectedStore ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                <Store size={40} style={{ opacity: 0.15, margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 14 }}>Seleziona un negozio</div>
              </div>
            ) : (
              <>
                {/* Intestazione negozio selezionato */}
                <div style={{ padding: '14px 18px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={16} color="#10B981" />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>{selectedStore.name}</div>
                      {selectedStore.city && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{selectedStore.city}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {productsToShow.length} prodotti {productSearch ? `per "${productSearch}"` : 'in giacenza'}
                  </div>
                </div>

                {/* Tabella prodotti */}
                {productsToShow.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                    <Package size={32} style={{ opacity: 0.15, margin: '0 auto 12px', display: 'block' }} />
                    {productSearch ? `Nessun prodotto per "${productSearch}"` : 'Nessuna giacenza per questo negozio'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr>
                          <th style={thStyle}>Prodotto</th>
                          <th style={thStyle}>SKU</th>
                          <th style={thStyle}>Varianti</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Q.tà</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productsToShow.map((p, pi) => (
                          <tr key={pi}
                            style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 14px', fontWeight: 700, color: 'var(--color-text)' }}>
                              {p.name}
                            </td>
                            <td style={{ padding: '14px 14px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
                              {p.sku || p.variants[0]?.sku || '—'}
                            </td>
                            <td style={{ padding: '14px 14px' }}>
                              {p.variants.some(v => v.flavor) ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                  {p.variants.filter(v => v.qty > 0 && v.flavor).map((v, vi) => (
                                    <span key={vi} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '1px 6px', borderRadius: 5 }}>
                                      {v.flavor}: <strong>{v.qty}</strong>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                              <span style={{
                                fontSize: 14, fontWeight: 900,
                                color: p.totalQty > 0 ? '#10B981' : '#EF4444',
                                background: p.totalQty > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1.5px solid ${p.totalQty > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                padding: '3px 10px', borderRadius: 8,
                              }}>
                                {p.totalQty > 0 ? `+${p.totalQty}` : 'ESAURITO'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
