import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Trophy, Star, Medal, Zap, TrendingUp, Award, Crown, Users, ChevronRight } from 'lucide-react';

// ── Points calculation formula ──────────────────────────────────────────────
// 1 punto ogni €10 di vendita + bonus per obiettivi
const BADGE_TIERS = [
  { min: 0,    max: 999,   label: 'Bronzo',   icon: '🥉', color: '#b45309', bg: '#fef3c7' },
  { min: 1000, max: 4999,  label: 'Argento',  icon: '🥈', color: '#64748b', bg: '#f1f5f9' },
  { min: 5000, max: 19999, label: 'Oro',      icon: '🥇', color: '#b45309', bg: '#fffbeb' },
  { min: 20000,max: Infinity, label: 'Diamante', icon: '💎', color: '#6d28d9', bg: '#ede9fe' },
];

const getBadge = (pts) => BADGE_TIERS.find(t => pts >= t.min && pts <= t.max) || BADGE_TIERS[0];

export default function GamificationPage() {
  const { selectedStoreId, selectedStore, user } = useOutletContext();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin_cliente' || isSuperAdmin;

  const [leaderboard, setLeaderboard] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [period, setPeriod] = useState('month'); // month | quarter | year | all

  // ── Build leaderboard from orders ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { orders: ordersApi, employees: employeesApi } = await import('../api.jsx');

      const days = period === 'month' ? 30 : period === 'quarter' ? 90 : period === 'year' ? 365 : 3650;
      const params = { limit: 500 };
      if (selectedStoreId) params.store_id = selectedStoreId;

      const [ordRes, empRes] = await Promise.all([
        ordersApi.getOrders({ ...params, status: 'paid' }),
        import('../api.jsx').then(m => m.employees?.getAll ? m.employees.getAll({}) : Promise.resolve({ data: { data: [] } })),
      ]);

      const allOrders = ordRes.data?.data || [];
      const allEmps = empRes.data?.data || [];

      // Build stats per employee
      const statsMap = {};
      allOrders.forEach(o => {
        if (!o.employee_id && !o.cashier_id) return;
        const empId = o.employee_id || o.cashier_id;
        if (!statsMap[empId]) statsMap[empId] = { id: empId, orders: 0, revenue: 0, returns: 0 };
        statsMap[empId].orders++;
        statsMap[empId].revenue += o.grand_total || 0;
      });

      // Merge with employee names
      const lb = allEmps.map(emp => {
        const stats = statsMap[emp.id] || { orders: 0, revenue: 0, returns: 0 };
        const points = Math.floor(stats.revenue / 10) + (stats.orders * 2);
        return { ...emp, ...stats, points, badge: getBadge(points) };
      }).filter(e => e.points > 0 || isAdmin);

      lb.sort((a, b) => b.points - a.points);

      setLeaderboard(lb);

      // My stats (if dipendente)
      if (!isAdmin) {
        const me = lb.find(e => e.id === user?.employee_id || e.email === user?.email);
        setMyStats(me || null);
      }
    } catch (err) {
      console.error('Gamification load error:', err);
    } finally { setLoading(false); }
  }, [selectedStoreId, period, user, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#c9a227', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  );

  return (
    <div className="animate-v3" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0e1726 0%, #1e1b4b 50%, #312e81 100%)',
        borderRadius: 24, padding: '28px 32px', marginBottom: 24, color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(201,162,39,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 36 }}>🏆</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>Gamification Dipendenti</h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              {selectedStore ? selectedStore.name : 'Tutti i negozi'} · Periodo: {period === 'month' ? 'Questo mese' : period === 'quarter' ? 'Questo trimestre' : period === 'year' ? 'Quest\'anno' : 'Tutto il periodo'}
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[['month', '30gg'], ['quarter', 'Trimestre'], ['year', 'Anno'], ['all', 'Tutto']].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              background: period === v ? '#c9a227' : 'rgba(255,255,255,0.1)',
              color: period === v ? '#0e1726' : 'rgba(255,255,255,0.7)',
              border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>

        {/* Top 3 podium */}
        {leaderboard.length >= 3 && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, alignItems: 'flex-end' }}>
            {[leaderboard[1], leaderboard[0], leaderboard[2]].map((emp, idx) => {
              const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
              const heights = { 1: 100, 2: 80, 3: 65 };
              const emojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
              return (
                <div key={emp.id} style={{ textAlign: 'center', flex: 1, maxWidth: 160 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{emojis[rank]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.first_name || emp.name}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a227' }}>{emp.points.toLocaleString()}<span style={{ fontSize: 11 }}>pt</span></div>
                  <div style={{
                    height: heights[rank], background: rank === 1 ? '#c9a227' : rank === 2 ? '#94a3b8' : '#b45309',
                    borderRadius: '8px 8px 0 0', marginTop: 8, opacity: 0.7,
                  }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['leaderboard', '🏅 Classifica'], ['badges', '🎖 Badge'], ['rules', '📜 Regole Punti']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
            background: activeTab === id ? '#0e1726' : 'rgba(0,0,0,0.04)',
            color: activeTab === id ? '#c9a227' : '#64748b',
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── LEADERBOARD ── */}
      {activeTab === 'leaderboard' && (
        <div className="card-v3 overflow-hidden">
          <table className="table-v3">
            <thead><tr><th>#</th><th>Dipendente</th><th>Badge</th><th>Punti</th><th>Ordini</th><th>Fatturato</th></tr></thead>
            <tbody>
              {leaderboard.length > 0 ? leaderboard.map((emp, i) => (
                <tr key={emp.id} style={{ background: i < 3 ? `${['#fffbeb','#f8fafc','#fff7ed'][i]}55` : 'transparent' }}>
                  <td>
                    <span style={{ fontWeight: 900, fontSize: 16, color: ['#c9a227', '#64748b', '#b45309', '#94a3b8'][i] || '#94a3b8' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: emp.badge.bg, border: `2px solid ${emp.badge.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, color: emp.badge.color, fontSize: 14,
                      }}>
                        {((emp.first_name || emp.name || '?')[0]).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{emp.first_name || ''} {emp.last_name || emp.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{emp.store_name || emp.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ background: emp.badge.bg, color: emp.badge.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {emp.badge.icon} {emp.badge.label}
                    </span>
                  </td>
                  <td><strong style={{ fontSize: 16 }}>{emp.points.toLocaleString()}</strong></td>
                  <td>{emp.orders}</td>
                  <td style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(emp.revenue)}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#cbd5e1' }}>
                  Nessun dato disponibile. Inizia a registrare vendite con un operatore assegnato.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BADGES ── */}
      {activeTab === 'badges' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {BADGE_TIERS.map(tier => (
            <div key={tier.label} className="card-v3" style={{ padding: 24, textAlign: 'center', border: `2px solid ${tier.bg}` }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{tier.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: tier.color }}>{tier.label}</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>
                {tier.max === Infinity ? `${tier.min.toLocaleString()}+ punti` : `${tier.min.toLocaleString()} – ${tier.max.toLocaleString()} punti`}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                {tier.label === 'Bronzo' && 'Livello di partenza — buon lavoro!'}
                {tier.label === 'Argento' && 'Ottima crescita! Continua così.'}
                {tier.label === 'Oro' && 'Top performer — eccezionale!'}
                {tier.label === 'Diamante' && '💎 Leggenda del negozio — inarrivabile!'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RULES ── */}
      {activeTab === 'rules' && (
        <div className="card-v3" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 20 }}>Come si guadagnano i punti</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '💰', action: 'Vendita completata', points: '1 punto ogni €10 di vendita', color: '#16a34a' },
              { icon: '📦', action: 'Ordine processato', points: '+2 punti per ordine', color: '#4f46e5' },
              { icon: '🎯', action: 'Obiettivo mensile raggiunto', points: '+500 punti bonus', color: '#b45309' },
              { icon: '⬆️', action: 'Upsell confermato', points: '+50 punti extra', color: '#0891b2' },
              { icon: '✅', action: 'Zero resi nel mese', points: '+100 punti bonus', color: '#059669' },
            ].map(rule => (
              <div key={rule.action} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: '#f8fafc', borderRadius: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{rule.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{rule.action}</div>
                </div>
                <div style={{ fontWeight: 900, color: rule.color, fontSize: 15, flexShrink: 0 }}>{rule.points}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: '14px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac', fontSize: 13, color: '#166534' }}>
            <strong>Nota:</strong> I punti vengono calcolati automaticamente dalle vendite registrate nel POS con operatore assegnato tramite barcode.
          </div>
        </div>
      )}
    </div>
  );
}
