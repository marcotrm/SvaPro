import React, { useState, useEffect, useCallback } from 'react';
import { orders as ordersApi, reports } from '../api.jsx';
import {
  X, TrendingUp, ShoppingBag, Users, CreditCard, Banknote,
  BarChart3, Package, ArrowUpRight, ArrowDownRight, Calendar,
  Loader2, Store
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
    case 'today':
      return { date_from: today, date_to: today };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { date_from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, date_to: today };
    }
    case 'month': {
      return { date_from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, date_to: today };
    }
    case 'year':
      return { date_from: `${now.getFullYear()}-01-01`, date_to: today };
    default:
      return { date_from: today, date_to: today };
  }
}

function KpiCard({ icon: Icon, label, value, sub, color = '#7B6FD0', trend }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '14px 16px',
      border: '1px solid #f0edf8',
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        {trend !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 700,
            color: trend >= 0 ? '#10b981' : '#EF4444',
          }}>
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color, fontWeight: 700 }}>{sub}</div>}
    </div>
  );
}

function OrderRow({ order }) {
  const statusColors = {
    paid: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Pagato' },
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B', label: 'Attesa' },
    cancelled: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444', label: 'Annullato' },
    refunded: { bg: 'rgba(99,102,241,0.1)', color: '#6366F1', label: 'Rimborsato' },
  };
  const s = statusColors[order.status] || statusColors.pending;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto auto',
      gap: 10, alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid #f5f3ff',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'rgba(123,111,208,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShoppingBag size={14} color="#7B6FD0" />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>
          #{order.id} {order.customer_name ? `– ${order.customer_name}` : '– Cliente al banco'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {order.created_at ? new Date(order.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#1a1a2e' }}>{fmt(order.grand_total)}</div>
      <div style={{
        fontSize: 10, fontWeight: 700, borderRadius: 6,
        padding: '3px 7px', background: s.bg, color: s.color,
      }}>{s.label}</div>
    </div>
  );
}

export default function StoreStatsDrawer({ store, onClose }) {
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { date_from, date_to } = getPeriodDates(period);
    const baseParams = store?.id ? { store_id: store.id } : {};
    const params = { ...baseParams, date_from, date_to, limit: 20 };

    try {
      const [summRes, ordRes] = await Promise.all([
        reports.summary({ ...baseParams, date_from, date_to }),
        ordersApi.getOrders(params),
      ]);

      const s = summRes.data?.data || summRes.data || {};
      setKpi({
        revenue: parseFloat(s.total_revenue || s.revenue || 0),
        orders: parseInt(s.total_orders || s.orders_count || 0),
        avg_ticket: parseFloat(s.avg_ticket || s.average_ticket || 0),
        customers: parseInt(s.unique_customers || s.customers_count || 0),
        cash: parseFloat(s.cash_total || 0),
        card: parseFloat(s.card_total || 0),
        items_sold: parseInt(s.items_sold || 0),
      });

      const orderList = ordRes.data?.data || ordRes.data || [];
      setRecentOrders(Array.isArray(orderList) ? orderList.slice(0, 20) : []);
    } catch {
      setKpi(null);
    } finally {
      setLoading(false);
    }
  }, [store?.id, period]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      {/* BACKDROP */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* DRAWER */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9991,
        width: 'min(560px, 100vw)',
        background: '#f8f7fc',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, #7B6FD0 0%, #5B50B0 100%)',
          color: '#fff',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Store size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Riepilogo Vendite</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{store?.name || 'Tutti i negozi'}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Period tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: period === p.id ? '#fff' : 'rgba(255,255,255,0.15)',
                  color: period === p.id ? '#7B6FD0' : 'rgba(255,255,255,0.85)',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
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
              {/* KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <KpiCard
                    icon={TrendingUp}
                    label="Totale Incassato"
                    value={fmt(kpi.revenue)}
                    color="#7B6FD0"
                    sub={kpi.orders > 0 ? `${fmtN(kpi.orders)} transazioni` : 'Nessuna vendita'}
                  />
                </div>
                <KpiCard icon={ShoppingBag} label="N° Scontrini" value={fmtN(kpi.orders)} color="#6C63AC" />
                <KpiCard icon={BarChart3} label="Scontrino Medio" value={fmt(kpi.avg_ticket)} color="#8B7FCC" />
                <KpiCard icon={Banknote} label="Contanti" value={fmt(kpi.cash)} color="#10b981" />
                <KpiCard icon={CreditCard} label="Carta / POS" value={fmt(kpi.card)} color="#3B82F6" />
                {kpi.customers > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <KpiCard icon={Users} label="Clienti Fidelizzati" value={fmtN(kpi.customers)} color="#F59E0B" />
                  </div>
                )}
              </div>

              {/* Recent Orders */}
              <div style={{
                background: '#fff', borderRadius: 14, padding: '16px',
                border: '1px solid #f0edf8', boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} color="#7B6FD0" />
                  Transazioni recenti
                </div>
                {recentOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
                    <Package size={36} style={{ opacity: 0.2, margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Nessuna transazione nel periodo</div>
                  </div>
                ) : (
                  recentOrders.map(o => <OrderRow key={o.id} order={o} />)
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <BarChart3 size={48} style={{ opacity: 0.15, margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Dati non disponibili</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Controlla la connessione o riprova</div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
