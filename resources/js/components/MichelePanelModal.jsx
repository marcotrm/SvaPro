import React, { useState } from 'react';
import { X, FlaskConical } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   DATI TABELLE RICETTE NICOTINA
══════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPALE MODAL
══════════════════════════════════════════════════════════════ */
export default function MichelePanelModal({ onClose }) {
  const [activeTable, setActiveTable] = useState('shot5050');
  const [activeSub, setActiveSub] = useState(0);

  const tbl = TABLES[activeTable];

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
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FlaskConical size={22} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Scheda Nicotina</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Riferimento Ricette &amp; Tabelle Mix</div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: '#1e293b', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
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
        </div>
      </div>
    </div>
  );
}
