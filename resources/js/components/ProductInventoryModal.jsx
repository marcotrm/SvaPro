import React, { useState, useEffect } from 'react';
import { Package, X, MapPin, Loader2 } from 'lucide-react';
import { inventory } from '../api.jsx';
import { toast } from 'react-hot-toast';

export default function ProductInventoryModal({ product, onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventory.getCrossStore({ product_id: product.id })
      .then(res => {
        const payload = res.data?.data || res.data || [];
        setData(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        // Fallback locale
        inventory.getStock({ product_id: product.id, limit: 100 })
          .then(r => {
             const payload = r.data?.data || r.data || [];
             setData(Array.isArray(payload) ? payload : []);
          })
          .catch(() => toast.error('Impossibile caricare le giacenze'));
      })
      .finally(() => setLoading(false));
  }, [product.id]);

  const totalQty = data.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.4)', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color="#10B981" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>Giacenze Locali</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{product.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--color-bg)', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        
        {/* Contenuto */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 0' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              <Loader2 size={32} style={{ margin: '0 auto 10px', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Cerco inventario in tutti i negozi...</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 14, color: 'var(--color-text-tertiary)' }}>
              ⚠️ Nessuna giacenza registrata in alcun negozio per questo prodotto.
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
                {data.map((row, idx) => {
                  const qty = Number(row.quantity) || 0;
                  const locName = row.store?.name || row.store_name || row.warehouse?.name || 'Store';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '14px 22px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MapPin size={14} color="#10B981" /> {locName}
                        </div>
                      </td>
                      <td style={{ padding: '14px 22px', textAlign: 'right' }}>
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
        {!loading && data.length > 0 && (
          <div style={{ padding: '18px 22px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)', borderRadius: '0 0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Totale Multi-Store</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#10B981', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', padding: '6px 16px', borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>{totalQty} pz</span>
          </div>
        )}
      </div>
    </div>
  );
}
