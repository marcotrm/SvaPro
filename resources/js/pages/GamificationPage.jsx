import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { stores as storesApi, gamification as gamApi } from '../api.jsx';

// ── Badge tiers (dinamiche in base alle regole configurate) ──────────────────
const DEFAULT_BADGE_THRESHOLDS = { silver: 1000, gold: 5000, diamond: 20000 };
const getBadgeTiers = (rules = {}) => [
  { threshold: 0,                                       label: 'Novizio',  icon: '🔰', color: '#334155', bg: '#f8fafc' },
  { threshold: rules.badge_bronze_pts  ?? 100,          label: 'Bronzo',   icon: '🥉', color: '#b45309', bg: '#fef3c7' },
  { threshold: rules.badge_silver_pts  ?? 1000,         label: 'Argento',  icon: '🥈', color: '#64748b', bg: '#f1f5f9' },
  { threshold: rules.badge_gold_pts    ?? 5000,         label: 'Oro',      icon: '🥇', color: '#b45309', bg: '#fffbeb' },
  { threshold: rules.badge_diamond_pts ?? 20000,        label: 'Diamante', icon: '💎', color: '#6d28d9', bg: '#ede9fe' },
];
const getBadge = (pts, tiers) => [...(tiers || getBadgeTiers())].reverse().find(t => pts >= t.threshold) || { label: 'Novizio', icon: '🔰', color: '#334155', bg: '#f8fafc', threshold: 0 };

// ── Regole default ─────────────────────────────────────────────────────────────
const DEFAULT_RULES = {
  pts_per_euro:           1,    // R1: punti per euro di fatturato
  pts_per_fidelity:       50,   // R2: punti per ogni fidelity card creata
  pts_receipt_threshold:  25,   // R3: soglia SCONTRINO (totale >= X) per bonus
  pts_per_discount:       30,   // R3: punti se scontrino >= soglia
  min_items_qty:          5,    // R4: numero minimo pezzi in vendita
  pts_per_big_sale:       20,   // R4: punti se vendita >= min_items_qty pezzi
  pts_per_qscare:         40,   // R5: punti per ogni vendita con QScare
  pts_per_featured:       15,   // R6: punti per ogni prodotto preferito venduto
  pts_late_penalty:       50,   // R7: punti sottratti per ogni ritardo (valore positivo)
  badge_bronze_pts:       100,  // Soglia punti TOTALI per badge Bronzo
  badge_silver_pts:       1000, // Soglia punti TOTALI per badge Argento
  badge_gold_pts:         5000, // Soglia punti TOTALI per badge Oro
  badge_diamond_pts:      20000,// Soglia punti TOTALI per badge Diamante
};

// ── RuleInput: componente FUORI da GamificationPage per evitare rimount al re-render
// (definirlo dentro causerebbe la perdita del focus dopo ogni carattere digitato)
function RuleInput({ label, desc, icon, prefix, suffix, step = 1, sub, value, onChange, color = '#6366f1' }) {
  const [raw, setRaw] = React.useState(String(value ?? ''));

  React.useEffect(() => { setRaw(String(value ?? '')); }, [value]);

  const commit = () => {
    const n = parseInt(raw) || 0;
    setRaw(String(n));
    if (n !== value) onChange(n);
  };

  return (
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
        {prefix && <span style={{ position: 'absolute', left: 12, fontWeight: 800, color, fontSize: 14, pointerEvents: 'none' }}>{prefix}</span>}
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          style={{
            width: '100%', padding: `12px ${suffix ? '60px' : '14px'} 12px ${prefix ? '28px' : '14px'}`,
            border: '2px solid #e2e8f0', borderRadius: 12, fontSize: 18, fontWeight: 900,
            color: '#0f172a', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
          }}
          value={raw}
          onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={e => e.target.style.borderColor = color}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; commit(); }}
        />
        {suffix && <span style={{ position: 'absolute', right: 14, fontWeight: 700, color: '#94a3b8', fontSize: 12 }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function GamificationPage() {
  const { selectedStoreId, selectedStore, user } = useOutletContext();
  const isSuperAdmin = user?.roles?.includes('superadmin') || user?.role === 'superadmin';
  const isAdmin = user?.roles?.includes('admin_cliente') || user?.role === 'admin_cliente' || isSuperAdmin;

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('leaderboard');
  const [period, setPeriod]           = useState('month');
  const [customFrom, setCustomFrom]   = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [customTo,   setCustomTo]     = useState(() => new Date().toISOString().slice(0,10));
  const [selectedMonthStr, setSelectedMonthStr] = useState(() => new Date().toISOString().slice(0,7));

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

  // Tiers badge calcolate in base alle regole correnti
  const badgeTiers = getBadgeTiers(rules);
  const editBadgeTiers = getBadgeTiers(editRules);

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

    // R3 – punti se totale scontrino >= soglia
    const receiptThreshold = r.pts_receipt_threshold ?? r.pts_discount_threshold ?? 25;
    if (revenue >= receiptThreshold) pts += (r.pts_per_discount || 0);

    // R4 – Vendita con ≥ N pezzi
    if (lineCount >= (r.min_items_qty || 5)) pts += (r.pts_per_big_sale || 0);

    // R5 – QScare inclusa
    if (hasQscare) pts += (r.pts_per_qscare || 0);

    // R6 – Prodotti Preferiti (per ogni prodotto preferito venduto)
    pts += featuredQty * (r.pts_per_featured || 0);

    return pts;
  }, []);

  // ── Carica leaderboard dal ledger reale ────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { period };
      if (period === 'custom') {
        params.date_from = customFrom;
        params.date_to   = customTo;
      } else if (period === 'specific_month' && selectedMonthStr) {
        params.period = 'custom';
        const [y, m] = selectedMonthStr.split('-');
        const lastDay = new Date(y, parseInt(m), 0).getDate();
        params.date_from = `${y}-${m}-01`;
        params.date_to   = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      }
      if (selectedStoreId) params.store_id = selectedStoreId;

      const res = await gamApi.getLeaderboard(params);
      const data = res.data?.data || [];

      const lb = data.map(emp => ({
        ...emp,
        id:     emp.employee_id,
        points: Math.max(0, emp.points || 0),
        badge:  getBadge(Math.max(0, emp.points || 0), badgeTiers),
      }));

      setLeaderboard(lb);
    } catch (err) {
      console.error('Gamification load error:', err);
    } finally { setLoading(false); }
  }, [selectedStoreId, period, customFrom, customTo, selectedMonthStr]);

  useEffect(() => { loadData(); }, [loadData]);

  const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const fmtPts = n => Number(n || 0).toLocaleString('it-IT');

  // RuleInput ora ??definito FUORI dal componente = nessun rimount su re-render
  const ruleInputProps = (fieldKey) => ({
    value: editRules[fieldKey] ?? 0,
    onChange: (val) => setEditRules(r => ({ ...r, [fieldKey]: val })),
  });

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
              {selectedStore ? selectedStore.name : 'Tutti i negozi'} · {period === 'month' ? 'Questo mese' : period === 'quarter' ? 'Trimestre' : period === 'year' ? "Quest'anno" : period === 'specific_month' ? `Storico: ${selectedMonthStr}` : period === 'custom' ? `Dal ${customFrom} al ${customTo}` : 'Tutto il periodo'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['month','Questo Mese'],['specific_month','📅 Mese Storico'],['all','Da Sempre']].map(([v,l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              background: period === v ? '#c9a227' : 'rgba(255,255,255,0.1)',
              color: period === v ? '#0e1726' : 'rgba(255,255,255,0.7)',
              border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>{l}</button>
          ))}
          {period === 'specific_month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '4px 12px' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Mese:</span>
              <input type="month" value={selectedMonthStr} onChange={e => setSelectedMonthStr(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer' }} />
            </div>
          )}
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
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              {leaderboard.length} dipendenti in classifica
            </span>
            <button onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
              <RefreshCw size={13} /> Aggiorna
            </button>
          </div>
          <table className="table-v3">
            <thead><tr>
              <th style={{ width: 40 }}>#</th>
              <th>Dipendente</th>
              <th>Regole Punti</th>
              <th style={{ textAlign: 'right' }}>Punti Totali</th>
            </tr></thead>
            <tbody>
              {leaderboard.length > 0 ? leaderboard.map((emp, i) => (
                <tr key={emp.employee_id || emp.id} style={{ background: i < 3 ? `${['rgba(201,162,39,0.06)','rgba(100,116,139,0.05)','rgba(180,83,9,0.04)'][i]}` : 'transparent' }}>
                  <td>
                    <span style={{ fontWeight: 900, fontSize: 16, color: ['#c9a227','#64748b','#b45309'][i] || '#94a3b8' }}>
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
                        {((emp.first_name || emp.employee_name || '?')[0]).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{emp.first_name} {emp.last_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{emp.employee_name}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {emp.breakdown && Object.keys(emp.breakdown).length > 0 && (
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                            {emp.breakdown.euro > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="Fatturato"><span style={{ fontSize: 20 }}>??</span><span style={{ fontSize: 12, fontWeight: 800, color: '#4f46e5', marginTop: 2 }}>{emp.breakdown.euro}</span></div>}
                            {emp.breakdown.fidelity > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="Nuovi clienti"><span style={{ fontSize: 20 }}>👤</span><span style={{ fontSize: 12, fontWeight: 800, color: '#0891b2', marginTop: 2 }}>{emp.breakdown.fidelity}</span></div>}
                            {emp.breakdown.discount > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="Scontrini alti"><span style={{ fontSize: 20 }}>🏷️</span><span style={{ fontSize: 12, fontWeight: 800, color: '#d97706', marginTop: 2 }}>{emp.breakdown.discount}</span></div>}
                            {emp.breakdown.big_sale > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="Pezzi Multipli"><span style={{ fontSize: 20 }}>??</span><span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>{emp.breakdown.big_sale}</span></div>}
                            {emp.breakdown.qscare > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="QScare"><span style={{ fontSize: 20 }}>🛡</span><span style={{ fontSize: 12, fontWeight: 800, color: '#0d9488', marginTop: 2 }}>{emp.breakdown.qscare}</span></div>}
                            {emp.breakdown.featured > 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="Preferiti"><span style={{ fontSize: 20 }}>⭐</span><span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>{emp.breakdown.featured}</span></div>}
                            {emp.breakdown.late_penalty < 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }} title="Penalità ritardo"><span style={{ fontSize: 20 }}>⏰</span><span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginTop: 2 }}>{emp.breakdown.late_penalty}</span></div>}
                        </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 }}>
                      <strong style={{ fontSize: 24, color: '#0f172a', fontWeight: 900 }}>{fmtPts(emp.points)}</strong>
                      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>pt</span>
                    </div>
                    {(() => { 
                      const tiers = badgeTiers; 
                      const curItem = [...tiers].reverse().find(t => emp.points >= t.threshold) || tiers[0];
                      const curIdx = tiers.findIndex(t => t.label === curItem.label);
                      const next = tiers[curIdx+1]; 
                      if (!next) return null; 
                      const curMin = curItem.threshold;
                      const nextMin = next.threshold;
                      const pct = Math.min(100, Math.max(0, ((emp.points - curMin) / (nextMin - curMin)) * 100)); 
                      return (
                        <div style={{ marginTop: 6, height: 6, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden', width: 120, position: 'relative', marginLeft: 'auto' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: emp.badge.color, borderRadius: 99, transition: 'width 0.5s' }} />
                        </div>
                      ); 
                    })()}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '48px 20px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Nessun punteggio per il periodo selezionato</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                    I punti vengono assegnati automaticamente quando si effettua una vendita dal POS
                    con un <strong>operatore assegnato tramite scansione barcode</strong>.
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BADGES ── */}
      {activeTab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {badgeTiers.map((tier, i) => (
              <div key={tier.label} className="card-v3" style={{ padding: 24, textAlign: 'center', border: `2px solid ${tier.bg}` }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{tier.icon}</div>
                <div style={{ fontWeight: 900, fontSize: 20, color: tier.color }}>{tier.label}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>
                  {tier.threshold === 0 ? 'Livello di partenza' : `Raggiunto a ${tier.threshold.toLocaleString('it-IT')} punti`}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  {tier.label === 'Novizio'  && 'Benvenuto nel programma!'}
                  {tier.label === 'Bronzo'   && 'Livello iniziale — buon lavoro!'}
                  {tier.label === 'Argento'  && 'Ottima crescita! Continua cos�.'}
                  {tier.label === 'Oro'      && 'Top performer — eccezionale!'}
                  {tier.label === 'Diamante' && '💎 Leggenda del negozio!'}
                </div>
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="card-v3" style={{ padding: 20, background: 'rgba(99,102,241,0.04)', border: '1.5px solid rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>⚙️ Configura soglie badge (vai su “Configura Regole” per modificarle)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[['badge_bronze_pts','🥉 Bronzo'],['badge_silver_pts','🥈 Argento'],['badge_gold_pts','🥇 Oro'],['badge_diamond_pts','💎 Diamante']].map(([k, label]) => (
                  <div key={k} style={{ textAlign: 'center', padding: '14px 10px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{(rules[k] ?? DEFAULT_RULES[k]).toLocaleString('it-IT')}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>punti richiesti</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="card-v3" style={{ padding: 28 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 20 }}>Come si guadagnano i punti</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '??', label: 'Fatturato vendita',                          color: '#16a34a', value: `${rules.pts_per_euro} pt per ogni €1 incassato`,                                              desc: 'La regola base — pi??vendi, pi??punti ottieni' },
              { icon: '👤', label: 'Nuova fidelity card creata',                  color: '#0891b2', value: `+${rules.pts_per_fidelity} pt per ogni nuovo cliente`,                                        desc: 'Ogni nuovo profilo cliente registrato conta!' },
              { icon: '🛋️', label: `Scontrino ≥ €${rules.pts_receipt_threshold ?? rules.pts_discount_threshold ?? 25}`, color: '#d97706', value: `+${rules.pts_per_discount} pt per vendita`,  desc: `Quando il totale scontrino supera €${rules.pts_receipt_threshold ?? rules.pts_discount_threshold ?? 25}` },
              { icon: '??', label: `Vendita ≥ ${rules.min_items_qty} pezzi`,    color: '#7c3aed', value: `+${rules.pts_per_big_sale} pt per vendita voluminosa`,                                        desc: `Se la vendita include almeno ${rules.min_items_qty} prodotti` },
              { icon: '🛡',  label: 'Vendita con QScare inclusa',                color: '#0d9488', value: `+${rules.pts_per_qscare} pt per ogni QScare venduta`,                                        desc: 'Ogni volta che viene aggiunta la garanzia QScare' },
              { icon: '⭐',  label: 'Prodotto Preferito venduto',                  color: '#f59e0b', value: `+${rules.pts_per_featured} pt per ogni prodotto preferito`,                                    desc: 'Per ogni prodotto marcato come "Preferito" nel catalogo' },
              { icon: '⏰',  label: 'Penaltà Ritardo',                              color: '#ef4444', value: `-${rules.pts_late_penalty ?? 50} pt per ogni ritardo`,                                       desc: 'Punti sottratti automaticamente ad ogni ritardo rilevato dalla timbratura' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: '#f8fafc', borderRadius: 14, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{r.label}</div>
                  {r.desc && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.desc}</div>}
                </div>
                <div style={{ background: r.color + '18', color: r.color, fontWeight: 900, fontSize: 13, padding: '6px 14px', borderRadius: 20, flexShrink: 0, border: `1.5px solid ${r.color}40` }}>{r.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: '14px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac', fontSize: 13, color: '#166534' }}>
            <strong>Nota:</strong> I punti vengono calcolati automaticamente dalle vendite registrate nel POS con operatore assegnato tramite barcode. La penaltà ritardo si attiva dalla timbratura.
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
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 1 · Fatturato</div>
                <RuleInput fieldKey="pts_per_euro" icon="??" label="Punti per ogni €1 di fatturato" desc="Valore consigliato: 1 (un punto per euro)" suffix="pt / €1" step={1} {...ruleInputProps('pts_per_euro')} />
              </div>

              {/* Regola 2 — Fidelity card */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 2 · Fidelity Card</div>
                <RuleInput icon="👤" label="Punti per ogni nuova fidelity card creata" desc="Assegnati ogni volta che viene registrato un nuovo cliente" suffix="pt / cliente" step={5} {...ruleInputProps('pts_per_fidelity')} />
              </div>

              {/* Regola 3 — Scontrino */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 3 · Scontrino Elevato</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <RuleInput icon="🛋️" label="Soglia totale scontrino (€)" desc="Lo scontrino deve essere pari o superiore a questo importo" prefix="€" suffix="soglia" step={5} color="#d97706" {...ruleInputProps('pts_receipt_threshold')} />
                  <RuleInput icon="⭐" label="Punti assegnati se raggiunto" desc="Bonus piatto quando il totale supera la soglia" suffix="pt bonus" step={5} color="#d97706" {...ruleInputProps('pts_per_discount')} />
                </div>
              </div>

              {/* Regola 4 — Vendita voluminosa */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 4 · Vendita Voluminosa</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <RuleInput icon="??" label="Numero minimo pezzi in vendita" desc="La vendita deve contenere almeno N prodotti" suffix="pz min." step={1} color="#7c3aed" {...ruleInputProps('min_items_qty')} />
                  <RuleInput icon="⭐" label="Punti assegnati se raggiunto" desc="Bonus piatto per vendita con molti pezzi" suffix="pt bonus" step={5} color="#7c3aed" {...ruleInputProps('pts_per_big_sale')} />
                </div>
              </div>

              {/* Regola 5 — QScare */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 5 · QScare</div>
                <RuleInput icon="🛡" label="Punti per ogni vendita con QScare inclusa" desc="Assegnati ogni volta che una garanzia QScare viene aggiunta" suffix="pt / QScare" step={5} color="#0d9488" {...ruleInputProps('pts_per_qscare')} />
              </div>

              {/* Regola 6 — Prodotto Preferito */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 6 · Prodotto Preferito</div>
                <RuleInput icon="⭐" label="Punti per ogni prodotto preferito venduto" desc='Per ogni articolo con flag "Preferito" nella vendita.' suffix="pt / prodotto" step={5} color="#f59e0b" {...ruleInputProps('pts_per_featured')} />
              </div>

              {/* Regola 7 — Penaltà Ritardo */}
              <div style={{ padding: '4px 0 8px', borderBottom: '2px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>REGOLA 7 · Penaltà Ritardo</div>
                <RuleInput icon="⏰" label="Punti sottratti per ogni ritardo" desc="Valore positivo: verrà sottratto automaticamente dalla timbratura" suffix="pt - penaltà" step={5} color="#ef4444" {...ruleInputProps('pts_late_penalty')} />
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 10, fontSize: 12, color: '#991b1b', border: '1px solid #fecaca' }}>
                  ??️ La penaltà si applica automaticamente quando un dipendente risulta in ritardo nella timbratura.
                </div>
              </div>

              {/* Soglie Badge */}
              <div style={{ padding: '4px 0 8px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>SOGLIE BADGE · Punti cumulativi per livello</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <RuleInput icon="🥉" label="Punti Bronzo" desc="Punti da raggiungere" suffix="pt tot." step={50} color="#b45309" {...ruleInputProps('badge_bronze_pts')} />
                  <RuleInput icon="🥈" label="Punti Argento" desc="Punti da raggiungere" suffix="pt tot." step={100} color="#64748b" {...ruleInputProps('badge_silver_pts')} />
                  <RuleInput icon="🥇" label="Punti Oro" desc="Punti da raggiungere" suffix="pt tot." step={500} color="#b45309" {...ruleInputProps('badge_gold_pts')} />
                  <RuleInput icon="💎" label="Punti Diamante" desc="Punti da raggiungere" suffix="pt tot." step={1000} color="#6d28d9" {...ruleInputProps('badge_diamond_pts')} />
                </div>
              </div>
            </div>

            {/* Anteprima formula */}
            <div style={{ marginTop: 24, padding: '18px 22px', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 16, color: '#fff' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📊 Esempio calcolo punti</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                {[
                  { label: 'Vendita €100', pts: Math.floor(100 * editRules.pts_per_euro), icon: '??', color: '#86efac' },
                  { label: '+ Fidelity',   pts: editRules.pts_per_fidelity,               icon: '👤', color: '#7dd3fc' },
                  { label: '+ Sconto >€25',pts: editRules.pts_per_discount,               icon: '🏷️', color: '#fcd34d' },
                  { label: `+ ≥${editRules.min_items_qty}pz`, pts: editRules.pts_per_big_sale, icon: '??', color: '#c4b5fd' },
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
