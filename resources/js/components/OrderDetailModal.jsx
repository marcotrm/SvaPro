import React, { useState, useEffect } from 'react';
import { orders as ordersApi, getImageUrl } from '../api.jsx';
import {
  X, ChevronLeft, ChevronRight, Clock, Store, User, Users, Receipt, Package, Loader2
} from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

export default function OrderDetailModal({ orderId, orders, onClose, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Consider orders array could be missing or nested differently
  const ordersList = Array.isArray(orders) ? orders : [];
  const currentIdx = ordersList.findIndex(o => o.id === orderId || o.order_id === orderId);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx !== -1 && currentIdx < ordersList.length - 1;

  useEffect(() => {
    if (!orderId) return;
    
    const cached = ordersList.find(o => o.id === orderId || o.order_id === orderId);
    if (cached && cached.lines && cached.lines.length > 0) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setData(null);
    ordersApi.getOrder(orderId)
      .then(res => setData(res.data?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orderId, ordersList]);

  // Navigazione con frecce tastiera
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev && onNavigate)  onNavigate(ordersList[currentIdx - 1].id || ordersList[currentIdx - 1].order_id);
      if (e.key === 'ArrowRight' && hasNext && onNavigate) onNavigate(ordersList[currentIdx + 1].id || ordersList[currentIdx + 1].order_id);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [orderId, hasPrev, hasNext, currentIdx, ordersList, onNavigate, onClose]);

  const statusColors = {
    paid:      { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: '✓ Pagato' },
    pending:   { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: '⏳ In Attesa' },
    cancelled: { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: '✗ Annullato' },
    refunded:  { bg: 'rgba(99,102,241,0.12)', color: '#6366F1', label: '↩ Rimborsato' },
  };
  const paymentLabel = (data) => {
    const pmts = Array.isArray(data?.payments) ? data.payments : [];
    const label = (m) => ({ cash: '💵 Contanti', card: '💳 Carta / POS', transfer: '🏦 Bonifico', mixed: '🔄 Misto', pos: '🖥 POS', web: '🌐 Online' }[m] || m || '—');
    if (pmts.length === 0) return label(data?.channel);
    if (pmts.length === 1) return label(pmts[0].method);
    return pmts.map(p => `${label(p.method)} ${fmt(p.amount)}`).join(' + ');
  };
  const paymentMethodBadge = (data) => {
    const pmts = Array.isArray(data?.payments) ? data.payments : [];
    const label = (m) => ({ cash: '💵 Contanti', card: '💳 Carta / POS', transfer: '🏦 Bonifico', pos: '🖥 POS', web: '🌐 Online' }[m] || m || '—');
    if (pmts.length === 0) return <span style={{ padding: '4px 10px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontSize: 12, fontWeight: 600 }}>{label(data?.channel)}</span>;
    return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{pmts.map((p, i) => (
      <span key={i} style={{ padding: '4px 10px', borderRadius: 8, background: p.method === 'cash' ? 'rgba(16,185,129,0.1)' : p.method === 'card' ? 'rgba(59,130,246,0.1)' : '#f3f4f6', color: p.method === 'cash' ? '#10b981' : p.method === 'card' ? '#3B82F6' : '#6b7280', fontSize: 12, fontWeight: 700 }}>
        {label(p.method)} {fmt(p.amount)}
      </span>
    ))}</div>;
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9995, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 9996,
        transform: 'translate(-50%, -50%)',
        width: 'min(600px, 96vw)',
        maxHeight: '92vh',
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        animation: 'modalIn 0.2s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>
        {/* Header con naviga */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={15} />
              </button>
              <div>
                <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dettaglio Vendita</div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>Scontrino #{orderId}</div>
              </div>
            </div>
            {/* Navigazione prev/next */}
            {onNavigate && ordersList.length > 0 && currentIdx !== -1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, marginRight: 4 }}>
                  {currentIdx + 1} / {ordersList.length}
                </div>
                <button
                  onClick={() => hasPrev && onNavigate(ordersList[currentIdx - 1].id || ordersList[currentIdx - 1].order_id)}
                  disabled={!hasPrev}
                  title="Vendita precedente (←)"
                  style={{
                    background: hasPrev ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                    border: 'none', borderRadius: 8, width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: hasPrev ? 'pointer' : 'not-allowed', color: '#fff',
                    opacity: hasPrev ? 1 : 0.4, transition: 'all 0.15s',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => hasNext && onNavigate(ordersList[currentIdx + 1].id || ordersList[currentIdx + 1].order_id)}
                  disabled={!hasNext}
                  title="Vendita successiva (→)"
                  style={{
                    background: hasNext ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                    border: 'none', borderRadius: 8, width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: hasNext ? 'pointer' : 'not-allowed', color: '#fff',
                    opacity: hasNext ? 1 : 0.4, transition: 'all 0.15s',
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          {/* Hint tastiera */}
          <div style={{ fontSize: 10, opacity: 0.6, textAlign: 'center', letterSpacing: '0.04em' }}>
            {onNavigate && ordersList.length > 0 ? 'Usa ← → per navigare tra le vendite · ' : ''}ESC per chiudere
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, flexDirection: 'column', gap: 12 }}>
              <Loader2 size={32} color="#7B6FD0" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Caricamento scontrino...</div>
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>Dati non disponibili</div>
          ) : (() => {
            const sc = statusColors[data.status] || statusColors.pending;
            const custName = [data.customer_first_name, data.customer_last_name].filter(Boolean).join(' ');
            const empName = [data.employee_first_name, data.employee_last_name].filter(Boolean).join(' ');
            const lines = data.lines || [];
            const totalDiscount = lines.reduce((s, l) => s + parseFloat(l.discount_amount || 0), 0);

            return (
              <>
                {/* Status + meta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  <div style={{ padding: '5px 12px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 13 }}>{sc.label}</div>
                  {paymentMethodBadge(data)}
                  <div style={{ padding: '5px 12px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={11} />
                    {data.created_at ? new Date(data.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>

                {/* Meta card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  {data.store_name && (
                    <div style={{ background: '#f8f7fc', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Store size={14} color="#7B6FD0" />
                      <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Negozio</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{data.store_name}</div></div>
                    </div>
                  )}
                  {empName && (
                    <div style={{ background: '#f8f7fc', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <User size={14} color="#7B6FD0" />
                      <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Operatore</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{empName}</div></div>
                    </div>
                  )}
                  {custName && (
                    <div style={{ background: '#f8f7fc', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1/-1' }}>
                      <Users size={14} color="#7B6FD0" />
                      <div><div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Cliente</div><div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{custName}</div></div>
                    </div>
                  )}
                </div>

                {/* Prodotti */}
                <div style={{ background: '#f8f7fc', borderRadius: 14, padding: '14px', marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1a2e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={13} color="#7B6FD0" />
                    Articoli venduti ({lines.length})
                  </div>
                  {lines.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>Nessun articolo</div>
                  ) : lines.map((line, i) => {
                    let name = line.product_name;
                    if (!name) {
                      try { name = JSON.parse(line.tax_snapshot_json || '{}')?.product_type === 'service' ? '🛡 QSCare' : '—'; } catch { name = '—'; }
                    }
                    const flavor = line.flavor ? ` · ${line.flavor}` : '';
                    const imgUrl = line.image_url ? getImageUrl(line.image_url) : null;

                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 0',
                        borderBottom: i < lines.length - 1 ? '1px solid #ede9f8' : 'none',
                      }}>
                        {/* Immagine */}
                        <div style={{
                          width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                          background: 'linear-gradient(135deg, #7B6FD018, #5B50B018)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid #ede9f8',
                        }}>
                          {imgUrl ? (
                            <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div style={{ display: imgUrl ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={20} color="#7B6FD0" style={{ opacity: 0.4 }} />
                          </div>
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}{flavor}
                          </div>
                          {line.sku && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>SKU: {line.sku}</div>}
                        </div>

                        {/* Prezzi */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#7B6FD0' }}>{fmt(line.line_total)}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            ×{line.qty} · {fmt(line.unit_price)} cad.
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totali */}
                <div style={{ background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
                  {totalDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                      <span>Sconti applicati</span><span>− {fmt(totalDiscount)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>TOTALE</span>
                    <span style={{ fontSize: 26, fontWeight: 900 }}>{fmt(data.grand_total)}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.85, marginTop: 4, fontWeight: 600 }}>
                    {paymentLabel(data)}
                  </div>
                  {data.loyalty_points_awarded > 0 && (
                    <div style={{ marginTop: 10, padding: '7px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                      🏆 {data.loyalty_points_awarded} punti fedeltà guadagnati
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer */}
        {onNavigate && ordersList.length > 0 && currentIdx !== -1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f0edf8', display: 'flex', justifyContent: 'space-between', flexShrink: 0, background: '#fafafa' }}>
            <button
              onClick={() => hasPrev && onNavigate(ordersList[currentIdx - 1].id || ordersList[currentIdx - 1].order_id)}
              disabled={!hasPrev}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, border: '1px solid #ede9f8',
                background: hasPrev ? '#fff' : '#f5f5f5',
                color: hasPrev ? '#7B6FD0' : '#ccc',
                cursor: hasPrev ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
              }}
            >
              <ChevronLeft size={16} /> Precedente
            </button>
            <button
              onClick={() => hasNext && onNavigate(ordersList[currentIdx + 1].id || ordersList[currentIdx + 1].order_id)}
              disabled={!hasNext}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, border: '1px solid #ede9f8',
                background: hasNext ? '#fff' : '#f5f5f5',
                color: hasNext ? '#7B6FD0' : '#ccc',
                cursor: hasNext ? 'pointer' : 'not-allowed',
                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
              }}
            >
              Successiva <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn { from { transform: translate(-50%, -48%); opacity: 0; } to { transform: translate(-50%, -50%); opacity: 1; } }
      `}</style>
    </>
  );
}
