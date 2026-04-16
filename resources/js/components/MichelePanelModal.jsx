import React, { useState } from 'react';
import { X, FlaskConical, Calculator } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   DATI TABELLE RICETTE NICOTINA
══════════════════════════════════════════════════════════════ */

// Booster standard: 10ml × 20mg/ml = 200mg nic per booster

const TABLES = {
  minishot: {
    label: 'Minishot (10+10ml)',
    desc: '10ml aroma + booster → 20ml finale',
    color: '#f59e0b',
    sub: [
      {
        name: '50/50 MTL',
        volFinale: 20,
        rows: [
          { nic: 0,   boosters: '—',                       vg: '10ml base 50/50', pg: '—' },
          { nic: 1.5, boosters: '1× Smart (10ml 3mg)',     vg: '—',              pg: '—' },
          { nic: 3,   boosters: '1× 20mg (10ml)',          vg: '—',              pg: '—' },
          { nic: 6,   boosters: '2× 20mg (10ml cad.)',     vg: '—',              pg: '—' },
          { nic: 9,   boosters: '3× 20mg',                 vg: '—',              pg: '—' },
          { nic: 12,  boosters: '4× 20mg',                 vg: '—',              pg: '—' },
          { nic: 18,  boosters: '6× 20mg',                 vg: '—',              pg: '—' },
        ],
      },
      {
        name: '70/30 DTL',
        volFinale: 20,
        rows: [
          { nic: 0,   boosters: '—',                              vg: '10ml base 70/30', pg: '—' },
          { nic: 1.5, boosters: '1× Smart (10ml 3mg 70/30)',      vg: '—',              pg: '—' },
          { nic: 3,   boosters: '1× 20mg Full VG (10ml)',         vg: '—',              pg: '—' },
          { nic: 6,   boosters: '1× 20mg 50/50 + 1× 20mg Full VG',vg: '—',             pg: '—' },
          { nic: 9,   boosters: '3× 20mg Full VG',                vg: '—',             pg: '—' },
          { nic: 12,  boosters: '4× 20mg Full VG',                vg: '—',             pg: '—' },
          { nic: 18,  boosters: '6× 20mg Full VG',                vg: '—',             pg: '—' },
        ],
      },
    ],
  },
  shot5050: {
    label: 'Shot 50/50 (20→60ml)',
    desc: '20ml aroma in bottiglia 60ml — MTL',
    color: '#3b82f6',
    sub: [
      {
        name: 'Shot 50/50 MTL',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',               vg: '40ml base 50/50',   pg: '—'   },
          { nic: 1.5, boosters: '—',               vg: '39ml base + 1ml VG', pg: '—'  },
          { nic: 3,   boosters: '1× 20mg (10ml)',  vg: '30ml base 50/50',   pg: '—'   },
          { nic: 4,   boosters: '1× 20mg + 2ml VG', vg: '28ml base',        pg: '—'  },
          { nic: 6,   boosters: '2× 20mg (10ml)',  vg: '20ml base 50/50',   pg: '—'   },
          { nic: 9,   boosters: '3× 20mg (10ml)',  vg: '10ml base 50/50',   pg: '—'   },
          { nic: 12,  boosters: '4× 20mg (10ml)',  vg: '—',                 pg: '—'   },
          { nic: 15,  boosters: '5× 20mg (10ml)',  vg: '—',                 pg: '—'   },
          { nic: 18,  boosters: '6× 20mg (10ml)',  vg: '—',                 pg: '—'   },
        ],
      },
    ],
  },
  shot7030: {
    label: 'Shot 70/30 (20→60ml)',
    desc: '20ml aroma in bottiglia 60ml — DTL',
    color: '#8b5cf6',
    sub: [
      {
        name: 'Shot 70/30 DTL',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',                               vg: '40ml base 70/30',  pg: '—' },
          { nic: 1.5, boosters: '—',                               vg: '39ml VG + 1ml nic',pg: '—' },
          { nic: 3,   boosters: '1× 20mg Full VG (10ml)',          vg: '30ml base 70/30',  pg: '—' },
          { nic: 4,   boosters: '1× 20mg Full VG + 2ml VG',       vg: '28ml base',        pg: '—' },
          { nic: 6,   boosters: '1× 20mg 50/50 + 1× 20mg Full VG', vg: '20ml base 70/30', pg: '—' },
          { nic: 9,   boosters: '3× 20mg Full VG (10ml)',          vg: '10ml VG',          pg: '—' },
          { nic: 12,  boosters: '4× 20mg Full VG (10ml)',          vg: '—',                pg: '—' },
          { nic: 15,  boosters: '5× 20mg Full VG',                 vg: '—',                pg: '—' },
          { nic: 18,  boosters: '6× 20mg Full VG',                 vg: '—',                pg: '—' },
        ],
      },
    ],
  },
  blendfeel: {
    label: 'Blendfeel (10/60)',
    desc: '10ml aroma in bottiglia 60ml',
    color: '#10b981',
    sub: [
      {
        name: 'Guancia 50/50',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',              vg: '50ml base 50/50',     pg: '—' },
          { nic: 3,   boosters: '1× 20mg (10ml)', vg: '40ml base 50/50',     pg: '—' },
          { nic: 6,   boosters: '2× 20mg (10ml)', vg: '30ml base 50/50',     pg: '—' },
          { nic: 9,   boosters: '3× 20mg (10ml)', vg: '20ml base 50/50',     pg: '—' },
          { nic: 12,  boosters: '4× 20mg (10ml)', vg: '10ml base',           pg: '—' },
          { nic: 15,  boosters: '5× 20mg (10ml)', vg: '—',                   pg: '—' },
          { nic: 18,  boosters: '6× 20mg (10ml)', vg: '—',                   pg: '—' },
        ],
      },
    ],
  },
  vaporart: {
    label: 'Vaporart (30/60)',
    desc: '30ml aroma in bottiglia 60ml',
    color: '#ec4899',
    sub: [
      {
        name: 'Guancia 50/50',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',              vg: '30ml base 50/50',  pg: '—' },
          { nic: 3,   boosters: '1× 20mg (10ml)', vg: '20ml base 50/50',  pg: '—' },
          { nic: 6,   boosters: '2× 20mg (10ml)', vg: '10ml base',        pg: '—' },
          { nic: 9,   boosters: '3× 20mg (10ml)', vg: '—',                pg: '—' },
          { nic: 12,  boosters: '4× 20mg (10ml)', vg: '—',                pg: '—' },
        ],
      },
      {
        name: 'Polmone 70/30',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',                         vg: '30ml base 70/30', pg: '—' },
          { nic: 3,   boosters: '1× 20mg Full VG (10ml)',    vg: '20ml VG',         pg: '—' },
          { nic: 6,   boosters: '2× 20mg Full VG (10ml)',    vg: '10ml VG',         pg: '—' },
          { nic: 9,   boosters: '3× 20mg Full VG',           vg: '—',               pg: '—' },
          { nic: 12,  boosters: '4× 20mg Full VG',           vg: '—',               pg: '—' },
        ],
      },
    ],
  },
  tnt: {
    label: 'TNT (20/60)',
    desc: '20ml aroma in bottiglia 60ml',
    color: '#f97316',
    sub: [
      {
        name: 'Shot 50/50',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',              vg: '40ml base 50/50',  pg: '—' },
          { nic: 3,   boosters: '1× 20mg (10ml)', vg: '30ml base 50/50',  pg: '—' },
          { nic: 6,   boosters: '2× 20mg (10ml)', vg: '20ml base',        pg: '—' },
          { nic: 9,   boosters: '3× 20mg (10ml)', vg: '10ml base',        pg: '—' },
          { nic: 12,  boosters: '4× 20mg (10ml)', vg: '—',                pg: '—' },
          { nic: 18,  boosters: '6× 20mg (10ml)', vg: '—',                pg: '—' },
        ],
      },
      {
        name: 'Full VG 70/30',
        volFinale: 60,
        rows: [
          { nic: 0,   boosters: '—',                      vg: '40ml VG',   pg: '—' },
          { nic: 3,   boosters: '1× 20mg Full VG (10ml)', vg: '30ml VG',   pg: '—' },
          { nic: 6,   boosters: '2× 20mg Full VG (10ml)', vg: '20ml VG',   pg: '—' },
          { nic: 9,   boosters: '3× 20mg Full VG',        vg: '10ml VG',   pg: '—' },
          { nic: 12,  boosters: '4× 20mg Full VG',        vg: '—',         pg: '—' },
        ],
      },
    ],
  },
};

/* ── Calcolatore interattivo ───────────────────────────────── */
const FORMATS = [
  { id: 'minishot',  label: 'Minishot (10+10ml)', desc: '20ml finale — Guancia/Polmone', icon: '🧪' },
  { id: 'shot5050',  label: 'Shot 50/50 (20→60)', desc: '60ml finale — MTL Guancia',    icon: '💨' },
  { id: 'shot7030',  label: 'Shot 70/30 (20→60)', desc: '60ml finale — DTL Polmone',    icon: '☁️' },
  { id: 'blendfeel', label: 'Blendfeel (10/60)',   desc: '60ml finale — Blendfeel',      icon: '🫧' },
  { id: 'vaporart',  label: 'Vaporart (30/60)',    desc: '60ml finale — Vaporart',       icon: '💧' },
  { id: 'tnt',       label: 'TNT (20/60)',         desc: '60ml finale — TNT Vape',       icon: '⚡' },
];

const NIC_LEVELS = [0, 1.5, 3, 4, 6, 9, 12, 15, 18];

function CalcIcon({ n }) {
  return <span style={{ fontSize: 22 }}>{n}</span>;
}

function Calcolatore() {
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState(null);
  const [subIdx, setSubIdx] = useState(0);
  const [nic, setNic] = useState(6);

  const tData = format ? TABLES[format] : null;
  const hasSubs = tData && tData.sub.length > 1;
  const recipe = tData
    ? tData.sub[subIdx]?.rows.find(r => r.nic === nic) || null
    : null;

  const reset = () => { setStep(1); setFormat(null); setSubIdx(0); setNic(6); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {[1,2,3].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step >= s ? '#f59e0b' : '#334155', color: step >= s ? '#000' : '#94a3b8',
              fontWeight: 900, fontSize: 14, flexShrink: 0, transition: 'all 0.2s',
            }}>{s}</div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > s ? '#f59e0b' : '#334155', transition: 'all 0.3s' }} />}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -12 }}>
        {['Formato', 'Nicotina', 'Ricetta'].map((l, i) => (
          <span key={l} style={{ fontSize: 10, fontWeight: 700, color: step >= i+1 ? '#f59e0b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</span>
        ))}
      </div>

      {/* Step 1: Formato */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Seleziona il formato</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => { setFormat(f.id); setSubIdx(0); setStep(hasSubs || TABLES[f.id]?.sub.length > 1 ? 2 : 2); }}
                style={{
                  padding: '14px 12px', borderRadius: 12, border: `2px solid ${format === f.id ? '#f59e0b' : '#334155'}`,
                  background: format === f.id ? 'rgba(245,158,11,0.1)' : '#1e293b',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{f.label}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{f.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => { if (format) setStep(2); }} disabled={!format}
            style={{ marginTop: 16, width: '100%', padding: 14, borderRadius: 12, border: 'none', background: format ? '#f59e0b' : '#334155', color: format ? '#000' : '#64748b', fontWeight: 800, fontSize: 14, cursor: format ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            Avanti →
          </button>
        </div>
      )}

      {/* Step 2: Sub-formato + Nicotina */}
      {step === 2 && tData && (
        <div>
          {hasSubs && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stile</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {tData.sub.map((s, i) => (
                  <button key={i} onClick={() => setSubIdx(i)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${subIdx === i ? tData.color : '#334155'}`,
                    background: subIdx === i ? `${tData.color}22` : '#1e293b',
                    color: subIdx === i ? tData.color : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>{s.name}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nicotina target (mg/ml)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {NIC_LEVELS.map(n => (
              <button key={n} onClick={() => setNic(n)} style={{
                padding: '10px 16px', borderRadius: 10, border: `2px solid ${nic === n ? '#f59e0b' : '#334155'}`,
                background: nic === n ? 'rgba(245,158,11,0.15)' : '#1e293b',
                color: nic === n ? '#f59e0b' : '#94a3b8', fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}>← Indietro</button>
            <button onClick={() => setStep(3)} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 800, cursor: 'pointer' }}>Calcola Ricetta →</button>
          </div>
        </div>
      )}

      {/* Step 3: Risultato */}
      {step === 3 && tData && (
        <div>
          <div style={{ padding: 20, background: `${tData.color}15`, border: `2px solid ${tData.color}44`, borderRadius: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: tData.color }}>{nic} mg/ml</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{tData.sub[subIdx]?.name} — {tData.desc} ({tData.sub[subIdx]?.volFinale}ml)</div>
          </div>

          {recipe ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '🧪 Booster da aggiungere', value: recipe.boosters },
                { label: '💧 VG / Base extra', value: recipe.vg },
              ].filter(r => r.value && r.value !== '—').map(r => (
                <div key={r.label} style={{ padding: '14px 16px', background: '#1e293b', borderRadius: 12, border: '1px solid #334155' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{r.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{r.value}</div>
                </div>
              ))}
              {recipe.boosters === '—' && nic === 0 && (
                <div style={{ padding: 14, background: 'rgba(16,185,129,0.1)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontWeight: 700, fontSize: 13 }}>
                  ✅ Nessun booster necessario — liquido senza nicotina
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13 }}>
              ⚠️ Combinazione non disponibile nelle tabelle di riferimento per questo formato.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}>← Modifica</button>
            <button onClick={reset} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#e2e8f0', fontWeight: 700, cursor: 'pointer' }}>🔄 Ricomincia</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPALE MODAL
══════════════════════════════════════════════════════════════ */
export default function MichelePanelModal({ onClose }) {
  const [view, setView] = useState('tabelle'); // 'tabelle' | 'calc'
  const [activeTable, setActiveTable] = useState('shot5050');
  const [activeSub, setActiveSub] = useState(0);

  const tbl =  TABLES[activeTable];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        background: '#0f172a', borderRadius: 24, border: '1px solid #1e293b',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlaskConical size={22} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>🔰 Pannello Michele</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Riferimento Nicotina — Ricette & Tabelle</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: '#1e293b', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 0 }}>
            {[{ id: 'tabelle', label: '📋 Consulta Tabelle', icon: null }, { id: 'calc', label: '🧮 Calcolatore', icon: null }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, borderRadius: '10px 10px 0 0',
                background: view === v.id ? '#1e293b' : 'transparent',
                color: view === v.id ? '#f59e0b' : '#64748b',
                borderBottom: view === v.id ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* CONSULTA TABELLE */}
          {view === 'tabelle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tab formato */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(TABLES).map(([key, t]) => (
                  <button key={key} onClick={() => { setActiveTable(key); setActiveSub(0); }} style={{
                    padding: '7px 14px', borderRadius: 20, border: `1px solid ${activeTable === key ? t.color : '#334155'}`,
                    background: activeTable === key ? `${t.color}20` : 'transparent',
                    color: activeTable === key ? t.color : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Info formato */}
              <div style={{ padding: '12px 16px', background: `${tbl.color}10`, border: `1px solid ${tbl.color}30`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <FlaskConical size={16} color={tbl.color} />
                <div>
                  <span style={{ fontWeight: 800, color: tbl.color, fontSize: 14 }}>{tbl.label}</span>
                  <span style={{ color: '#64748b', fontSize: 12, marginLeft: 10 }}>{tbl.desc}</span>
                </div>
              </div>

              {/* Sub-tab se esistono */}
              {tbl.sub.length > 1 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {tbl.sub.map((s, i) => (
                    <button key={i} onClick={() => setActiveSub(i)} style={{
                      padding: '8px 16px', borderRadius: 10, border: `1px solid ${activeSub === i ? tbl.color : '#334155'}`,
                      background: activeSub === i ? `${tbl.color}15` : 'transparent',
                      color: activeSub === i ? tbl.color : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>{s.name}</button>
                  ))}
                </div>
              )}

              {/* Tabella */}
              <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #1e293b' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1e293b' }}>
                      {['Nic (mg/ml)', 'Booster da aggiungere', 'VG / Base extra', 'Vol. Finale'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tbl.sub[activeSub]?.rows.map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                        onMouseEnter={e => e.currentTarget.style.background = `${tbl.color}08`}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 900, fontSize: 16, color: row.nic === 0 ? '#64748b' : tbl.color }}>{row.nic}</span>
                          <span style={{ fontSize: 10, color: '#64748b', marginLeft: 3 }}>mg/ml</span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: row.boosters === '—' ? '#334155' : '#e2e8f0' }}>{row.boosters}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: row.vg === '—' ? '#334155' : '#94a3b8' }}>{row.vg}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: `${tbl.color}20`, color: tbl.color, padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>{tbl.sub[activeSub]?.volFinale}ml</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '10px 14px', background: '#1e293b', borderRadius: 10, fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                💡 <strong style={{ color: '#94a3b8' }}>Booster standard:</strong> 10ml × 20mg/ml = 200mg nic ciascuno. Dopo aver aggiunto i booster, integrare con base neutra 50/50 o 70/30 fino al volume finale indicato.
              </div>
            </div>
          )}

          {/* CALCOLATORE */}
          {view === 'calc' && <Calcolatore />}
        </div>
      </div>
    </div>
  );
}
