import React, { useState, useEffect } from 'react';
import { Package, X, MapPin, Loader2, Search } from 'lucide-react';
import { inventory, stores as storesApi } from '../api.jsx';
import { toast } from 'react-hot-toast';

export default function ProductInventoryModal({ product, onClose }) {
  const [data, setData] = useState([]);
  const [storesList, setStoresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const params = product.id ? { product_id: product.id } : { product_variant_id: product.variant_id };
    Promise.all([
      inventory.getCrossStore(params),
      storesApi.getStores()
    ])
      .then(([invRes, stRes]) => {
        const payload = invRes.data?.data || invRes.data || [];
        if (payload.length > 0 && payload[0].stores) {
          const flatData = payload.flatMap(v => v.stores.map(s => ({ ...s, flavor: v.flavor, sku: v.sku })));
          setData(flatData);
        } else {
          setData(Array.isArray(payload) ? payload : []);
        }
        setStoresList(stRes.data?.data || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Impossibile caricare le giacenze');
        setLoading(false);
      });
  }, [product.id, product.variant_id]);

  const cleanStoreName = (name) => {
    if (!name) return 'Negozio Sconosciuto';
    return name.replace(/^(Magazzino\s*(?:\d+\.)?\s*)?(?:Negozio\s*)?/i, '').trim() || name;
  };

  const aggregatedStores = React.useMemo(() => {
    const map = {};
    
    // Inizializza la mappa con TUTTI i negozi (per mostrare quelli a 0 stock)
    storesList.forEach(st => {
      const locName = cleanStoreName(st.name);
      map[locName] = {
        locName,
        store_city: st.city,
        totalQty: 0,
        variants: []
      };
    });

    data.forEach(row => {
      const rawName = row.store?.name || row.store_name || row.warehouse?.name || row.warehouse_name || 'Negozio sconosciuto';
      const locName = cleanStoreName(rawName);
      if (!map[locName]) {
        map[locName] = {
          locName,
          store_city: row.store_city,
          totalQty: 0,
          variants: []
        };
      }
      const qty = Number(row.on_hand ?? row.available ?? row.quantity) || 0;
      map[locName].totalQty += qty;
      if (row.flavor || qty > 0) {
        map[locName].variants.push({ flavor: row.flavor, sku: row.sku, qty });
      }
    });

    return Object.values(map);
  }, [data, storesList]);

  const filteredData = aggregatedStores.filter(row => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const loc = row.locName.toLowerCase();
    return loc.includes(s) || (row.store_city && row.store_city.toLowerCase().includes(s));
  });

  const totalQty = filteredData.reduce((sum, row) => sum + row.totalQty, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Package size={22} color="#10B981" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>Giacenze Locali</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{product.name}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--color-bg)', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
              <X size={16} />
            </button>
          </div>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--color-text-tertiary)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              className="sp-input"
              placeholder="Cerca per nome negozio o città..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 38, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, width: '100%' }}
            />
          </div>
        </div>
        
        {/* Contenuto */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 0' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <Loader2 size={32} style={{ margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Cerco inventario in tutti i negozi...</div>
            </div>
          ) : filteredData.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, color: 'var(--color-text-tertiary)' }}>
              {searchTerm ? 'Nessun negozio trovato con questo nome.' : '??️ Nessuna giacenza registrata in alcun negozio per questo prodotto.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 22px' }}>Negozio / Magazzino</th>
                  <th style={{ padding: '12px 22px', textAlign: 'right' }}>Quantità in Stock</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => {
                  const qty = row.totalQty;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '14px 22px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <MapPin size={14} color="#10B981" style={{ marginTop: 2 }} /> 
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span>{row.locName}</span>
                            {row.variants.length > 0 && row.variants.some(v => v.flavor) && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 500, display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                                {row.variants.filter(v => v.qty > 0 && v.flavor).map((v, i) => (
                                  <span key={i}>• {v.flavor}: <strong style={{ color: 'var(--color-text-secondary)' }}>{v.qty}</strong></span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 22px', textAlign: 'right', verticalAlign: 'top' }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: qty > 0 ? '#10B981' : '#EF4444', background: qty > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: qty > 0 ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid rgba(239,68,68,0.3)', padding: '4px 10px', borderRadius: 8 }}>
                          {qty > 0 ? `+${qty}` : 'ESAURITO'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Footer totale */}
        {!loading && filteredData.length > 0 && (
          <div style={{ padding: '18px 22px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totale Multi-Store</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#10B981', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', padding: '6px 16px', borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>{totalQty} pz</span>
          </div>
        )}
      </div>
    </div>
  );
}
