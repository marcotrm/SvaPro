import React, { useState } from 'react';
import { X, BookOpen, FlaskConical } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   DATI TABELLE RICETTE NICOTINA — VapeCalc Pro (fonte reale)
   ═══════════════════════════════════════════════════════════ */

const TABLES = [
  {
    id: 'formati_base',
    label: 'Formati Base',
    sections: [
      {
        title: 'Minishot (10+10ml)',
        cols: ['Nicotina (mg/ml)', 'Booster Necessari', 'VG Extra (ml)', 'PG Extra (ml)', 'Volume Finale (ml)'],
        rows: [
          ['0 mg/ml',  'NO',                                               '10 ml', '0 ml',  '10 ml'],
          ['4 mg/ml',  '1x 8MG FULL VG',                                  '0 ml',  '0 ml',  '20 ml'],
          ['6 mg/ml',  '1x 12MG FULL VG',                                 '0 ml',  '0 ml',  '20 ml'],
          ['8 mg/ml',  '1x 16MG FULL VG',                                 '0 ml',  '0 ml',  '20 ml'],
          ['10 mg/ml', '1x 20MG FULL VG',                                 '0 ml',  '0 ml',  '20 ml'],
          ['12 mg/ml', '1x 20MG 50/50 + 1x 16MG FULL VG',                '0 ml',  '0 ml',  '30 ml'],
          ['14 mg/ml', '1x 20MG 50/50 + 1x 20MG FULL VG',                '0 ml',  '0 ml',  '30 ml'],
        ],
      },
      {
        title: 'Shot 50/50 (20→60ml)',
        cols: ['Nicotina (mg/ml)', 'Booster Necessari', 'VG Extra (ml)', 'PG Extra (ml)', 'Volume Finale (ml)'],
        rows: [
          ['0 mg/ml',     'NO',                                                        '30 ml', '10 ml', '60 ml'],
          ['2 mg/ml',     '1x 12MG FULL VG',                                           '20 ml', '10 ml', '60 ml'],
          ['3 mg/ml',     '1x 20MG 50/50',                                             '30 ml', '0 ml',  '60 ml'],
          ['5 mg/ml',     '1x 20MG 50/50 + 1x 12MG FULL VG',                          '20 ml', '0 ml',  '60 ml'],
          ['6 mg/ml',     '1x 20MG 50/50 + 1x 16MG FULL VG',                          '20 ml', '0 ml',  '60 ml'],
          ['8 mg/ml',     '2x 20MG 50/50 + 1x 8MG FULL VG',                           '10 ml', '0 ml',  '60 ml'],
          ['9 mg/ml',     '1x 20MG 50/50 + 1x 16MG FULL VG + 1x 20MG FULL VG',       '10 ml', '0 ml',  '60 ml'],
          ['10 mg/ml',    '2x 20MG 50/50 + 1x 20MG FULL VG',                          '10 ml', '0 ml',  '60 ml'],
          ['12 mg/ml',    '2x 20MG 50/50 + 1x 20MG FULL VG + 1x 12MG FULL VG',       '0 ml',  '0 ml',  '60 ml'],
          ['1.33 mg/ml',  '1x 8MG FULL VG',                                            '20 ml', '10 ml', '60 ml'],
          ['2.5 mg/ml',   '1x 16MG FULL VG',                                           '20 ml', '10 ml', '60 ml'],
          ['4.5 mg/ml',   '1x 20MG 50/50 + 1x 8MG FULL VG',                           '20 ml', '0 ml',  '60 ml'],
          ['6.5 mg/ml',   '2x 20MG 50/50',                                             '20 ml', '0 ml',  '60 ml'],
          ['13.33 mg/ml', '2x 20MG 50/50 + 2x 20MG FULL VG',                          '0 ml',  '0 ml',  '60 ml'],
        ],
      },
      {
        title: 'Shot 70/30 (20→60ml)',
        cols: ['Nicotina (mg/ml)', 'Booster Necessari', 'VG Extra (ml)', 'PG Extra (ml)', 'Volume Finale (ml)'],
        rows: [
          ['0 mg/ml',    'NO',                                                         '40 ml', '0 ml',  '60 ml'],
          ['2 mg/ml',    '1x 12MG FULL VG',                                           '30 ml', '0 ml',  '60 ml'],
          ['3 mg/ml',    '1x 20MG FULL VG',                                           '30 ml', '0 ml',  '60 ml'],
          ['5 mg/ml',    '1x 20MG FULL VG + 1x 12MG FULL VG',                        '20 ml', '0 ml',  '60 ml'],
          ['6 mg/ml',    '1x 20MG FULL VG + 1x 16MG FULL VG',                        '20 ml', '0 ml',  '60 ml'],
          ['8 mg/ml',    '2x 20MG FULL VG + 1x 8MG FULL VG',                         '10 ml', '0 ml',  '60 ml'],
          ['9 mg/ml',    '1x 20MG FULL VG + 1x 16MG FULL VG + 1x 20MG FULL VG',     '10 ml', '0 ml',  '60 ml'],
          ['10 mg/ml',   '2x 20MG FULL VG + 1x 20MG FULL VG',                        '10 ml', '0 ml',  '60 ml'],
          ['1.5 mg/ml',  '1x 8MG FULL VG',                                            '30 ml', '0 ml',  '60 ml'],
          ['2.5 mg/ml',  '1x 16MG FULL VG',                                           '30 ml', '0 ml',  '60 ml'],
          ['4.5 mg/ml',  '1x 20MG FULL VG + 1x 8MG FULL VG',                         '20 ml', '0 ml',  '60 ml'],
          ['6.5 mg/ml',  '2x 20MG FULL VG',                                           '20 ml', '0 ml',  '60 ml'],
        ],
      },
      {
        title: 'Base 100ml 50/50',
        cols: ['Nicotina (mg/ml)', 'Booster Necessari', 'VG Extra (ml)', 'PG Extra (ml)', 'Volume Finale (ml)'],
        note: '+ Flacone vuoto 100ml',
        rows: [
          ['0 mg/ml',  'NO',                                      '45 ml', '45 ml', '90 ml'],
          ['1 mg/ml',  '1x 12MG FULL VG',                         '45 ml', '35 ml', '100 ml'],
          ['2 mg/ml',  '1x 20MG 50/50',                           '45 ml', '35 ml', '100 ml'],
          ['3 mg/ml',  '1x 20MG 50/50 + 1x 12MG FULL VG',        '35 ml', '35 ml', '100 ml'],
          ['4 mg/ml',  '2x 20MG 50/50',                           '35 ml', '35 ml', '100 ml'],
          ['6 mg/ml',  '3x 20MG 50/50',                           '35 ml', '25 ml', '100 ml'],
          ['8 mg/ml',  '4x 20MG 50/50',                           '25 ml', '25 ml', '100 ml'],
          ['9 mg/ml',  '4x 20MG 50/50 + 1x 12MG FULL VG',        '35 ml', '0 ml',  '100 ml'],
          ['10 mg/ml', '5x 20MG 50/50',                           '35 ml', '0 ml',  '100 ml'],
          ['12 mg/ml', '6x 20MG 50/50',                           '25 ml', '0 ml',  '100 ml'],
          ['14 mg/ml', '7x 20MG 50/50',                           '25 ml', '0 ml',  '100 ml'],
          ['16 mg/ml', '8x 20MG 50/50',                           '10 ml', '0 ml',  '100 ml'],
          ['18 mg/ml', '9x 20MG 50/50',                           '10 ml', '0 ml',  '100 ml'],
        ],
      },
      {
        title: 'Base 100ml 70/30',
        cols: ['Nicotina (mg/ml)', 'Booster Necessari', 'VG Extra (ml)', 'PG Extra (ml)', 'Volume Finale (ml)'],
        rows: [
          ['0 mg/ml', 'NO',                                          '75 ml', '25 ml', '100 ml'],
          ['1 mg/ml', '1x 12MG FULL VG',                            '55 ml', '25 ml', '100 ml'],
          ['2 mg/ml', '1x 20MG FULL VG',                            '55 ml', '25 ml', '100 ml'],
          ['3 mg/ml', '1x 20MG FULL VG + 1x 12MG FULL VG',         '45 ml', '25 ml', '100 ml'],
          ['4 mg/ml', '2x 20MG FULL VG',                            '45 ml', '25 ml', '100 ml'],
          ['6 mg/ml', '3x 20MG FULL VG',                            '35 ml', '25 ml', '100 ml'],
          ['8 mg/ml', '4x 20MG FULL VG',                            '25 ml', '25 ml', '100 ml'],
        ],
      },
    ],
  },
  { id: 'blendfeel', label: 'Blendfeel', sections: [] },
  { id: 'vaporart',  label: 'Vaporart',  sections: [] },
  { id: 'tnt',       label: 'TNT',       sections: [] },
];

/* ═══════════════════════════════════════════════════════════ */

export default function MichelePanelModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('formati_base');
  const activeTable = TABLES.find(t => t.id === activeTab);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 60, paddingBottom: 20, overflowY: 'auto',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 860,
        margin: '0 16px', boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'linear-gradient(135deg, #d97706, #f59e0b)',
              borderRadius: 12, width: 42, height: 42,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
            }}>
              <FlaskConical size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>Tabelle Ricette Nicotina</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Consulta tutte le combinazioni disponibili per ogni formato</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '14px 24px 0', flexShrink: 0, borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {TABLES.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                  background: activeTab === t.id ? '#f59e0b' : 'transparent',
                  color: activeTab === t.id ? '#000' : '#64748b',
                  boxShadow: activeTab === t.id ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body scrollabile */}
        <div style={{ overflowY: 'auto', padding: '20px 24px' }}>
          {activeTable && activeTable.sections.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <FlaskConical size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Tabelle {activeTable.label} in arrivo</div>
            </div>
          )}

          {activeTable && activeTable.sections.map((section, si) => (
            <div key={si} style={{ marginBottom: 28 }}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 12, fontWeight: 800, fontSize: 14, color: '#1e293b',
              }}>
                <BookOpen size={16} color="#f59e0b" />
                {section.title}
              </div>

              {/* Tabella */}
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {section.cols.map((col, ci) => (
                        <th key={ci} style={{
                          padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                          color: '#64748b', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: ri < section.rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fefce8'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '7px 10px', color: '#1e293b' }}>
                            {ci === 0 ? (
                              <span style={{
                                display: 'inline-block', background: '#f59e0b', color: '#000',
                                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                              }}>
                                {cell}
                              </span>
                            ) : ci === section.cols.length - 1 ? (
                              <span style={{ fontWeight: 700 }}>{cell}</span>
                            ) : (
                              <span style={{ color: cell === 'NO' ? '#94a3b8' : '#1e293b' }}>{cell}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {section.note && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', fontStyle: 'italic', paddingLeft: 4 }}>
                  Nota: {section.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
