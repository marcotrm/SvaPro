import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inventory, stores as storesApi } from '../api.jsx';
import { MapPin, Search, RefreshCw, Package, Store, ArrowDownIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CrossStoreInventoryPage() {
  const { selectedStoreId } = useOutletContext?.() || {};

  const [allData, setAllData]     = useState([]);
  const [storesList, setStoresList] = useState([]);
  const [loading, setLoading]     = useState(true);

  // Ricerca (SKU / Prodotto / Barcode)
  const [productSearch, setProductSearch] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce per evitare chiamate di rete ad ogni singola lettera digitata
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(productSearch), 400);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const loadData = useCallback(async (searchQuery = '') => {
    setLoading(true);
    try {
      const [invRes, stRes] = await Promise.all([
        inventory.getCrossStore({ q: searchQuery }),
        storesApi.getStores(),
      ]);

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
      setStoresList(stRes.data?.data || []);
    } catch {
      toast.error('Impossibile caricare le giacenze locali');
      setAllData([]);
      setStoresList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Chiama loadData ogni volta che il componente si monta O cambia la query testuale de-bounced
  useEffect(() => { loadData(debouncedQuery); }, [loadData, debouncedQuery]);


  const cleanName = (name) => {
    if (!name) return 'Negozio Sconosciuto';
    return name.replace(/^(Magazzino\s*(?:\d+\.)?\s*)?(?:Negozio\s*)?/i, '').trim() || name;
  };

  // ── LOGICA DI FILTRAGGIO SIMILE AL REPORT FATTURATI ──
  // Per ogni negozio calcoliamo lo stock in base al prodotto cercato.
  // Se non c'??ricerca, aggreghiamo lo stock TOTALE di quel negozio (come overview globale).
  const tableData = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    
    // Raggruppiamo i dati RAW per Negozio
    const storeMap = {};
    storesList.forEach(st => {
      storeMap[st.id] = {
        id: st.id,
        name: cleanName(st.name),
        city: st.city,
        totalQty: 0,
        matchedProducts: []
      };
    });

    // Aggiungiamo anche i negozi presenti nelle giacenze ma che magari non sono in storesList (ad es. magazzini fantasma)
    allData.forEach(row => {
      const stId   = row.store?.id   || row.store_id   || row.warehouse?.id;
      const stName = row.store?.name || row.store_name || row.warehouse?.name || 'Negozio Sconosciuto';
      const key = stId || stName;

      if (!storeMap[key]) {
        storeMap[key] = { id: key, name: cleanName(stName), totalQty: 0, matchedProducts: [] };
      }

      const qty = Number(row.on_hand ?? row.available ?? row.quantity) || 0;
      const prodName = row.product_name || row.name || 'Prodotto Sconosciuto';
      const sku = row.sku || '';
      const flavor = row.flavor || '';

      // Se c'??una query di ricerca prodotto, filtriamo le righe
      let matches = true;
      if (q) {
        matches = prodName.toLowerCase().includes(q) || sku.toLowerCase().includes(q) || flavor.toLowerCase().includes(q);
      }

      if (matches) {
        storeMap[key].totalQty += qty;
        if (qty > 0 || row.sku || row.flavor) { // Memorizziamo un riassunto dei prodotti matchati per questo negozio se c"??q
             storeMap[key].matchedProducts.push({ name: prodName, sku, flavor, qty });
        }
      }
    });

    // Rimuovi i negozi che non hanno giacenza corrispondente, SE stiamo cercando qualcosa
    let list = Object.values(storeMap);
    if (q) {
        list = list.filter(st => st.matchedProducts.length > 0);
    } else {
        // Se non sto cercando nulla, mostro i branch principali ordinati
        list = list.filter(st => st.totalQty > 0 || storesList.some(s => String(s.id) === String(st.id)));
    }

    // Ordina per quantità decrescente
    list.sort((a, b) => b.totalQty - a.totalQty);

    return list;
  }, [allData, storesList, productSearch]);

  const globalTotalQty = tableData.reduce((acc, row) => acc + row.totalQty, 0);

  const thStyle = {
    padding: '12px 14px',
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: 700,
    borderBottom: '1px solid var(--color-border)',
    textAlign: 'left'
  };

  const getBadgeColor = (index, qty) => {
    if (qty <= 0) return '#EF4444'; // Rosso (esaurito)
    if (index === 0) return '#8B5CF6'; // Viola per il primo (pi??stock)
    if (index === 1) return '#F59E0B'; // Arancione
    if (index === 2) return '#10B981'; // Verde
    return '#E5E7EB'; // Grigio default
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#F59E0B', borderRadius: 14, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(245,158,11,0.3)' }}>
            <MapPin size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: 'var(--color-text)' }}>Giacenze Locali Negozi</h1>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Cerca un articolo e scopri in tempo reale le disponibilità stock nei punti vendita
            </div>
          </div>
        </div>

        <button onClick={() => loadData(debouncedQuery)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Sincronizza
        </button>
      </div>

      {/* ── Controls (Ricerca Prodotto Piena Laghezza) ── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} color="var(--color-text-tertiary)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            autoFocus
            className="sp-input"
            placeholder="Spara barcode, cerca per nome prodotto o SKU per trovare le giacenze..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 42px', fontSize: 15, fontWeight: 600, borderRadius: 12, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)' }}
          />
        </div>
      </div>

      {/* ── Table Container ── */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
        
        {/* Table Header Info */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
             {productSearch ? `Risultati per "${productSearch}" (Limite righe: ${tableData.length})` : `Tutti i negozi (${tableData.length})`}
          </div>
          {productSearch && (
            <div style={{ fontSize: 12, color: 'var(--color-text-text)', fontWeight: 600 }}>
             Totale giacenza di rete trovata: <span style={{ color: '#10B981', fontWeight: 800, fontSize: 13 }}>{globalTotalQty} pz</span>
            </div>
          )}
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            Calcolo giacenze in corso...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{...thStyle, width: 50, textAlign: 'center'}}>#</th>
                  <th style={thStyle}>Azienda (Negozio)</th>
                  <th style={thStyle}>Posizione</th>
                  <th style={{...thStyle, width: '40%'}}>Dettaglio Prodotto / Varianti (Match)</th>
                  <th style={{...thStyle, textAlign: 'right', paddingRight: 32}}>Q.tà Giacenza</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                      <Package size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }}/>
                      {productSearch ? 'Questo prodotto non \u00e8 disponibile in nessun punto vendita.' : 'Nessun negozio o giacenza rilevata.'}
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, i) => {
                    const badgeColor = getBadgeColor(i, row.totalQty);
                    
                    // Raggruppiamo i prodotti matchati per nome per una visualizzazione pulita
                    const compactProds = {};
                    row.matchedProducts.forEach(p => {
                       if (!compactProds[p.name]) compactProds[p.name] = { name: p.name, total: 0, skus: [] };
                       compactProds[p.name].total += p.qty;
                       if (p.sku || p.flavor) compactProds[p.name].skus.push(`${p.flavor || ''} ${p.sku ? `[${p.sku}]` : ''}: ${p.qty}pz`.trim());
                    });

                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '16px 14px', textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontWeight: 700 }}>
                          #{i + 1}
                        </td>
                        <td style={{ padding: '16px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Pallino colorato di stato / rank */}
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: badgeColor, flexShrink: 0 }} />
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)', textTransform: 'uppercase' }}>
                              {row.name}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 14px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                          {row.city || '-'}
                        </td>
                        <td style={{ padding: '16px 14px' }}>
                            {/* Mostriamo i prodotti che hanno causato il match - max 3 altrimenti troppo lungo */}
                            {productSearch ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {Object.values(compactProds).slice(0, 3).map((cp, cpi) => (
                                        <div key={cpi}>
                                           <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{cp.name}</div>
                                           {cp.skus.length > 0 && (
                                               <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                  {cp.skus.join(' • ')}
                                               </div>
                                           )}
                                        </div>
                                    ))}
                                    {Object.values(compactProds).length > 3 && (
                                        <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 700 }}>+ altri {Object.values(compactProds).length - 3} prodotti</div>
                                    )}
                                </div>
                            ) : (
                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13, fontStyle: 'italic' }}>
                                    Overview globale giacenze store...
                                </span>
                            )}
                        </td>
                        <td style={{ padding: '16px 32px 16px 14px', textAlign: 'right' }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: row.totalQty > 0 ? '#10B981' : '#EF4444' }}>
                            {row.totalQty > 0 ? row.totalQty : '0'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Riga del totale footer come screenshot */}
              {tableData.length > 0 && productSearch && (
                 <tfoot style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                   <tr>
                     <td colSpan={4} style={{ padding: '16px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--color-text)', fontSize: 13 }}>
                       TOTALE RICERCA
                     </td>
                     <td style={{ padding: '16px 32px 16px 14px', textAlign: 'right', fontWeight: 800, color: '#10B981', fontSize: 16 }}>
                       {globalTotalQty}
                     </td>
                   </tr>
                 </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
