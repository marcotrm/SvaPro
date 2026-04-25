import React, { useState, useEffect } from 'react';
import { CheckCircle2, Truck, MapPin, Package, Clock, AlertCircle, ChevronDown, ChevronUp, X, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { driverDeliveries } from '../api.jsx';

function getTenantCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tk') || '';
}

export default function DriverDeliveriesPage() {
  const tenantCode = getTenantCode();
  const [pending,   setPending]   = useState([]);
  const [completed, setCompleted] = useState([]);
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState(null);
  const [noteModal, setNoteModal] = useState(null);

  const fetchAll = async () => {
    if (!tenantCode) { setError('Link non valido: parametro ?tk= mancante.'); setLoading(false); return; }
    try {
      const res = await driverDeliveries.getAll(tenantCode);
      setPending(res.data?.data || []);
      setCompleted(res.data?.completed || []);
      setTenantName(res.data?.tenant?.name || '');
    } catch (e) {
      setError('Impossibile caricare le consegne. Verifica il link.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Polling ogni 30s
  useEffect(() => {
    const t = setInterval(fetchAll, 30000);
    window.addEventListener('focus', fetchAll);
    return () => { clearInterval(t); window.removeEventListener('focus', fetchAll); };
  }, [tenantCode]);

  const updateStatus = async (id, status, note = '') => {
    try {
      await driverDeliveries.updateStatus(id, tenantCode, { status, driver_note: note || undefined });
      setNoteModal(null);
      setExpanded(null);
      if (status === 'done') toast.success('? Consegna completata!');
      if (status === 'issue') toast.error('??️ Problema segnalato');
      if (status === 'in_progress') toast('🚚 In corso!');
      fetchAll();
    } catch { toast.error('Errore aggiornamento'); }
  };

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <Loader size={32} color="#7B6FD0" style={{ animation:'spin 1s linear infinite' }} />
      <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14 }}>Caricamento consegne...</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ textAlign:'center', color:'#F87171', fontSize:15, maxWidth:320 }}>
        <AlertCircle size={40} style={{ marginBottom:12 }} />
        <div>{error}</div>
        <div style={{ marginTop:8, fontSize:12, color:'rgba(255,255,255,0.3)' }}>Chiedi all'amministratore il link corretto.</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#fff', fontFamily:'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ padding:'20px 20px 0', background:'linear-gradient(180deg, rgba(123,111,208,0.15) 0%, transparent 100%)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:'linear-gradient(135deg,#7B6FD0,#5B50B0)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(123,111,208,0.4)' }}>
            <Truck size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize:20, fontWeight:900 }}>Le mie Consegne</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>
              {tenantName && <span>{tenantName} · </span>}
              {new Date().toLocaleDateString('it-IT', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
            </div>
          </div>
        </div>

        {/* Contatori */}
        <div style={{ display:'flex', gap:8, paddingBottom:20, marginTop:16 }}>
          <div style={{ flex:1, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#F59E0B' }}>{pending.length}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(245,158,11,0.8)', textTransform:'uppercase' }}>Da fare</div>
          </div>
          <div style={{ flex:1, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)', borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#10B981' }}>{completed.filter(d=>d.status==='done').length}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(16,185,129,0.8)', textTransform:'uppercase' }}>Completate</div>
          </div>
          <div style={{ flex:1, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#EF4444' }}>{completed.filter(d=>d.status==='issue').length}</div>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(239,68,68,0.8)', textTransform:'uppercase' }}>Problemi</div>
          </div>
        </div>
      </div>

      {/* Lista pending */}
      <div style={{ padding:'0 16px 16px' }}>
        {pending.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <CheckCircle2 size={56} color="rgba(16,185,129,0.4)" style={{ marginBottom:16 }} />
            <div style={{ fontSize:18, fontWeight:800, color:'#10B981', marginBottom:8 }}>Tutto completato! 🎉</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Non ci sono consegne da fare oggi</div>
          </div>
        ) : (
          pending.map((d) => {
            const isExpanded = expanded === d.id;
            const isInProgress = d.status === 'in_progress';
            const borderColor = d.priority === 'high' ? '#EF4444' : isInProgress ? '#3B82F6' : '#7B6FD0';
            return (
              <div key={d.id} style={{
                background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.08)`,
                borderLeft:`4px solid ${borderColor}`, borderRadius:16, marginBottom:12,
                overflow:'hidden',
              }}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : d.id)}
                  style={{ width:'100%', padding:'16px', background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}
                >
                  <div style={{ width:44, height:44, borderRadius:12, background: isInProgress ? 'rgba(59,130,246,0.2)' : 'rgba(123,111,208,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {isInProgress ? <Truck size={20} color="#3B82F6" /> : <div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid #7B6FD0' }} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:2 }}>{d.store_name}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                      {d.priority === 'high' && <span style={{ fontSize:10, fontWeight:800, color:'#EF4444' }}>🔴 URGENTE</span>}
                      {isInProgress && <span style={{ fontSize:10, fontWeight:700, color:'#3B82F6' }}>● In corso</span>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={18} color="rgba(255,255,255,0.4)" />}
                </button>

                {isExpanded && (
                  <div style={{ padding:'0 16px 16px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                    {d.items && (
                      <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <Package size={15} color="rgba(255,255,255,0.4)" style={{ marginTop:1, flexShrink:0 }} />
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginBottom:2 }}>Articoli</div>
                          <div style={{ fontSize:14, color:'#fff', fontWeight:600 }}>{d.items}</div>
                        </div>
                      </div>
                    )}
                    {d.notes && (
                      <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <MapPin size={15} color="rgba(255,255,255,0.4)" style={{ marginTop:1, flexShrink:0 }} />
                        <div>
                          <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', marginBottom:2 }}>Note</div>
                          <div style={{ fontSize:14, color:'rgba(255,255,255,0.8)' }}>{d.notes}</div>
                        </div>
                      </div>
                    )}

                    <div style={{ paddingTop:14, display:'flex', flexDirection:'column', gap:8 }}>
                      {!isInProgress && (
                        <button onClick={() => updateStatus(d.id, 'in_progress')} style={{ padding:'12px', background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:12, fontSize:14, fontWeight:700, color:'#3B82F6', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          <Truck size={16} /> Sto andando ?
                        </button>
                      )}
                      <button onClick={() => setNoteModal({ id: d.id, action: 'done', note: '' })} style={{ padding:'14px', background:'linear-gradient(135deg,#10B981,#059669)', border:'none', borderRadius:12, fontSize:15, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 16px rgba(16,185,129,0.3)' }}>
                        <CheckCircle2 size={18} /> FATTO — Consegnato ✓
                      </button>
                      <button onClick={() => setNoteModal({ id: d.id, action: 'issue', note: '' })} style={{ padding:'10px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, fontSize:13, fontWeight:700, color:'#EF4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                        <AlertCircle size={14} /> Segnala problema
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Completate oggi */}
        {completed.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
              Completate oggi ({completed.length})
            </div>
            {completed.map(d => (
              <div key={d.id} style={{ background: d.status === 'issue' ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)', border:`1px solid ${d.status === 'issue' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
                {d.status === 'done' ? <CheckCircle2 size={18} color="#10B981" /> : <AlertCircle size={18} color="#EF4444" />}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color: d.status === 'done' ? '#10B981' : '#EF4444' }}>{d.store_name}</div>
                  {d.driver_note && <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:2 }}>{d.driver_note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nota */}
      {noteModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:999, display:'flex', alignItems:'flex-end' }}>
          <div style={{ background:'#1C1C2E', borderRadius:'20px 20px 0 0', padding:24, width:'100%', maxWidth:600, margin:'0 auto' }}>
            <h3 style={{ fontSize:16, fontWeight:800, marginBottom:12, color:'#fff' }}>
              {noteModal.action === 'done' ? '? Conferma Consegna' : '??️ Segnala Problema'}
            </h3>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:14 }}>Aggiungi una nota (opzionale)</p>
            <textarea
              autoFocus
              value={noteModal.note}
              onChange={e => setNoteModal(n => ({ ...n, note: e.target.value }))}
              placeholder={noteModal.action === 'done' ? 'Es: Consegnato al responsabile...' : 'Es: Negozio chiuso, nessuno presente...'}
              rows={3}
              style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', fontSize:14, color:'#fff', outline:'none', resize:'none', boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', gap:10, marginTop:14 }}>
              <button onClick={() => setNoteModal(null)} style={{ flex:1, padding:'14px', background:'rgba(255,255,255,0.07)', border:'none', borderRadius:12, fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.6)', cursor:'pointer' }}>Annulla</button>
              <button
                onClick={() => updateStatus(noteModal.id, noteModal.action === 'done' ? 'done' : 'issue', noteModal.note)}
                style={{ flex:2, padding:'14px', background: noteModal.action === 'done' ? '#10B981' : '#EF4444', border:'none', borderRadius:12, fontSize:15, fontWeight:800, color:'#fff', cursor:'pointer' }}
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
