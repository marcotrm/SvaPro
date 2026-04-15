import React, { useState } from 'react';
import { Zap, Clock, Bell, RefreshCcw, Mail, MessageSquare, ShoppingCart, Shield, ChevronRight, Play, Pause, Settings } from 'lucide-react';

const AUTOMATIONS = [
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
    description: 'Invia un\'email di follow-up ai clienti che hanno acquistato una garanzia QScare, 30 giorni dopo l\'acquisto.',
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

const CATEGORIES = ['Tutte', ...new Set(AUTOMATIONS.map(a => a.category))];

export default function AutomazioniPage() {
  const [filter, setFilter] = useState('Tutte');
  const [statuses, setStatuses] = useState(() => Object.fromEntries(AUTOMATIONS.map(a => [a.id, a.status])));

  const toggleStatus = (id) => {
    setStatuses(prev => ({
      ...prev,
      [id]: prev[id] === 'active' ? 'paused' : 'active',
    }));
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
              { label: 'Attive', value: Object.values(statuses).filter(s => s === 'active').length },
              { label: 'In pausa', value: Object.values(statuses).filter(s => s === 'paused').length },
              { label: 'Bozze', value: Object.values(statuses).filter(s => s === 'draft').length },
            ].map(kpi => (
              <div key={kpi.label} style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{kpi.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
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
            Le automazioni complete (trigger reali, webhook, editor flussi) saranno disponibili prossimamente. Qui vedi un'anteprima delle regole pianificate.
          </div>
        </div>
      </div>

      {/* ── Filtri categoria ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CATEGORIES.map(cat => (
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

          return (
            <div key={automation.id} style={{
              background: '#fff', borderRadius: 18, padding: '20px 24px',
              border: `1.5px solid ${isActive ? '#e0e7ff' : '#f1f5f9'}`,
              boxShadow: isActive ? '0 4px 20px rgba(99,102,241,0.06)' : '0 2px 8px rgba(0,0,0,0.03)',
              display: 'flex', alignItems: 'flex-start', gap: 18,
              transition: 'all 0.2s',
              opacity: status === 'draft' ? 0.75 : 1,
            }}>
              {/* Icona */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${automation.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} color={automation.color} />
              </div>

              {/* Contenuto */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: '#0f172a' }}>{automation.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                    background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {sc.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f8fafc', padding: '2px 7px', borderRadius: 5, border: '1px solid #f1f5f9' }}>
                    {automation.category}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>{automation.description}</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ fontWeight: 800, color: '#475569' }}>⚡ Trigger:</span> {automation.trigger}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ fontWeight: 800, color: '#475569' }}>→ Azione:</span> {automation.action}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ fontWeight: 800, color: '#475569' }}>🕐 Ultima:</span> {automation.lastRun}
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
                    background: '#f8fafc', color: '#64748b',
                    transition: 'all 0.15s',
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
