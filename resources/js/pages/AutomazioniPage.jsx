import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Clock, Bell, RefreshCcw, Mail, MessageSquare, ShoppingCart, Shield, Play, Pause, Settings, RefreshCw, AlertTriangle, Banknote, Store, Filter } from 'lucide-react';
import { cashMovements as cashApi } from '../api.jsx';
import ReorderPanel from '../components/automazioni/ReorderPanel.jsx';

const CASH_THRESHOLD = 1000;

const AUTOMATIONS = [
  {
    id: 'cash_threshold_alert',
    icon: Banknote,
    color: '#ef4444',
    category: 'Cassa',
    name: 'Allerta Cassa Elevata',
    description: `Segnala automaticamente i negozi con saldo in cassa pari o superiore a €${CASH_THRESHOLD.toLocaleString('it-IT')}. Evidenziazione visiva in rosso e notifica admin.`,
    status: 'active',
    trigger: `Saldo cassa ≥ €${CASH_THRESHOLD.toLocaleString('it-IT')}`,
    action: 'Evidenziazione visiva + notifica',
    lastRun: 'Live (aggiornamento automatico)',
  },
  {
    id: 'low_stock_alert',
    icon: Bell,
    color: '#f59e0b',
    category: 'Magazzino',
    name: 'Allerta Scorte Basse',
    description: 'Invia una notifica automatica quando un prodotto scende sotto la soglia minima impostata.',
    status: 'active',
    trigger: 'Stock < soglia minima',
    action: 'Notifica admin + email',
    lastRun: '15 Apr 2026, 09:12',
  },
  {
    id: 'reorder_suggestion',
    icon: ShoppingCart,
    color: '#6366f1',
    category: 'Magazzino',
    name: 'Suggerimento Riordino Automatico',
    description: 'Crea automaticamente una bozza di ordine fornitore basandosi sul consumo storico e le scorte attuali.',
    status: 'active',
    trigger: 'Ogni lunedì alle 08:00',
    action: 'Crea PO bozza',
    lastRun: '14 Apr 2026, 08:00',
  },
  {
    id: 'loyalty_birthday',
    icon: Shield,
    color: '#10b981',
    category: 'CRM / Loyalty',
    name: 'Messaggio di Compleanno',
    description: 'Invia automaticamente un messaggio WhatsApp ai clienti fidelity nel giorno del loro compleanno con un coupon sconto.',
    status: 'active',
    trigger: 'Data nascita cliente',
    action: 'WhatsApp + coupon 10%',
    lastRun: '15 Apr 2026, 07:00',
  },
  {
    id: 'loyalty_win_back',
    icon: RefreshCcw,
    color: '#8b5cf6',
    category: 'CRM / Loyalty',
    name: 'Re-engagement Clienti Inattivi',
    description: 'Dopo 60 giorni senza acquisti, invia un messaggio personalizzato per riportare il cliente in negozio.',
    status: 'paused',
    trigger: '60 giorni senza acquisti',
    action: 'WhatsApp re-engagement',
    lastRun: '10 Apr 2026, 10:00',
  },
  {
    id: 'shift_reminder',
    icon: Clock,
    color: '#0ea5e9',
    category: 'Dipendenti',
    name: 'Reminder Turni Dipendenti',
    description: 'Invia un promemoria la sera prima del turno programmato per ridurre le assenze.',
    status: 'active',
    trigger: '18:00 giorno prima del turno',
    action: 'Notifica app dipendente',
    lastRun: '14 Apr 2026, 18:00',
  },
  {
    id: 'qscare_followup',
    icon: Mail,
    color: '#ec4899',
    category: 'Post-Vendita',
    name: 'Follow-up QScare',
    description: "Invia un'email di follow-up ai clienti che hanno acquistato una garanzia QScare, 30 giorni dopo l'acquisto.",
    status: 'draft',
    trigger: '30 giorni dopo acquisto QScare',
    action: 'Email follow-up',
    lastRun: '—',
  },
  {
    id: 'daily_report',
    icon: MessageSquare,
    color: '#64748b',
    category: 'Reportistica',
    name: 'Report Giornaliero Admin',
    description: 'Ogni sera alle 20:00 invia un riepilogo delle vendite della giornata via email agli amministratori.',
    status: 'active',
    trigger: 'Ogni giorno alle 20:00',
    action: 'Email con PDF riepilogo',
    lastRun: '14 Apr 2026, 20:00',
  },
];

const STATUS_CONFIG = {
  active: { label: 'Attiva', color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
  paused: { label: 'In pausa', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
  draft:  { label: 'Bozza', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
};

const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

const ALL_CATEGORIES = ['Tutte', ...new Set(AUTOMATIONS.map(a => a.category))];

export default function AutomazioniPage() {
  const [filter, setFilter]       = useState('Tutte');
  const [statuses, setStatuses]   = useState(() => Object.fromEntries(AUTOMATIONS.map(a => [a.id, a.status])));

  // ── Cash monitoring ─────────────────────────────────────────
  const [balances, setBalances]         = useState([]);
  const [balancesLoading, setBalLoading] = useState(true);
  const [lastRefresh, setLastRefresh]   = useState(null);
  const [cashFilterActive, setCashFilter] = useState(false);

  const fetchBalances = useCallback(async () => {
    setBalLoading(true);
    try {
      const res = await cashApi.balances();
      setBalances(res.data?.data || []);
      setLastRefresh(new Date());
    } catch {}
    finally { setBalLoading(false); }
  }, []);

  useEffect(() => {
    fetchBalances();
    const t = setInterval(fetchBalances, 30000);
    return () => clearInterval(t);
  }, [fetchBalances]);

  const highCashStores = balances.filter(b => b.balance >= CASH_THRESHOLD);
  const displayedBalances = cashFilterActive ? highCashStores : balances;

  // ── Automation cards ─────────────────────────────────────────
  const toggleStatus = (id) => {
    setStatuses(prev => ({ ...prev, [id]: prev[id] === 'active' ? 'paused' : 'active' }));
  };

  const filtered = filter === 'Tutte' ? AUTOMATIONS : AUTOMATIONS.filter(a => a.category === filter);
  const activeCount = Object.values(statuses).filter(s => s === 'active').length;

  return (
    <div className="animate-v3" style={{ maxWidth: 960, margin: '0 auto', padding: '0 0 40px' }}>

      {/* ── Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)',
        borderRadius: 24, padding: '28px 32px', marginBottom: 28, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={28} color="#fff" />
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0 }}>Automazioni</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '4px 0 0' }}>
              Regole automatiche attive nel sistema · <strong style={{ color: '#a5b4fc' }}>{activeCount} automazioni attive</strong>
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
            {[
              { label: 'Attive',   value: Object.values(statuses).filter(s => s === 'active').length },
              { label: 'In pausa', value: Object.values(statuses).filter(s => s === 'paused').length },
              { label: 'Bozze',   value: Object.values(statuses).filter(s => s === 'draft').length },
            ].map(kpi => (
              <div key={kpi.label} style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{kpi.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 🔴 MONITORAGGIO CASSA LIVE ── */}
      <div style={{
        background: 'var(--color-surface)', borderRadius: 20, padding: '20px 24px',
        border: `2px solid ${highCashStores.length > 0 ? '#fca5a5' : 'var(--color-border)'}`,
        marginBottom: 24,
        boxShadow: highCashStores.length > 0 ? '0 4px 24px rgba(239,68,68,0.10)' : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: highCashStores.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Banknote size={20} color={highCashStores.length > 0 ? '#ef4444' : '#6366f1'} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>
                Monitoraggio Cassa Live
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {lastRefresh ? `Aggiornato: ${lastRefresh.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Caricamento...'}
              </div>
            </div>
            {/* Badge allerta alta cassa */}
            {highCashStores.length > 0 && (
              <button
                onClick={() => setCashFilter(f => !f)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: cashFilterActive ? '#ef4444' : 'rgba(239,68,68,0.1)',
                  color: cashFilterActive ? '#fff' : '#ef4444',
                  border: '1.5px solid #fca5a5', borderRadius: 10,
                  padding: '5px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  transition: 'all 0.15s',
                  animation: !cashFilterActive ? 'spBadgePulse 2s ease-out infinite' : 'none',
                }}
              >
                <AlertTriangle size={13} />
                {highCashStores.length} {highCashStores.length === 1 ? 'negozio' : 'negozi'} ≥ €{CASH_THRESHOLD.toLocaleString('it-IT')}
                <Filter size={11} style={{ marginLeft: 2 }} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {cashFilterActive && (
              <button onClick={() => setCashFilter(false)} style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                ✕ Rimuovi filtro
              </button>
            )}
            <button
              onClick={fetchBalances}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}
            >
              <RefreshCw size={13} style={{ animation: balancesLoading ? 'spin 1s linear infinite' : 'none' }} />
              Aggiorna
            </button>
          </div>
        </div>

        {balancesLoading && balances.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            Caricamento saldi cassa...
          </div>
        ) : displayedBalances.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
            {cashFilterActive ? 'Nessun negozio con cassa ≥ €1.000 al momento.' : 'Nessun dato cassa disponibile.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {displayedBalances.map(store => {
              const isHigh = store.balance >= CASH_THRESHOLD;
              return (
                <div key={store.store_id} style={{
                  background: isHigh ? 'rgba(239,68,68,0.06)' : 'var(--color-bg)',
                  borderRadius: 14, padding: '14px 16px',
                  border: `1.5px solid ${isHigh ? '#fca5a5' : 'var(--color-border)'}`,
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 0.2s',
                }}>
                  {isHigh && (
                    <div style={{
                      position: 'absolute', top: 0, right: 0, background: '#ef4444',
                      color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 8px',
                      borderRadius: '0 0 0 8px', letterSpacing: '0.05em',
                    }}>⚠ ALLERTA</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Store size={14} color={isHigh ? '#ef4444' : 'var(--color-text-secondary)'} />
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {store.store_name}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: isHigh ? '#ef4444' : '#10b981', letterSpacing: '-0.02em' }}>
                    {fmt(store.balance)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>↓ {fmt(store.total_deposits)}</div>
                    <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>↑ {fmt(store.total_withdrawals)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Soglia nota */}
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 10, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} color="#ef4444" />
          <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
            Soglia allerta impostata a <strong>€{CASH_THRESHOLD.toLocaleString('it-IT')}</strong> — i negozi in rosso necessitano di un versamento.
          </span>
        </div>
      </div>

      {/* ── Coming Soon Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #fef9c3, #fef3c7)', borderRadius: 16, padding: '14px 20px',
        border: '1.5px solid #fde68a', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22 }}>🚧</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#92400e' }}>Funzione in sviluppo</div>
          <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
            Le automazioni complete (trigger reali, webhook, editor flussi) saranno disponibili prossimamente.
          </div>
        </div>
      </div>

      {/* ── Riordino Automatico (reale) ── */}
      <ReorderPanel />

      {/* ── Filtri categoria ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {ALL_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: '7px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            background: filter === cat ? '#6366f1' : '#f1f5f9',
            color: filter === cat ? '#fff' : '#64748b',
            transition: 'all 0.15s',
          }}>
            {cat}
          </button>
        ))}
      </div>

      {/* ── Cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(automation => {
          const Icon = automation.icon;
          const status = statuses[automation.id] || automation.status;
          const sc = STATUS_CONFIG[status];
          const isActive = status === 'active';
          const isCashAlert = automation.id === 'cash_threshold_alert';

          return (
            <div key={automation.id} style={{
              background: 'var(--color-surface)',
              borderRadius: 18, padding: '20px 24px',
              border: `1.5px solid ${isCashAlert && highCashStores.length > 0 ? '#fca5a5' : isActive ? 'rgba(99,102,241,0.15)' : 'var(--color-border)'}`,
              boxShadow: isCashAlert && highCashStores.length > 0
                ? '0 4px 20px rgba(239,68,68,0.10)'
                : isActive ? '0 4px 20px rgba(99,102,241,0.06)' : '0 2px 8px rgba(0,0,0,0.03)',
              display: 'flex', alignItems: 'flex-start', gap: 18,
              transition: 'all 0.2s',
              opacity: status === 'draft' ? 0.75 : 1,
            }}>
              {/* Icona */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${automation.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: isCashAlert && highCashStores.length > 0 ? `0 0 0 3px ${automation.color}30` : 'none',
              }}>
                <Icon size={22} color={automation.color} />
              </div>

              {/* Contenuto */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--color-text)' }}>{automation.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                    background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {sc.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f8fafc', padding: '2px 7px', borderRadius: 5, border: '1px solid #f1f5f9' }}>
                    {automation.category}
                  </span>
                  {/* Badge negozi in allerta per la card cassa */}
                  {isCashAlert && highCashStores.length > 0 && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8,
                      background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fca5a5',
                      animation: 'spBadgePulse 2s ease-out infinite',
                    }}>
                      🔴 {highCashStores.length} negozi in allerta
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{automation.description}</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>⚡ Trigger:</span> {automation.trigger}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>→ Azione:</span> {automation.action}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--color-text-secondary)' }}>🕐 Ultima:</span> {automation.lastRun}
                  </div>
                </div>
              </div>

              {/* Controlli */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => status !== 'draft' && toggleStatus(automation.id)}
                  disabled={status === 'draft'}
                  title={isActive ? 'Metti in pausa' : 'Attiva'}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none', cursor: status === 'draft' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? '#ecfdf5' : '#fff7ed',
                    color: isActive ? '#10b981' : '#f59e0b',
                    opacity: status === 'draft' ? 0.4 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {isActive ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  title="Configura"
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f8fafc', color: '#64748b', transition: 'all 0.15s',
                  }}
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
