import React, { useState, useEffect, useCallback } from 'react';
import { orders as ordersApi, reports, getImageUrl } from '../api.jsx';
import {
  X, TrendingUp, ShoppingBag, Users, CreditCard, Banknote,
  BarChart3, Package, Calendar, Loader2, Store, Receipt,
  User, Clock, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
const fmtN = (v) => new Intl.NumberFormat('it-IT').format(v || 0);

const PERIODS = [
  { id: 'today',  label: 'Oggi' },
  { id: 'week',   label: 'Settimana' },
  { id: 'month',  label: 'Mese' },
  { id: 'year',   label: 'Anno' },
];

function getPeriodDates(period) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  switch (period) {
    case 'today': return { date_from: today, date_to: today };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { date_from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, date_to: today };
    }
    case 'month': return { date_from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, date_to: today };
    case 'year':  return { date_from: `${now.getFullYear()}-01-01`, date_to: today };
    default:      return { date_from: today, date_to: today };
  }
}

function KpiCard({ icon: Icon, label, value, sub, color = '#7B6FD0' }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '1px solid #f0edf8', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color, fontWeight: 700 }}>{sub}</div>}
    </div>
  );
}

function OrderRow({ order, onClick, active }) {
  const statusColors = {
    paid:      { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', label: 'Pagato' },
    pending:   { bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B', label: 'Attesa' },
    cancelled: { bg: 'rgba(239,68,68,0.1)',   color: '#EF4444', label: 'Annullato' },
    refunded:  { bg: 'rgba(99,102,241,0.1)',  color: '#6366F1', label: 'Rimborsato' },
  };
  const s = statusColors[order.status] || statusColors.pending;
  return (
    <div
      onClick={() => onClick(order)}
      style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
        gap: 10, alignItems: 'center',
        padding: '11px 8px',
        borderBottom: '1px solid #f5f3ff',
        cursor: 'pointer',
        borderRadius: 8,
        background: active ? 'rgba(123,111,208,0.07)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f3ff'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(123,111,208,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShoppingBag size={14} color="#7B6FD0" />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>
          #{order.id} {order.customer_name ? `– ${order.customer_name}` : '– Al banco'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {order.created_at ? new Date(order.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e' }}>{fmt(order.grand_total)}</div>
      <div style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '3px 7px', background: s.bg, color: s.color }}>{s.label}</div>
    </div>
  );
}

/* ─── Modal scontrino completo con navigazione ─── */
function OrderDetailModal({ orderId, orders, onClose, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentIdx = orders.findIndex(o => o.id === orderId);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < orders.length - 1;

  useEffect(() => {
    setLoading(true);
    setData(null);
    ordersApi.getOrder(orderId)
      .then(res => setData(res.data?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  // Navigazione con frecce tastiera
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev)  onNavigate(orders[currentIdx - 1].id);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(orders[currentIdx + 1].id);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [orderId, hasPrev, hasNext, currentIdx]);

  const statusColors = {
    paid:      { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: '✓ Pagato' },
    pending:   { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: '⏳ In Attesa' },
    cancelled: { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: '✗ Annullato' },
    refunded:  { bg: 'rgba(99,102,241,0.12)', color: '#6366F1', label: '↩ Rimborsato' },
  };
  const paymentLabel = (ch) => ({ cash: 'Contanti 💵', card: 'Carta / POS 💳', transfer: 'Bonifico', mixed: 'Misto' }[ch] || ch || '—');

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, marginRight: 4 }}>
                {currentIdx + 1} / {orders.length}
              </div>
              <button
                onClick={() => hasPrev && onNavigate(orders[currentIdx - 1].id)}
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
                onClick={() => hasNext && onNavigate(orders[currentIdx + 1].id)}
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
          </div>
          {/* Hint tastiera */}
          <div style={{ fontSize: 10, opacity: 0.6, textAlign: 'center', letterSpacing: '0.04em' }}>
            Usa ← → per navigare tra le vendite · ESC per chiudere
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
            const totalTax = lines.reduce((s, l) => s + parseFloat(l.tax_amount || 0), 0);
            const totalDiscount = lines.reduce((s, l) => s + parseFloat(l.discount_amount || 0), 0);

            return (
              <>
                {/* Status + meta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  <div style={{ padding: '5px 12px', borderRadius: 8, background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 13 }}>{sc.label}</div>
                  {data.channel && <div style={{ padding: '5px 12px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{paymentLabel(data.channel)}</div>}
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

                {/* Prodotti con immagini */}
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
                        {/* Immagine prodotto */}
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

                        {/* Info prodotto */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}{flavor}
                          </div>
                          {line.sku && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>SKU: {line.sku}</div>}
                        </div>

                        {/* Quantità e prezzi */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#7B6FD0' }}>{fmt(line.line_total)}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>×{line.qty} · {fmt(line.unit_price)} cad.</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Riepilogo totali */}
                <div style={{ background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius: 14, padding: '16px 18px', color: '#fff' }}>
                  {totalDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                      <span>Sconti applicati</span><span>− {fmt(totalDiscount)}</span>
                    </div>
                  )}
                  {totalTax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                      <span>IVA inclusa</span><span>{fmt(totalTax)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>TOTALE</span>
                    <span style={{ fontSize: 26, fontWeight: 900 }}>{fmt(data.grand_total)}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                    {paymentLabel(data.channel)}
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

        {/* Footer navigazione */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f0edf8', display: 'flex', justifyContent: 'space-between', flexShrink: 0, background: '#fafafa' }}>
          <button
            onClick={() => hasPrev && onNavigate(orders[currentIdx - 1].id)}
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
            <ChevronLeft size={14} /> Vendita precedente
          </button>
          <div style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center', fontWeight: 600 }}>
            {currentIdx + 1} di {orders.length}
          </div>
          <button
            onClick={() => hasNext && onNavigate(orders[currentIdx + 1].id)}
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
            Vendita successiva <ChevronRight size={14} />
          </button>
        </div>

        <style>{`
          @keyframes modalIn { from { transform: translate(-50%, -48%); opacity: 0; } to { transform: translate(-50%, -50%); opacity: 1; } }
        `}</style>
      </div>
    </>
  );
}

/* ─── StoreStatsDrawer principale ─── */
export default function StoreStatsDrawer({ store, onClose }) {
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { date_from, date_to } = getPeriodDates(period);
    const baseParams = store?.id ? { store_id: store.id } : {};
    const params = { ...baseParams, date_from, date_to, limit: 50 };

    try {
      const [summRes, ordRes] = await Promise.all([
        reports.summary({ ...baseParams, date_from, date_to }),
        ordersApi.getOrders(params),
      ]);

      const s = summRes.data?.data || summRes.data || {};
      setKpi({
        revenue:     parseFloat(s.total_revenue || s.revenue || 0),
        orders:      parseInt(s.total_orders || s.orders || 0),
        avg_ticket:  parseFloat(s.avg_ticket || s.avg_order || 0),
        customers:   parseInt(s.unique_customers || s.total_customers || 0),
        cash:        parseFloat(s.cash_total || 0),
        card:        parseFloat(s.card_total || 0),
        other:       parseFloat(s.other_total || 0),
        items_sold:  parseInt(s.items_sold || 0),
        upt:         parseFloat(s.upt || 0),
      });

      const orderList = ordRes.data?.data || ordRes.data || [];
      setRecentOrders(Array.isArray(orderList) ? orderList : []);
    } catch {
      setKpi(null);
    } finally {
      setLoading(false);
    }
  }, [store?.id, period]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', animation: 'fadeIn 0.2s ease' }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9991,
        width: 'min(580px, 100vw)',
        background: '#f8f7fc',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Riepilogo Vendite</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{store?.name || 'Tutti i negozi'}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: period === p.id ? '#fff' : 'rgba(255,255,255,0.15)',
                color: period === p.id ? '#7B6FD0' : 'rgba(255,255,255,0.85)',
                transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, flexDirection: 'column', gap: 12 }}>
              <Loader2 size={32} color="#7B6FD0" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Caricamento statistiche...</div>
            </div>
          ) : kpi ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {/* Totale incassato – full width */}
                <div style={{ gridColumn: '1/-1' }}>
                  <KpiCard icon={TrendingUp} label="Totale Incassato" value={fmt(kpi.revenue)} color="#7B6FD0"
                    sub={kpi.orders > 0 ? `${fmtN(kpi.orders)} scontrini` : 'Nessuna vendita'} />
                </div>
                {/* Scontrino medio */}
                <KpiCard icon={BarChart3} label="Scontrino Medio" value={fmt(kpi.avg_ticket)} color="#8B7FCC" />
                {/* UPT */}
                <KpiCard icon={ShoppingBag} label="UPT (articoli/scontr.)" value={kpi.upt > 0 ? kpi.upt.toFixed(2) : '—'} color="#6C63AC"
                  sub={kpi.items_sold > 0 ? `${fmtN(kpi.items_sold)} pz totali` : undefined} />
                {/* Pagamenti – sezione breakdown */}
                <div style={{ gridColumn: '1/-1', background: '#f8f7fc', borderRadius: 14, padding: '14px 16px', border: '1px solid #ede9f8' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#1a1a2e', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    💳 Strumenti di Pagamento
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #f0edf8' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>💵 Contanti</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{fmt(kpi.cash)}</div>
                      {kpi.revenue > 0 && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{Math.round(kpi.cash / kpi.revenue * 100)}% del totale</div>}
                    </div>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #f0edf8' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 4 }}>💳 Carta / POS</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#3B82F6' }}>{fmt(kpi.card)}</div>
                      {kpi.revenue > 0 && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{Math.round(kpi.card / kpi.revenue * 100)}% del totale</div>}
                    </div>
                    {kpi.other > 0 && (
                      <div style={{ gridColumn: '1/-1', background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #f0edf8' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginBottom: 4 }}>🔄 Altro</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#F59E0B' }}>{fmt(kpi.other)}</div>
                      </div>
                    )}
                  </div>
                </div>
                {kpi.customers > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <KpiCard icon={Users} label="Clienti Fidelizzati" value={fmtN(kpi.customers)} color="#F59E0B" />
                  </div>
                )}
              </div>

              <div style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '1px solid #f0edf8', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} color="#7B6FD0" />
                  Transazioni ({recentOrders.length})
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Clicca su una vendita per il dettaglio completo · usa ← → da tastiera nel modal</div>
                {recentOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
                    <Package size={36} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Nessuna transazione nel periodo</div>
                  </div>
                ) : recentOrders.map(o => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    active={o.id === selectedOrderId}
                    onClick={o => setSelectedOrderId(o.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <BarChart3 size={48} style={{ opacity: 0.15, margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Dati non disponibili</div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          orders={recentOrders}
          onClose={() => setSelectedOrderId(null)}
          onNavigate={(id) => setSelectedOrderId(id)}
        />
      )}
    </>
  );
}
