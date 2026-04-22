import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Truck, MapPin, Package, Clock, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const STORAGE_KEY = 'svapro_deliveries_shared'; // condiviso con StoreDeliveriesPage

const loadDeliveries = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const saveDeliveries = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('it-IT', { weekday:'long', day:'2-digit', month:'long' }) : '';

const PRIORITY_LABEL = { high: '🔴 URGENTE', normal: '🟡 Normale', low: '🟢 Bassa' };

/* ───────────────────────────────────────────────────── */
export default function DriverDeliveriesPage() {
  const [deliveries, setDeliveries] = useState(loadDeliveries);
  const [expanded, setExpanded]     = useState(null); // id espanso
  const [noteModal, setNoteModal]   = useState(null); // { id, note }
  const [refreshKey, setRefreshKey] = useState(0);

  // Polling ogni 30s per aggiornamenti dal backend (o quando tab torna in focus)
  useEffect(() => {
    const refresh = () => setDeliveries(loadDeliveries());
    const interval = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);

  const persist = (list) => { setDeliveries(list); saveDeliveries(list); };

  const markDone = (id, note = '') => {
    const updated = deliveries.map(d => d.id === id
      ? { ...d, status: 'done', completed_at: new Date().toISOString(), driver_note: note || d.driver_note, updated_at: new Date().toISOString() }
      : d
    );
    persist(updated);
    setNoteModal(null);
    setExpanded(null);
    toast.success('✅ Consegna segnata come completata!');
  };

  const markIssue = (id, note) => {
    const updated = deliveries.map(d => d.id === id
      ? { ...d, status: 'issue', driver_note: note, updated_at: new Date().toISOString() }
      : d
    );
    persist(updated);
    setNoteModal(null);
    toast.error('⚠️ Problema segnalato');
  };

  const markInProgress = (id) => {
    const updated = deliveries.map(d => d.id === id
      ? { ...d, status: 'in_progress', updated_at: new Date().toISOString() }
      : d
    );
    persist(updated);
  };

  const pending    = deliveries.filter(d => d.status === 'pending' || d.status === 'in_progress');
  const completed  = deliveries.filter(d => d.status === 'done' || d.status === 'issue');

  // ordina: urgente → normale → bassa
  const priOrder = { high: 0, normal: 1, low: 2 };
  pending.sort((a, b) => (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1));

  return (
    <div style={{ minHeight: '100vh', background: '#0F0F1A', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 0', background: 'linear-gradient(180deg, rgba(123,111,208,0.15) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(123,111,208,0.4)' }}>
            <Truck size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Le mie Consegne</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Contatori rapidi */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 20, marginTop: 16 }}>
          <div style={{ flex: 1, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F59E0B' }}>{pending.length}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,158,11,0.8)', textTransform: 'uppercase' }}>Da fare</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981' }}>{completed.filter(d=>d.status==='done').length}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(16,185,129,0.8)', textTransform: 'uppercase' }}>Completate</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#EF4444' }}>{completed.filter(d=>d.status==='issue').length}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.8)', textTransform: 'uppercase' }}>Problemi</div>
          </div>
        </div>
      </div>

      {/* Lista pending */}
      <div style={{ padding: '0 16px 16px' }}>
        {pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <CheckCircle2 size={56} color="rgba(16,185,129,0.4)" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981', marginBottom: 8 }}>Tutto completato! 🎉</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Non ci sono consegne da fare oggi</div>
          </div>
        ) : (
          pending.map((d, i) => {
            const isExpanded = expanded === d.id;
            const isInProgress = d.status === 'in_progress';
            const borderColor = d.priority === 'high' ? '#EF4444' : isInProgress ? '#3B82F6' : '#7B6FD0';
            return (
              <div key={d.id} style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.08)`,
                borderLeft: `4px solid ${borderColor}`, borderRadius: 16, marginBottom: 12,
                overflow: 'hidden',
              }}>
                {/* Header card */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : d.id)}
                  style={{ width: '100%', padding: '16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isInProgress ? 'rgba(59,130,246,0.2)' : 'rgba(123,111,208,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isInProgress ? <Truck size={20} color="#3B82F6" /> : <Circle size={20} color="#7B6FD0" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{d.store_name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {d.priority === 'high' && <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444' }}>🔴 URGENTE</span>}
                      {d.scheduled_date && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{d.scheduled_date}</span>}
                      {isInProgress && <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6' }}>● In corso</span>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.4)" />}
                </button>

                {/* Dettaglio espanso */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {d.items && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <Package size={15} color="rgba(255,255,255,0.4)" style={{ marginTop: 1, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 2 }}>Articoli</div>
                          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{d.items}</div>
                        </div>
                      </div>
                    )}
                    {d.notes && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <MapPin size={15} color="rgba(255,255,255,0.4)" style={{ marginTop: 1, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 2 }}>Note</div>
                          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{d.notes}</div>
                        </div>
                      </div>
                    )}

                    {/* Azioni */}
                    <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {!isInProgress && (
                        <button onClick={() => markInProgress(d.id)} style={{ padding: '12px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Truck size={16} /> Sto andando →
                        </button>
                      )}
                      <button onClick={() => setNoteModal({ id: d.id, action: 'done', note: '' })} style={{ padding: '14px', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
                        <CheckCircle2 size={18} /> FATTO — Consegnato ✓
                      </button>
                      <button onClick={() => setNoteModal({ id: d.id, action: 'issue', note: '' })} style={{ padding: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <AlertCircle size={14} /> Segnala problema
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Completate (collassabili) */}
        {completed.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Completate oggi ({completed.length})
            </div>
            {completed.map(d => (
              <div key={d.id} style={{ background: d.status === 'issue' ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)', border: `1px solid ${d.status === 'issue' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                {d.status === 'done' ? <CheckCircle2 size={18} color="#10B981" /> : <AlertCircle size={18} color="#EF4444" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: d.status === 'done' ? '#10B981' : '#EF4444' }}>{d.store_name}</div>
                  {d.driver_note && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{d.driver_note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nota */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#1C1C2E', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 600, margin: '0 auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: '#fff' }}>
              {noteModal.action === 'done' ? '✅ Conferma Consegna' : '⚠️ Segnala Problema'}
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>Aggiungi una nota (opzionale)</p>
            <textarea
              autoFocus
              value={noteModal.note}
              onChange={e => setNoteModal(n => ({ ...n, note: e.target.value }))}
              placeholder={noteModal.action === 'done' ? 'Es: Consegnato al responsabile...' : 'Es: Negozio chiuso, nessuno presente...'}
              rows={3}
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#fff', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setNoteModal(null)} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Annulla</button>
              <button
                onClick={() => noteModal.action === 'done' ? markDone(noteModal.id, noteModal.note) : markIssue(noteModal.id, noteModal.note)}
                style={{ flex: 2, padding: '14px', background: noteModal.action === 'done' ? '#10B981' : '#EF4444', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer' }}
              >
                {noteModal.action === 'done' ? 'Conferma Consegna ✓' : 'Segnala Problema'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
