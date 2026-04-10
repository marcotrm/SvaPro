import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trophy, Star, Medal, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { stores as storesApi } from '../api.jsx';

// ── Badge tiers ──────────────────────────────────────────────────────────────
const BADGE_TIERS = [
  { min: 0,    max: 999,   label: 'Bronzo',   icon: '🥉', color: '#b45309', bg: '#fef3c7' },
  { min: 1000, max: 4999,  label: 'Argento',  icon: '🥈', color: '#64748b', bg: '#f1f5f9' },
  { min: 5000, max: 19999, label: 'Oro',      icon: '🥇', color: '#b45309', bg: '#fffbeb' },
  { min: 20000,max: Infinity, label: 'Diamante', icon: '💎', color: '#6d28d9', bg: '#ede9fe' },
];

const getBadge = (pts) => BADGE_TIERS.find(t => pts >= t.min && pts <= t.max) || BADGE_TIERS[0];

// Regole di default
const DEFAULT_RULES = {
  euros_per_point: 10,       // 1 punto ogni X euro di vendita
  points_per_order: 2,       // punti bonus per ordine completato
  bonus_monthly_goal: 500,   // bonus per obiettivo mensile raggiunto
  bonus_upsell: 50,          // bonus per upsell
  bonus_zero_returns: 100,   // bonus zero resi nel mese
};

export default function GamificationPage() {
  const { selectedStoreId, selectedStore, user } = useOutletContext();
  const isSuperAdmin = user?.roles?.includes('superadmin') || user?.role === 'superadmin';
  const isAdmin = user?.roles?.includes('admin_cliente') || user?.role === 'admin_cliente' || isSuperAdmin;

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [period, setPeriod] = useState('month');

  // Regole (caricate dalle impostazioni tenant)
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [editRules, setEditRules] = useState(DEFAULT_RULES);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMsg, setRulesMsg] = useState('');
  const [rulesErr, setRulesErr] = useState('');

  // ── Carica regole dalle impostazioni tenant ─────────────────────────────────
  useEffect(() => {
    storesApi.getTenantSettings().then(res => {
      const sj = res.data?.data?.settings_json;
      if (sj?.gamification_rules) {
        const r = { ...DEFAULT_RULES, ...sj.gamification_rules };
        setRules(r);
        setEditRules(r);
      }
    }).catch(() => {});
  }, []);

  // ── Salva regole ────────────────────────────────────────────────────────────
  const handleSaveRules = async (e) => {
    e.preventDefault();
    setSavingRules(true); setRulesMsg(''); setRulesErr('');
    try {
      await storesApi.updateTenantSettings({ settings_json: { gamification_rules: editRules } });
      setRules({ ...editRules });
      setRulesMsg('Regole salvate correttamente!');
      setTimeout(() => setRulesMsg(''), 3000);
    } catch {
      setRulesErr('Errore durante il salvataggio.');
    } finally { setSavingRules(false); }
  };

  // ── Carica leaderboard ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { orders: ordersApi, employees: employeesApi } = await import('../api.jsx');
      const params = { limit: 500 };
      if (selectedStoreId) params.store_id = selectedStoreId;

      const [ordRes, empRes] = await Promise.all([
        ordersApi.getOrders({ ...params, status: 'paid' }),
        employeesApi?.getAll ? employeesApi.getAll({}) : Promise.resolve({ data: { data: [] } }),
      ]);

      const allOrders = ordRes.data?.data || [];
      const allEmps = empRes.data?.data || [];

      const statsMap = {};
      allOrders.forEach(o => {
        const empId = o.employee_id || o.cashier_id;
        if (!empId) return;
        if (!statsMap[empId]) statsMap[empId] = { id: empId, orders: 0, revenue: 0 };
        statsMap[empId].orders++;
        statsMap[empId].revenue += o.grand_total || 0;
      });

      const lb = allEmps.map(emp => {
        const stats = statsMap[emp.id] || { orders: 0, revenue: 0 };
        const pts = Math.floor(stats.revenue / (rules.euros_per_point || 10))
                  + (stats.orders * (rules.points_per_order || 2));
        return { ...emp, ...stats, points: pts, badge: getBadge(pts) };
      }).filter(e => e.points > 0 || isAdmin);

      lb.sort((a, b) => b.points - a.points);
      setLeaderboard(lb);
    } catch (err) {
      console.error('Gamification load error:', err);
    } finally { setLoading(false); }
  }, [selectedStoreId, rules, isAdmin]);

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
              {selectedStore ? selectedStore.name : 'Tutti i negozi'} · {period === 'month' ? 'Questo mese' : period === 'quarter' ? 'Trimestre' : period === 'year' ? "Quest'anno" : 'Tutto il periodo'}
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

        {/* Podio top 3 */}
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
        {[
          ['leaderboard', '🏅 Classifica'],
          ['badges', '🎖 Badge'],
          ['rules', '📜 Regole Punti'],
          ...(isAdmin ? [['config', '⚙️ Configura Regole']] : []),
        ].map(([id, label]) => (
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
                  Nessun dato. Registra vendite con operatore assegnato via barcode.
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

      {/* ── REGOLE (visualizzazione) ── */}
      {activeTab === 'rules' && (
        <div className="card-v3" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 20 }}>Come si guadagnano i punti</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '💰', label: 'Vendita completata',          value: `1 punto ogni €${rules.euros_per_point}`,    color: '#16a34a' },
              { icon: '📦', label: 'Ordine processato',           value: `+${rules.points_per_order} pt per ordine`,   color: '#4f46e5' },
              { icon: '🎯', label: 'Obiettivo mensile raggiunto', value: `+${rules.bonus_monthly_goal} pt bonus`,     color: '#b45309' },
              { icon: '⬆️', label: 'Upsell confermato',          value: `+${rules.bonus_upsell} pt extra`,           color: '#0891b2' },
              { icon: '✅', label: 'Zero resi nel mese',         value: `+${rules.bonus_zero_returns} pt bonus`,     color: '#059669' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: '#f8fafc', borderRadius: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>{r.label}</div>
                <div style={{ fontWeight: 900, color: r.color, fontSize: 15, flexShrink: 0 }}>{r.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: '14px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac', fontSize: 13, color: '#166534' }}>
            <strong>Nota:</strong> I punti vengono calcolati automaticamente dalle vendite registrate nel POS con operatore assegnato tramite barcode.
          </div>
        </div>
      )}

      {/* ── CONFIGURAZIONE REGOLE (solo admin) ── */}
      {activeTab === 'config' && isAdmin && (
        <div className="card-v3" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 28 }}>⚙️</span>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, color: '#0f172a' }}>Configura Regole Gamification</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Le modifiche si riflettono immediatamente su classifica e punteggi.</p>
            </div>
          </div>

          <form onSubmit={handleSaveRules}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Euro per punto */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  💰 Euro per 1 punto (vendita)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 700 }}>€</span>
                  <input
                    type="number" min="1" step="1"
                    style={{ width: '100%', padding: '12px 14px 12px 32px', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 15, fontWeight: 700, outline: 'none' }}
                    value={editRules.euros_per_point}
                    onChange={e => setEditRules(r => ({ ...r, euros_per_point: parseInt(e.target.value) || 10 }))}
                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Es: 10 → 1 punto ogni €10 di vendita</p>
              </div>

              {/* Punti per ordine */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  📦 Punti bonus per ordine completato
                </label>
                <input
                  type="number" min="0" step="1"
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 15, fontWeight: 700, outline: 'none' }}
                  value={editRules.points_per_order}
                  onChange={e => setEditRules(r => ({ ...r, points_per_order: parseInt(e.target.value) || 0 }))}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Bonus piatto per ogni transazione registrata</p>
              </div>

              {/* Bonus obiettivo mensile */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  🎯 Bonus obiettivo mensile raggiunto
                </label>
                <input
                  type="number" min="0" step="10"
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 15, fontWeight: 700, outline: 'none' }}
                  value={editRules.bonus_monthly_goal}
                  onChange={e => setEditRules(r => ({ ...r, bonus_monthly_goal: parseInt(e.target.value) || 0 }))}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Bonus upsell */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  ⬆️ Bonus upsell confermato
                </label>
                <input
                  type="number" min="0" step="5"
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 15, fontWeight: 700, outline: 'none' }}
                  value={editRules.bonus_upsell}
                  onChange={e => setEditRules(r => ({ ...r, bonus_upsell: parseInt(e.target.value) || 0 }))}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Bonus zero resi */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  ✅ Bonus zero resi nel mese
                </label>
                <input
                  type="number" min="0" step="10"
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 15, fontWeight: 700, outline: 'none' }}
                  value={editRules.bonus_zero_returns}
                  onChange={e => setEditRules(r => ({ ...r, bonus_zero_returns: parseInt(e.target.value) || 0 }))}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

            </div>

            {/* Anteprima formula */}
            <div style={{ marginTop: 24, padding: '16px 20px', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 14, color: '#fff' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Anteprima formula punti</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#c9a227', fontFamily: 'monospace' }}>
                punti = ⌊ fatturato ÷ {editRules.euros_per_point} ⌋ + ( ordini × {editRules.points_per_order} )
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                Es: €{(editRules.euros_per_point * 50).toLocaleString()} di vendita + 10 ordini = {50 + 10 * editRules.points_per_order} punti base
              </div>
            </div>

            {rulesMsg && <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={16} /> {rulesMsg}</div>}
            {rulesErr && <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2', borderRadius: 10, color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle size={16} /> {rulesErr}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="submit" disabled={savingRules} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #4f46e5, #6d28d9)', color: '#fff',
                fontSize: 14, fontWeight: 700, boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
              }}>
                <Save size={16} /> {savingRules ? 'Salvataggio...' : 'Salva Regole'}
              </button>
              <button type="button" onClick={() => setEditRules(DEFAULT_RULES)} style={{
                padding: '12px 20px', borderRadius: 12, border: '2px solid #e2e8f0',
                background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Ripristina Defaults
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
