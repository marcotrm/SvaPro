import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trophy, Star, Medal, Save, CheckCircle2, AlertCircle, Zap, ShieldCheck, Users, Tag, Package } from 'lucide-react';
import { stores as storesApi } from '../api.jsx';

// ── Badge tiers ───────────────────────────────────────────────────────────────
const BADGE_TIERS = [
  { min: 0,     max: 999,      label: 'Bronzo',   icon: '🥉', color: '#b45309', bg: '#fef3c7' },
  { min: 1000,  max: 4999,     label: 'Argento',  icon: '🥈', color: '#64748b', bg: '#f1f5f9' },
  { min: 5000,  max: 19999,    label: 'Oro',      icon: '🥇', color: '#b45309', bg: '#fffbeb' },
  { min: 20000, max: Infinity, label: 'Diamante', icon: '💎', color: '#6d28d9', bg: '#ede9fe' },
];
const getBadge = (pts) => BADGE_TIERS.find(t => pts >= t.min && pts <= t.max) || BADGE_TIERS[0];

// ── Regole default ─────────────────────────────────────────────────────────────
// Regola 1: 1 punto per ogni euro di fatturato (1 pt / €1)
// Regola 2: X punti per ogni fidelity card (cliente) creata
// Regola 3: X punti se lo sconto supera la soglia impostata
// Regola 4: X punti se la vendita contiene almeno N pezzi
// Regola 5: X punti se la vendita include una QScare
const DEFAULT_RULES = {
  pts_per_euro:           1,    // R1: punti per euro di fatturato
  pts_per_fidelity:       50,   // R2: punti per ogni fidelity card creata
  pts_discount_threshold: 25,   // R3: soglia sconto (€) da superare
  pts_per_discount:       30,   // R3: punti se sconto > soglia
  min_items_qty:          5,    // R4: numero minimo pezzi in vendita
  pts_per_big_sale:       20,   // R4: punti se vendita ≥ min_items_qty pezzi
  pts_per_qscare:         40,   // R5: punti per ogni vendita con QScare
  pts_per_featured:       15,   // R6: punti per ogni prodotto preferito venduto
};

export default function GamificationPage() {
  const { selectedStoreId, selectedStore, user } = useOutletContext();
  const isSuperAdmin = user?.roles?.includes('superadmin') || user?.role === 'superadmin';
  const isAdmin = user?.roles?.includes('admin_cliente') || user?.role === 'admin_cliente' || isSuperAdmin;

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('leaderboard');
  const [period, setPeriod]           = useState('month');

  const [rules, setRules]           = useState(DEFAULT_RULES);
  const [editRules, setEditRules]   = useState(DEFAULT_RULES);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesMsg, setRulesMsg]     = useState('');
  const [rulesErr, setRulesErr]     = useState('');

  // ── Carica regole da tenant settings ───────────────────────────────────────
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
      setRulesMsg('Regole salvate!');
      setTimeout(() => setRulesMsg(''), 3000);
    } catch {
      setRulesErr('Errore durante il salvataggio.');
    } finally { setSavingRules(false); }
  };

  // ── Helper: date range ──────────────────────────────────────────────────────
  const getPeriodDates = (p) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const today = fmt(now);
    if (p === 'month')   return { date_from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: today };
    if (p === 'quarter') { const q = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1); return { date_from: fmt(q), date_to: today }; }
    if (p === 'year')    return { date_from: fmt(new Date(now.getFullYear(), 0, 1)), date_to: today };
    return {};
  };

  // ── Calcola punti da un singolo ordine con le regole attuali ──────────────
  const calcOrderPoints = useCallback((order, r) => {
    let pts = 0;
    const revenue      = parseFloat(order.grand_total)    || 0;
    const discountAmt  = parseFloat(order.discount_total) || 0;
    const lineCount    = parseInt(order.line_count)        || 0;
    const hasQscare    = !!order.has_qscare;
    const newCustomer  = !!order.new_customer_created;
    const featuredQty  = parseInt(order.featured_items_count) || 0;

    // R1 – 1 punto per ogni euro incassato
    pts += Math.floor(revenue * (r.pts_per_euro || 1));

    // R2 – Fidelity card nuova
    if (newCustomer) pts += (r.pts_per_fidelity || 0);

    // R3 – Sconto > soglia
    if (discountAmt > (r.pts_discount_threshold || 25)) pts += (r.pts_per_discount || 0);

    // R4 – Vendita con ≥ N pezzi
    if (lineCount >= (r.min_items_qty || 5)) pts += (r.pts_per_big_sale || 0);

    // R5 – QScare inclusa
    if (hasQscare) pts += (r.pts_per_qscare || 0);

    // R6 – Prodotti Preferiti (per ogni prodotto preferito venduto)
    pts += featuredQty * (r.pts_per_featured || 0);

    return pts;
  }, []);

  // ── Carica leaderboard ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { orders: ordersApi, employees: employeesApi } = await import('../api.jsx');
      const params = { limit: 500, ...getPeriodDates(period) };
      if (selectedStoreId) params.store_id = selectedStoreId;

      const [ordRes, empRes] = await Promise.all([
        ordersApi.getOrders({ ...params, status: 'paid' }),
        employeesApi?.getEmployees ? employeesApi.getEmployees({}) : Promise.resolve({ data: { data: [] } }),
      ]);

      const allOrders = ordRes.data?.data || [];
      const allEmps   = empRes.data?.data || [];

      // Agrega per dipendente
      const statsMap = {};
      allOrders.forEach(o => {
        const empId = o.sold_by_employee_id || o.employee_id;
        if (!empId) return;
        if (!statsMap[empId]) statsMap[empId] = {
          id: empId, orders: 0, revenue: 0, points: 0,
          pts_r1: 0, pts_r2: 0, pts_r3: 0, pts_r4: 0, pts_r5: 0, pts_r6: 0,
        };
        const s = statsMap[empId];
        s.orders++;
        s.revenue += parseFloat(o.grand_total) || 0;

        // Calcola singole regole per breakdown
        const r1 = Math.floor((parseFloat(o.grand_total) || 0) * (rules.pts_per_euro || 1));
        const r2 = o.new_customer_created  ? (rules.pts_per_fidelity || 0) : 0;
        const r3 = (parseFloat(o.discount_total) || 0) > (rules.pts_discount_threshold || 25) ? (rules.pts_per_discount || 0) : 0;
        const r4 = (parseInt(o.line_count) || 0) >= (rules.min_items_qty || 5) ? (rules.pts_per_big_sale || 0) : 0;
        const r5 = o.has_qscare ? (rules.pts_per_qscare || 0) : 0;
        const r6 = (parseInt(o.featured_items_count) || 0) * (rules.pts_per_featured || 0);
        s.pts_r1 += r1; s.pts_r2 += r2; s.pts_r3 += r3; s.pts_r4 += r4; s.pts_r5 += r5; s.pts_r6 += r6;
        s.points += r1 + r2 + r3 + r4 + r5 + r6;
      });

      const lb = allEmps.map(emp => {
        const stats = statsMap[emp.id] || { orders: 0, revenue: 0, points: 0, pts_r1:0, pts_r2:0, pts_r3:0, pts_r4:0, pts_r5:0, pts_r6:0 };
        const pts   = stats.points;
        return { ...emp, ...stats, points: pts, badge: getBadge(pts) };
      }).filter(e => e.points > 0 || isAdmin);

      lb.sort((a, b) => b.points - a.points);
      setLeaderboard(lb);
    } catch (err) {
      console.error('Gamification load error:', err);
    } finally { setLoading(false); }
  }, [selectedStoreId, rules, isAdmin, period, calcOrderPoints]);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  // ── Helper campo input per le regole ────────────────────────────────────────
  const RuleInput = ({ label, desc, icon, fieldKey, prefix, suffix, step = 1, sub }) => (
    <div style={{ background: '#f8fafc', borderRadius: 16, padding: '18px 20px', border: '1.5px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{label}</div>
          {desc && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
      {sub && <div style={{ marginBottom: 10 }}>{sub}</div>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span style={{ position: 'absolute', left: 12, fontWeight: 800, color: '#6366f1', fontSize: 14, pointerEvents: 'none' }}>{prefix}</span>}
        <input
          type="number" min="0" step={step}
          style={{
            width: '100%', padding: `12px ${suffix ? '60px' : '14px'} 12px ${prefix ? '28px' : '14px'}`,
            border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 18, fontWeight: 900,
            color: '#0f172a', outline: 'none', appearance: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          value={editRules[fieldKey]}
          onChange={e => setEditRules(r => ({ ...r, [fieldKey]: parseInt(e.target.value) || 0 }))}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
        />
        {suffix && <span style={{ position: 'absolute', right: 14, fontWeight: 700, color: '#94a3b8', fontSize: 12 }}>{suffix}</span>}
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#c9a227', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  );

  return (
    <div className="animate-v3" style={{ maxWidth: 920, margin: '0 auto', paddingBottom: 40 }}>

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
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[['month','30gg'],['quarter','Trimestre'],['year','Anno'],['all','Tutto']].map(([v,l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              background: period === v ? '#c9a227' : 'rgba(255,255,255,0.1)',
              color: period === v ? '#0e1726' : 'rgba(255,255,255,0.7)',
              border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
        {leaderboard.length >= 3 && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, alignItems: 'flex-end' }}>
            {[leaderboard[1], leaderboard[0], leaderboard[2]].map((emp, idx) => {
              const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
              const heights = { 1: 100, 2: 80, 3: 65 };
              const emojis  = { 1: '🥇', 2: '🥈', 3: '🥉' };
              return (
                <div key={emp.id} style={{ textAlign: 'center', flex: 1, maxWidth: 160 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{emojis[rank]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.first_name || emp.name}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a227' }}>{emp.points.toLocaleString()}<span style={{ fontSize: 11 }}>pt</span></div>
                  <div style={{ height: heights[rank], background: rank === 1 ? '#c9a227' : rank === 2 ? '#94a3b8' : '#b45309', borderRadius: '8px 8px 0 0', marginTop: 8, opacity: 0.7 }} />
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
          ['badges',      '🎖 Badge'],
          ['rules',       '📜 Regole Punti'],
          ...(isAdmin ? [['config', '⚙️ Configura Regole']] : []),
        ].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
            background: activeTab === id ? '#0e1726' : 'rgba(0,0,0,0.04)',
            color: activeTab === id ? '#c9a227' : '#64748b', transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── LEADERBOARD ── */}
      {activeTab === 'leaderboard' && (
        <div className="card-v3 overflow-hidden">
          <table className="table-v3">
            <thead><tr>
              <th>#</th><th>Dipendente</th><th>Badge</th><th>Punti Tot.</th>
              <th title="Punti da fatturato">💰</th>
              <th title="Punti da fidelity card">👤</th>
              <th title="Punti da sconto">🏷️</th>
              <th title="Punti da vendita voluminosa">📦</th>
              <th title="Punti da QScare">🛡</th>
              <th title="Punti da prodotti preferiti">⭐</th>
              <th>Ordini</th><th>Fatturato</th>
            </tr></thead>
            <tbody>
              {leaderboard.length > 0 ? leaderboard.map((emp, i) => (
                <tr key={emp.id} style={{ background: i < 3 ? `${['#fffbeb','#f8fafc','#fff7ed'][i]}55` : 'transparent' }}>
                  <td>
                    <span style={{ fontWeight: 900, fontSize: 16, color: ['#c9a227','#64748b','#b45309','#94a3b8'][i] || '#94a3b8' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
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
                  <td><strong style={{ fontSize: 16, color: '#4f46e5' }}>{emp.points.toLocaleString()}</strong></td>
                  <td style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>{(emp.pts_r1||0).toLocaleString()}</td>
                  <td style={{ color: '#0891b2', fontWeight: 700, fontSize: 12 }}>{(emp.pts_r2||0).toLocaleString()}</td>
                  <td style={{ color: '#d97706', fontWeight: 700, fontSize: 12 }}>{(emp.pts_r3||0).toLocaleString()}</td>
                  <td style={{ color: '#7c3aed', fontWeight: 700, fontSize: 12 }}>{(emp.pts_r4||0).toLocaleString()}</td>
                  <td style={{ color: '#0d9488', fontWeight: 700, fontSize: 12 }}>{(emp.pts_r5||0).toLocaleString()}</td>
                  <td style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12 }}>{(emp.pts_r6||0).toLocaleString()}</td>
                  <td>{emp.orders}</td>
                  <td style={{ color: '#16a34a', fontWeight: 700 }}>{fmt(emp.revenue)}</td>
                </tr>
              )) : (
                <tr><td colSpan="12" style={{ textAlign: 'center', padding: '40px', color: '#cbd5e1' }}>
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
                {tier.label === 'Bronzo'   && 'Livello di partenza — buon lavoro!'}
                {tier.label === 'Argento'  && 'Ottima crescita! Continua così.'}
                {tier.label === 'Oro'      && 'Top performer — eccezionale!'}
                {tier.label === 'Diamante' && '💎 Leggenda del negozio — inarrivabile!'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REGOLE (visualizzazione pubblica) ── */}
      {activeTab === 'rules' && (
        <div className="card-v3" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 20 }}>Come si guadagnano i punti</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '💰', label: 'Fatturato vendita',                     color: '#16a34a', value: `${rules.pts_per_euro} pt per ogni €1 incassato`,                                       desc: 'La regola base — più vendi, più punti ottieni' },
              { icon: '👤', label: 'Nuova fidelity card creata',             color: '#0891b2', value: `+${rules.pts_per_fidelity} pt per ogni nuovo cliente`,                               desc: 'Ogni nuovo profilo cliente registrato conta!' },
              { icon: '🏷️', label: `Sconto > €${rules.pts_discount_threshold}`, color: '#d97706', value: `+${rules.pts_per_discount} pt per vendita scontata`,                           desc: `Quando lo sconto applicato supera €${rules.pts_discount_threshold}` },
              { icon: '📦', label: `Vendita ≥ ${rules.min_items_qty} pezzi`, color: '#7c3aed', value: `+${rules.pts_per_big_sale} pt per vendita voluminosa`,                               desc: `Se la vendita include almeno ${rules.min_items_qty} prodotti` },
              { icon: '🛡',  label: 'Vendita con QScare inclusa',            color: '#0d9488', value: `+${rules.pts_per_qscare} pt per ogni QScare venduta`,                               desc: 'Ogni volta che viene aggiunta la garanzia QScare' },
              { icon: '⭐',  label: 'Prodotto Preferito venduto',             color: '#f59e0b', value: `+${rules.pts_per_featured} pt per ogni prodotto preferito`,                         desc: 'Per ogni prodotto marcato come "Preferito" nel catalogo presente nella vendita' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: '#f8fafc', borderRadius: 14, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{r.label}</div>
                  {r.desc && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.desc}</div>}
                </div>
                <div style={{
                  background: r.color + '18', color: r.color, fontWeight: 900, fontSize: 13,
                  padding: '6px 14px', borderRadius: 20, flexShrink: 0, border: `1.5px solid ${r.color}40`,
                }}>{r.value}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <span style={{ fontSize: 28 }}>⚙️</span>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, color: '#0f172a' }}>Configura Regole Gamification</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Le modifiche si riflettono immediatamente su classifica e punteggi.</p>
            </div>
          </div>

          <form onSubmit={handleSaveRules}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Regola 1 — Fatturato */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  REGOLA 1 · Fatturato
                </div>
                <RuleInput
                  fieldKey="pts_per_euro"
                  icon="💰"
                  label="Punti per ogni €1 di fatturato"
                  desc="Valore consigliato: 1 (un punto per euro)"
                  suffix="pt / €1"
                  step={1}
                />
              </div>

              {/* Regola 2 — Fidelity card */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  REGOLA 2 · Fidelity Card
                </div>
                <RuleInput
                  fieldKey="pts_per_fidelity"
                  icon="👤"
                  label="Punti per ogni nuova fidelity card creata"
                  desc="Assegnati ogni volta che viene registrato un nuovo cliente"
                  suffix="pt / cliente"
                  step={5}
                />
              </div>

              {/* Regola 3 — Sconto */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  REGOLA 3 · Sconto Elevato
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <RuleInput
                    fieldKey="pts_discount_threshold"
                    icon="🏷️"
                    label="Soglia sconto minimo (€)"
                    desc="Lo sconto deve superare questo importo"
                    prefix="€"
                    suffix="soglia"
                    step={5}
                  />
                  <RuleInput
                    fieldKey="pts_per_discount"
                    icon="⭐"
                    label="Punti assegnati se superata"
                    desc="Bonus piatto quando lo sconto supera la soglia"
                    suffix="pt bonus"
                    step={5}
                  />
                </div>
              </div>

              {/* Regola 4 — Vendita voluminosa */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  REGOLA 4 · Vendita Voluminosa
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <RuleInput
                    fieldKey="min_items_qty"
                    icon="📦"
                    label="Numero minimo pezzi in vendita"
                    desc="La vendita deve contenere almeno N prodotti"
                    suffix="pz min."
                    step={1}
                  />
                  <RuleInput
                    fieldKey="pts_per_big_sale"
                    icon="⭐"
                    label="Punti assegnati se raggiunto"
                    desc="Bonus piatto per vendita con molti pezzi"
                    suffix="pt bonus"
                    step={5}
                  />
                </div>
              </div>

              {/* Regola 5 — QScare */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  REGOLA 5 · QScare
                </div>
                <RuleInput
                  fieldKey="pts_per_qscare"
                  icon="🛡"
                  label="Punti per ogni vendita con QScare inclusa"
                  desc="Assegnati ogni volta che una garanzia QScare viene aggiunta"
                  suffix="pt / QScare"
                  step={5}
                />
              </div>

              {/* Regola 6 — Prodotto Preferito */}
              <div style={{ padding: '4px 0 8px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  REGOLA 6 · Prodotto Preferito
                </div>
                <RuleInput
                  fieldKey="pts_per_featured"
                  icon="⭐"
                  label="Punti per ogni prodotto preferito venduto"
                  desc='Per ogni articolo con flag "Preferito" nella vendita. Attiva il flag dal Catalogo Prodotti.'
                  suffix="pt / prodotto"
                  step={5}
                />
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#fffbeb', borderRadius: 10, fontSize: 12, color: '#92400e', border: '1px solid #fde68a' }}>
                  💡 Per marcare un prodotto come preferito, vai su <strong>Catalogo → Prodotti</strong> e attiva il toggle ⭐ sul prodotto.
                </div>
              </div>

            </div>

            {/* Anteprima formula */}
            <div style={{ marginTop: 24, padding: '18px 22px', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 16, color: '#fff' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📊 Esempio calcolo punti</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                {[
                  { label: 'Vendita €100', pts: Math.floor(100 * editRules.pts_per_euro), icon: '💰', color: '#86efac' },
                  { label: '+ Fidelity',   pts: editRules.pts_per_fidelity,               icon: '👤', color: '#7dd3fc' },
                  { label: '+ Sconto >€25',pts: editRules.pts_per_discount,               icon: '🏷️', color: '#fcd34d' },
                  { label: `+ ≥${editRules.min_items_qty}pz`, pts: editRules.pts_per_big_sale, icon: '📦', color: '#c4b5fd' },
                  { label: '+ QScare',     pts: editRules.pts_per_qscare,                 icon: '🛡', color: '#5eead4' },
                  { label: '+ 1 Preferito',pts: editRules.pts_per_featured,               icon: '⭐', color: '#fde68a' },
                ].map((item, i) => (
                  <div key={i} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 8px' }}>
                    <div style={{ fontSize: 18 }}>{item.icon}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.3 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: item.color, marginTop: 4 }}>{item.pts}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>pt</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, textAlign: 'center', color: '#c9a227', fontWeight: 900, fontSize: 15 }}>
                Totale esempio: {Math.floor(100 * editRules.pts_per_euro) + editRules.pts_per_fidelity + editRules.pts_per_discount + editRules.pts_per_big_sale + editRules.pts_per_qscare + editRules.pts_per_featured} punti
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
