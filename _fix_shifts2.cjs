const fs = require('fs');
const f = 'resources/js/pages/ShiftsPage.jsx';
let c = fs.readFileSync(f, 'utf8');

// ─── A: Add PM Dashboard view BEFORE the main return ───
// Insert after "  if (!storeId) return (" block ends with ");\n\n  return ("
// We'll insert the PM view right before "  return (\n    <div style={{ padding: '24px 32px'"

const PM_DASHBOARD = `
  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT MANAGER VIEW — Dashboard con lista store e conferma turni
  // ══════════════════════════════════════════════════════════════════════════
  if (isProjectManager && !storeId) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CalendarIcon size={24} color="var(--color-accent)" /> Conferma Turni Settimanali
            </h1>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              Rivedi e conferma i turni bloccati dai responsabili di negozio.
            </div>
          </div>
        </div>

        {/* Week navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, background: 'var(--color-surface)', padding: '12px 20px', borderRadius: 16, border: '1px solid var(--color-border)', width: 'fit-content' }}>
          <button onClick={() => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate()-7); return d; })} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)', minWidth: 200, textAlign: 'center' }}>
            {weekDays[0]?.label} — {weekDays[6]?.label}
          </div>
          <button onClick={() => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate()+7); return d; })} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Store cards */}
        {pmLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-text-tertiary)' }} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {pmStoresList.map(store => {
              const lock = pmWeekLocks.find(l => String(l.store_id) === String(store.id));
              const isLocked = lock?.locked_at && !lock?.confirmed_at;
              const isConfirmed = !!lock?.confirmed_at;
              const statusColor = isConfirmed ? '#10B981' : isLocked ? '#F59E0B' : '#94A3B8';
              const statusLabel = isConfirmed ? 'Confermati' : isLocked ? 'In Attesa di Conferma' : 'Non Inviati';
              const statusIcon = isConfirmed ? '✅' : isLocked ? '🔒' : '⏳';

              return (
                <div key={store.id} style={{
                  background: 'var(--color-surface)', border: \`1px solid \${isLocked ? 'rgba(245,158,11,0.4)' : 'var(--color-border)'}\`,
                  borderRadius: 16, padding: 24, transition: 'all 0.2s',
                  boxShadow: isLocked ? '0 0 0 2px rgba(245,158,11,0.15)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>{store.name}</div>
                      {lock?.locked_by_name && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Bloccato da: {lock.locked_by_name}</div>}
                      {lock?.locked_at && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>il {new Date(lock.locked_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: \`\${statusColor}18\`, color: statusColor }}>
                      {statusIcon} {statusLabel}
                    </span>
                  </div>

                  {isLocked && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handlePmPreview(store)} style={{
                        flex: 1, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.3)',
                        background: 'rgba(245,158,11,0.08)', color: '#D97706', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <CalendarIcon size={14} /> Rivedi Turni
                      </button>
                      <button onClick={() => handlePmConfirm(store.id)} style={{
                        flex: 1, padding: '10px 16px', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      }}>
                        <CheckCircle size={14} /> Conferma
                      </button>
                    </div>
                  )}

                  {isConfirmed && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', fontSize: 12, color: '#10B981', fontWeight: 600 }}>
                      Confermati da {lock.confirmed_by_name || 'PM'} il {new Date(lock.confirmed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {!isLocked && !isConfirmed && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(148,163,184,0.08)', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                      Il responsabile non ha ancora inviato i turni per questa settimana.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PM Preview Modal */}
        {pmPreviewStore && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setPmPreviewStore(null)}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 900, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>Turni — {pmPreviewStore.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Settimana {weekDays[0]?.label} — {weekDays[6]?.label}</div>
                </div>
                <button onClick={() => setPmPreviewStore(null)} style={{ background: 'var(--color-bg)', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>

              {pmPreviewLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-text-tertiary)' }} /></div>
              ) : pmPreviewShifts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>Nessun turno trovato per questa settimana.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', borderBottom: '2px solid var(--color-border)' }}>Dipendente</th>
                        {weekDays.map(d => (
                          <th key={d.dateStr} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: d.isToday ? 'var(--color-accent)' : 'var(--color-text-tertiary)', borderBottom: '2px solid var(--color-border)' }}>{d.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pmPreviewEmps.map(emp => (
                        <tr key={emp.id}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}>{emp.first_name} {emp.last_name}</td>
                          {weekDays.map(d => {
                            const s = pmPreviewShifts.find(sh => String(sh.employee_id) === String(emp.id) && sh.date === d.dateStr);
                            return (
                              <td key={d.dateStr} style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>
                                {s ? (
                                  <div style={{ background: (s.color || '#6366F1') + '22', color: s.color || '#6366F1', borderRadius: 8, padding: '4px 6px', fontSize: 12, fontWeight: 700 }}>
                                    {s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button onClick={() => setPmPreviewStore(null)} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Chiudi</button>
                <button onClick={() => handlePmConfirm(pmPreviewStore.id)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> Conferma Turni
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

`;

c = c.replace(
  `  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}`,
  PM_DASHBOARD + `  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}`
);

// ─── B: Add lock status banner + lock/unlock button after the save button area ───
// After the "Banner info per dipendenti" section
const LOCK_BANNER = `
      {/* ── Lock Status Banner ── */}
      {(isStoreManager || isSuperAdmin) && isWeekLocked && !isWeekConfirmed && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#D97706', fontWeight: 700 }}>
            <span style={{ fontSize: 18 }}>🔒</span> Turni bloccati — in attesa di conferma dal Project Manager.
          </div>
          {(isSuperAdmin) && (
            <button onClick={handleUnlockWeek} disabled={lockLoading} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.12)', color: '#D97706', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {lockLoading ? 'Sblocco...' : '🔓 Sblocca'}
            </button>
          )}
        </div>
      )}

      {(isStoreManager || isSuperAdmin) && isWeekConfirmed && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#10B981', fontWeight: 700 }}>
          <span style={{ fontSize: 18 }}>✅</span> Turni confermati dal Project Manager. Settimana definitiva.
        </div>
      )}

      {/* ── Bottone Blocca/Invia Turni — solo Store Manager ── */}
      {isStoreManager && !isWeekLocked && !isWeekConfirmed && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={handleLockWeek} disabled={lockLoading} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderRadius: 14,
            border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: lockLoading ? 'default' : 'pointer',
            boxShadow: '0 4px 16px rgba(245,158,11,0.35)', width: '100%', justifyContent: 'center',
            opacity: lockLoading ? 0.7 : 1, transition: 'all 0.2s',
          }}>
            {lockLoading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ fontSize: 18 }}>🔒</span>}
            Blocca e Invia Turni al Project Manager
          </button>
        </div>
      )}
`;

c = c.replace(
  `      {/* Banner info per dipendenti */}`,
  LOCK_BANNER + `      {/* Banner info per dipendenti */}`
);

// ─── C: Add Lock icon import ───
c = c.replace(
  `import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Loader, Clock, Trash, X, Download, AlertTriangle, Search, User, Users, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';`,
  `import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Loader, Clock, Trash, X, Download, AlertTriangle, Search, User, Users, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Lock, Unlock } from 'lucide-react';`
);

// ─── D: Disable cell clicks when locked (for store_manager) ───
// The cell click handler uses setActiveCell. We need to guard it.
// Find "onClick={() => handleCellClick" or the cell click  
c = c.replace(
  `  const canSaveShifts = true; // Tutti possono salvare, il backend filtra/usa 'proposed' per i dipendenti`,
  `  const canSaveShifts = !isDipendente; // Dipendenti non possono salvare`
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done. Lines:', c.split('\n').length);
