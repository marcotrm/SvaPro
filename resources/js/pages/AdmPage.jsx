import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileSpreadsheet, Download, Loader2, Calendar, CheckCircle, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { adm } from '../api';

/* ─── Helper ───────────────────────────────────────────────────── */
const MONTHS = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

function getDefaultMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getAvailableYears() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => currentYear - i);
}

/* ─── Report Card ──────────────────────────────────────────────── */
function ReportCard({ id, title, subtitle, icon, gradient, selected, onClick, children }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 20,
        padding: '24px 28px',
        cursor: 'pointer',
        border: selected ? '2px solid var(--color-accent, #6366f1)' : '2px solid transparent',
        background: selected ? 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))' : '#fff',
        boxShadow: selected
          ? '0 8px 32px rgba(99,102,241,0.18)'
          : '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
    >
      {/* Decorative gradient blob */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 120, height: 120,
        borderRadius: '50%', background: gradient, opacity: selected ? 0.18 : 0.09,
        pointerEvents: 'none', transition: 'opacity 0.2s',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{subtitle}</div>
          {children && <div style={{ marginTop: 16 }}>{children}</div>}
        </div>
        {selected && (
          <CheckCircle size={20} color="#6366f1" style={{ flexShrink: 0, marginTop: 2 }} />
        )}
      </div>
    </div>
  );
}

/* ─── Select custom ──────────────────────────────────────────────*/
function StyledSelect({ value, onChange, options, style = {} }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          width: '100%', padding: '10px 38px 10px 14px',
          borderRadius: 12, border: '2px solid #e2e8f0',
          background: '#f8fafc', color: '#0f172a',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          outline: 'none', transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = '#6366f1'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={16} color="#64748b" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  );
}

/* ─── ADM Page ─────────────────────────────────────────────────── */
export default function AdmPage() {
  const { user } = useOutletContext();

  const [reportType, setReportType] = useState('mensile');   // 'mensile' | 'quindicinale'
  const [half, setHalf]             = useState(1);            // 1 = prima quindicina, 2 = seconda
  const { year: dy, month: dm }     = getDefaultMonth();
  const [selectedYear, setSelectedYear]   = useState(String(dy));
  const [selectedMonth, setSelectedMonth] = useState(String(dm));
  const [generating, setGenerating]       = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);
  const [lastError, setLastError]         = useState(null);

  const yearOptions  = getAvailableYears().map(y => ({ value: String(y), label: String(y) }));
  const monthOptions = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

  const periodoLabel = reportType === 'mensile'
    ? `${MONTHS[parseInt(selectedMonth) - 1]} ${selectedYear}`
    : `${half === 1 ? '1ª' : '2ª'} Quindicina — ${MONTHS[parseInt(selectedMonth) - 1]} ${selectedYear}`;

  const nomeFile = reportType === 'mensile'
    ? `SVAPOGROUPSRL${String(selectedMonth).padStart(2,'0')}${selectedYear}.xlsx`
    : `SVAPOGROUPSRL${half === 1 ? '1Q' : '2Q'}${String(selectedMonth).padStart(2,'0')}${selectedYear}.xlsx`;

  const handleGenerate = async () => {
    setGenerating(true);
    setLastError(null);
    try {
      const response = await adm.generateReport({
        type: reportType,
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        half: reportType === 'quindicinale' ? half : null,
      });

      // Trigger browser download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeFile;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);

      setLastGenerated({ type: reportType, periodo: periodoLabel, nome: nomeFile, at: new Date() });
      toast.success(`✅ File "${nomeFile}" scaricato con successo!`);
    } catch (err) {
      let msg = 'Errore durante la generazione del report';
      let detail = '';
      // La risposta è sempre un Blob dato responseType:'blob'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          // Potrebbe essere JSON o HTML (Fatal error PHP)
          if (text.trim().startsWith('{')) {
            const parsed = JSON.parse(text);
            msg    = parsed.message || msg;
            detail = parsed.detail  || '';
          } else {
            // HTML / testo grezzo dal server
            detail = text.replace(/<[^>]*>/g, '').substring(0, 400).trim();
          }
        } catch { detail = 'Impossibile leggere la risposta del server.'; }
      } else {
        msg    = err.response?.data?.message || err.message || msg;
        detail = err.response?.data?.detail  || '';
      }
      setLastError({ msg, detail, status: err.response?.status });
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };


  return (
    <div className="sp-animate-in" style={{ maxWidth: 860, margin: '0 auto', padding: '0 4px' }}>

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="sp-page-header" style={{ marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(15,23,42,0.35)',
            }}>
              <FileSpreadsheet size={22} color="#a5b4fc" />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                ADM <span style={{ color: '#6366f1' }}>Reportistica Fiscale</span>
              </h1>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                Generazione file Excel PLI — Agenzia delle Dogane e dei Monopoli
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Step 1: Tipo Report ───────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          1 — Tipo di Report
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          <ReportCard
            id="mensile"
            title="📅 Mensile"
            subtitle="Report completo per un intero mese solare con prospetto vendite, giacenza finale e resi."
            gradient="linear-gradient(135deg, #6366f1, #4f46e5)"
            selected={reportType === 'mensile'}
            onClick={() => setReportType('mensile')}
          />

          <ReportCard
            id="quindicinale"
            title="📋 Quindicinale"
            subtitle="Report per la prima (1–15) o seconda (16–fine mese) quindicina. Obbligatorio ogni 15 giorni."
            gradient="linear-gradient(135deg, #0ea5e9, #0284c7)"
            selected={reportType === 'quindicinale'}
            onClick={() => setReportType('quindicinale')}
          >
            {reportType === 'quindicinale' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {[
                  { v: 1, label: '1ª Quindicina', sub: '1 – 15' },
                  { v: 2, label: '2ª Quindicina', sub: '16 – fine mese' },
                ].map(q => (
                  <button
                    key={q.v}
                    onClick={e => { e.stopPropagation(); setHalf(q.v); }}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                      border: half === q.v ? '2px solid #6366f1' : '2px solid #e2e8f0',
                      background: half === q.v ? 'rgba(99,102,241,0.1)' : '#f8fafc',
                      color: half === q.v ? '#6366f1' : '#64748b',
                      fontWeight: 700, fontSize: 12, textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div>{q.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, marginTop: 2, opacity: 0.7 }}>{q.sub}</div>
                  </button>
                ))}
              </div>
            )}
          </ReportCard>
        </div>
      </div>

      {/* ─── Step 2: Selettore Periodo ────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          2 — Seleziona il Periodo
        </div>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '24px 28px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
                📆 Mese
              </label>
              <StyledSelect
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 8 }}>
                🗓 Anno
              </label>
              <StyledSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />
            </div>
          </div>

          {/* Preview nome file */}
          <div style={{
            marginTop: 20, padding: '12px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
            border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={18} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>File che verrà generato</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                {nomeFile}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Periodo: {periodoLabel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Step 3: Genera ──────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          3 — Genera il Report
        </div>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '28px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
              Pronto per la generazione
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Il sistema interroga il database e genera il file Excel nel formato ADM.
              Il download partirà automaticamente.
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 32px', borderRadius: 16, border: 'none',
              background: generating
                ? '#94a3b8'
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: generating ? 'not-allowed' : 'pointer',
              boxShadow: generating ? 'none' : '0 6px 20px rgba(99,102,241,0.4)',
              transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
              transform: generating ? 'none' : 'translateY(0)',
            }}
            onMouseEnter={e => { if (!generating) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {generating
              ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Generazione in corso...</>
              : <><Download size={18} /> Genera e Scarica</>
            }
          </button>
        </div>
      </div>

      {/* ─── Ultimo generato ─────────────────────────────────────── */}
      {lastGenerated && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac', borderRadius: 16, padding: '16px 24px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <CheckCircle size={22} color="#16a34a" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>
              Ultimo download: {lastGenerated.nome}
            </div>
            <div style={{ fontSize: 12, color: '#4ade80' }}>
              {lastGenerated.periodo} — {lastGenerated.at.toLocaleTimeString('it-IT')}
            </div>
          </div>
        </div>
      )}

      {/* ─── Errore dettagliato ────────────────────────────────────── */}
      {lastError && (
        <div style={{
          marginTop: 16, padding: '16px 20px', borderRadius: 14,
          background: '#fff1f2', border: '1px solid #fecdd3',
          display: 'flex', gap: 12,
        }}>
          <div style={{ fontSize: 18, flexShrink: 0 }}>❌</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#be123c', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>Errore {lastError.status || ''} — {lastError.msg}</span>
              <button onClick={() => setLastError(null)} style={{ background: 'none', border: 'none', color: '#be123c', cursor: 'pointer', fontWeight: 900 }}>×</button>
            </div>
            {lastError.detail && (
              <pre style={{ fontSize: 11, color: '#9f1239', background: '#fff5f5', borderRadius: 8, padding: '10px 12px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto' }}>{lastError.detail}</pre>
            )}
          </div>
        </div>
      )}

      {/* ─── Note informative ─────────────────────────────────────── */}
      <div style={{
        marginTop: 28, padding: '16px 20px', borderRadius: 14,
        background: '#f0f9ff', border: '1px solid #bae6fd',
        display: 'flex', gap: 12,
      }}>
        <div style={{ fontSize: 18, marginTop: 1 }}>💡</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>
            Come funziona la generazione
          </div>
          <div style={{ fontSize: 12, color: '#0c4a6e', lineHeight: 1.7 }}>
            Il sistema genera il file Excel in tre modalità (dalla più avanzata alla base):<br />
            <strong>1. n8n Workflow</strong> — se <code style={{ background: '#e0f2fe', padding: '0 4px', borderRadius: 4 }}>N8N_WEBHOOK_URL</code> è configurato su Railway.<br />
            <strong>2. excel-api</strong> — se <code style={{ background: '#e0f2fe', padding: '0 4px', borderRadius: 4 }}>EXCEL_API_URL</code> è configurato su Railway.<br />
            <strong>3. Generazione nativa</strong> — sempre disponibile come fallback, senza dipendenze esterne.
          </div>
        </div>
      </div>
    </div>
  );
}
