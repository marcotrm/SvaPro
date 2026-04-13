import React, { useState, useEffect, useCallback } from 'react';
import { orders as ordersApi, reports, getImageUrl } from '../api.jsx';
import {
  X, TrendingUp, ShoppingBag, Users, CreditCard, Banknote,
  BarChart3, Package, Calendar, Loader2, Store, Receipt,
  User, Clock, ArrowLeft, ChevronLeft, ChevronRight
} from 'lucide-react';
import OrderDetailModal from './OrderDetailModal.jsx';

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
      // calls devono essere separate — se ordini fallisce vogliamo comunque i KPI
      const [summRes, ordRes] = await Promise.allSettled([
        reports.summary({ ...baseParams, date_from, date_to }),
        ordersApi.getOrders(params),
      ]);

      if (summRes.status === 'fulfilled') {
        const s = summRes.value.data?.data || summRes.value.data || {};
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
      } else {
        console.error('[StoreStatsDrawer] summary failed:', summRes.reason?.response?.data || summRes.reason?.message);
        setKpi(null);
      }

      if (ordRes.status === 'fulfilled') {
        const orderList = ordRes.value.data?.data || ordRes.value.data || [];
        setRecentOrders(Array.isArray(orderList) ? orderList : []);
      } else {
        console.error('[StoreStatsDrawer] getOrders failed:', ordRes.reason?.response?.data || ordRes.reason?.message);
        setRecentOrders([]);
      }
    } catch (err) {
      console.error('[StoreStatsDrawer] load error:', err);
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
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Dati non disponibili</div>
              <div style={{ fontSize: 12, marginBottom: 16 }}>Verifica la connessione al server</div>
              <button
                onClick={load}
                style={{ background: '#7B6FD0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                🔄 Riprova
              </button>
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
