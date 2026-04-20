import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inventory } from '../api.jsx';
import { MapPin, Search, RefreshCw, Package, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function CrossStoreInventoryPage() {
  const { selectedStoreId } = useOutletContext();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await inventory.getCrossStore();
      const payload = res.data?.data || res.data || [];
      if (payload.length > 0 && payload[0].stores) {
        const flatData = payload.flatMap(v => v.stores.map(s => ({ ...s, flavor: v.flavor, sku: v.sku, product_name: v.product_name })));
        setData(flatData);
      } else {
        setData(Array.isArray(payload) ? payload : []);
      }
    } catch (err) {
      toast.error('Impossibile caricare le giacenze locali');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStoreId]);

  const cleanStoreName = (name) => {
    if (!name) return 'Negozio Sconosciuto';
    return name.replace(/^(Magazzino\s*(?:\d+\.)?\s*)?(?:Negozio\s*)?/i, '').trim() || name;
  };

  const aggregatedStores = useMemo(() => {
    const map = {};
    data.forEach(row => {
      const rawName = row.store?.name || row.store_name || row.warehouse?.name || row.warehouse_name || 'Negozio sconosciuto';
      const locName = cleanStoreName(rawName);
      if (!map[locName]) {
        map[locName] = {
          locName,
          store_city: row.store_city,
          totalQty: 0,
          products: []
        };
      }
      const qty = Number(row.on_hand ?? row.available ?? row.quantity) || 0;
      map[locName].totalQty += qty;
      
      const prodName = row.product_name || row.name || 'Prodotto Sconosciuto';
      
      const existingProduct = map[locName].products.find(p => p.name === prodName);
      if (existingProduct) {
        existingProduct.totalQty += qty;
        if (row.flavor || qty > 0) existingProduct.variants.push({ flavor: row.flavor, sku: row.sku, qty });
      } else {
        map[locName].products.push({
          name: prodName,
          totalQty: qty,
          variants: (row.flavor || qty > 0) ? [{ flavor: row.flavor, sku: row.sku, qty }] : []
        });
      }
    });
    return Object.values(map);
  }, [data]);

  const filteredData = useMemo(() => {
    return aggregatedStores.filter(row => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      const loc = row.locName.toLowerCase();
      const city = row.store_city ? row.store_city.toLowerCase() : '';
      return loc.includes(s) || city.includes(s) || row.products.some(p => p.name.toLowerCase().includes(s));
    });
  }, [aggregatedStores, searchTerm]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.92), rgba(5,150,105,0.92))', borderRadius: 14, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
            <MapPin size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--color-text)' }}>Giacenze Locali</h1>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>
              Visualizzazione stock Multi-Store
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} color="var(--color-text-tertiary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              className="sp-input"
              placeholder="Cerca per negozio, città o prodotto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: '100%', fontSize: 13 }}
            />
          </div>

          <button onClick={loadData} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '9px 13px',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-secondary)', opacity: loading ? 0.6 : 1,
          }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Aggiorna
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '10px 16px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            Negozi Trovati: {filteredData.length}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block', opacity: 0.3 }}/>
            Caricamento giacenze...
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 }}>
            <Store size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }}/>
            {searchTerm ? 'Nessun risultato corrispondente' : 'Nessuna giacenza locale trovata'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)', fontWeight: 700, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Store</th>
                  <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)', fontWeight: 700, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Città</th>
                  <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)', fontWeight: 700, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>Giacenze Prodotto (In Stock > 0)</th>
                  <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg)', fontWeight: 700, fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', textAlign: 'right' }}>Totale Qta Store</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                        <MapPin size={14} color="#10B981" />
                        {row.locName}
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {row.store_city || '-'}
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {row.products.filter(p => p.totalQty > 0 || row.products.length === 1).map((prod, pi) => (
                           <div key={pi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                             <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{prod.name} <span style={{ fontSize: 12, fontWeight: 800, color: '#10B981', marginLeft: 6 }}>({prod.totalQty} pz)</span></div>
                             {prod.variants.length > 0 && prod.variants.some(v => v.flavor) && (
                               <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500, display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                                  {prod.variants.filter(v => v.qty > 0 && v.flavor).map((v, i) => (
                                    <span key={i}>• {v.flavor}: <strong style={{ color: 'var(--color-text-secondary)' }}>{v.qty}</strong></span>
                                  ))}
                               </div>
                             )}
                           </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '16px', verticalAlign: 'top', textAlign: 'right' }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: row.totalQty > 0 ? '#10B981' : '#EF4444', background: row.totalQty > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: row.totalQty > 0 ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid rgba(239,68,68,0.3)', padding: '4px 10px', borderRadius: 8 }}>
                        {row.totalQty > 0 ? `+${row.totalQty}` : 'ESAURITO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
