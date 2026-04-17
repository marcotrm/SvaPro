import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck, Plus, Check, ChevronLeft, ChevronRight, X, AlertCircle,
  CheckCircle2, Circle, Edit3, Trash2, ExternalLink, Copy, Package, MapPin
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

/* ── storage ─────────────────────────────────────────────── */
const STORAGE_KEY = 'svapro_store_deliveries';
const loadAll  = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveAll  = (l) => localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
const newId    = () => `del_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

/* ── helpers date ────────────────────────────────────────── */
const DAYS_IT  = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
const DAYS_SH  = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=sun
  const diff = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0,0,0,0);
  return dt;
}
function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
function toISO(d) {
  return d.toISOString().slice(0,10);
}
function fmtDay(d) {
  return d.toLocaleDateString('it-IT', { day:'2-digit', month:'short' });
}
function fmtFull(d) {
  return new Date(d).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'2-digit' });
}
function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }) : '';
}

/* ── status config ───────────────────────────────────────── */
const STATUS = {
  pending:     { label: 'Da fare',    color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  Icon: Circle },
  in_progress: { label: 'In corso',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  Icon: Truck },
  done:        { label: 'Consegnato',color: '#10B981', bg: 'rgba(16,185,129,0.12)',  Icon: CheckCircle2 },
  issue:       { label: 'Problema',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   Icon: AlertCircle },
};
const PRI = { high: { label:'🔴 Urgente', color:'#EF4444' }, normal: { label:'🟡 Normale', color:'#F59E0B' }, low: { label:'🟢 Bassa', color:'#10B981' } };

/* ────────────────────────────────────────────────────────── */
export default function StoreDeliveriesPage() {
  const [deliveries, setDeliveries] = useState(loadAll);
  const [storeList,  setStoreList]  = useState([]);
  const [weekStart,  setWeekStart]  = useState(() => getMonday(new Date()));

  /* Modale form */
  const emptyForm = { store_id:'', store_name:'', priority:'normal', scheduled_date:'' };
  const [showModal, setShowModal]   = useState(false);
  const [editId,    setEditId]      = useState(null);
  const [form,      setForm]        = useState(emptyForm);

  /* Modale dettaglio cella */
  const [cellModal, setCellModal]   = useState(null); // { storeId, storeName, dateStr }

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  /* ── settimana corrente ── */
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { dateStr: toISO(d), label: DAYS_IT[i], short: DAYS_SH[i], display: fmtDay(d), date: d };
  });
  const fmtWeekRange = () => {
    const from = weekDays[0].date.toLocaleDateString('it-IT', { day:'2-digit', month:'long' });
    const to   = weekDays[6].date.toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    return `${from} — ${to}`;
  };

  /* ── persist ── */
  const persist = (list) => { setDeliveries(list); saveAll(list); };

  /* ── form handlers ── */
  const openCreate = (storeId, storeName, dateStr) => {
    setForm({ ...emptyForm, store_id: String(storeId || ''), store_name: storeName || '', scheduled_date: dateStr || '' });
    setEditId(null);
    setShowModal(true);
  };
  const openEdit = (d) => {
    setForm({ store_id: String(d.store_id||''), store_name: d.store_name||'', priority: d.priority||'normal', scheduled_date: d.scheduled_date||'' });
    setEditId(d.id);
    setShowModal(true);
  };
  const handleSave = () => {
    const storeName = form.store_name || storeList.find(s => String(s.id) === form.store_id)?.name || form.store_id;
    if (!storeName) return toast.error('Seleziona un negozio');
    if (!form.scheduled_date) return toast.error('Seleziona una data');
    if (editId) {
      persist(deliveries.map(d => d.id === editId ? { ...d, ...form, store_name: storeName, updated_at: new Date().toISOString() } : d));
      toast.success('Consegna aggiornata');
    } else {
      persist([{ id: newId(), ...form, store_name: storeName, status:'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null, driver_note:'' }, ...deliveries]);
      toast.success(`✅ Consegna aggiunta per ${storeName}`);
    }
    setShowModal(false);
    setEditId(null);
  };
  const handleDelete = (id) => {
    if (!confirm('Eliminare questa consegna?')) return;
    persist(deliveries.filter(d => d.id !== id));
    toast.success('Eliminata');
  };
  const toggleStatus = (id) => {
    const d = deliveries.find(x => x.id === id);
    if (!d) return;
    const order = ['pending','in_progress','done','issue'];
    const next  = order[(order.indexOf(d.status) + 1) % order.length];
    persist(deliveries.map(x => x.id === id ? { ...x, status: next, completed_at: next === 'done' ? new Date().toISOString() : x.completed_at, updated_at: new Date().toISOString() } : x));
  };

  /* ── griglia: righe = stores, colonne = weekDays ── */
  // Tutti gli store: quelli dall'API + quelli già nelle consegne di questa settimana
  const deliveriesThisWeek = deliveries.filter(d => weekDays.some(w => w.dateStr === d.scheduled_date));
  const storesInGrid = (() => {
    const map = new Map();
    storeList.forEach(s => map.set(String(s.id), { id: String(s.id), name: s.name || s.store_name || '' }));
    deliveriesThisWeek.forEach(d => { if (d.store_id && !map.has(String(d.store_id))) map.set(String(d.store_id), { id: String(d.store_id), name: d.store_name }); });
    // Se non c'è nessuno dall'API, usa i negozi delle consegne storiche
    if (map.size === 0) {
      const names = new Map();
      deliveries.forEach(d => { if (d.store_name && !names.has(d.store_name)) names.set(d.store_name, { id: d.store_name, name: d.store_name }); });
      names.forEach((v, k) => map.set(k, v));
    }
    return Array.from(map.values());
  })();

  const cellDeliveries = (storeId, dateStr) => deliveries.filter(d =>
    d.scheduled_date === dateStr && (String(d.store_id) === String(storeId) || d.store_name === storeId)
  );

  /* ── KPI ── */
  const counts = Object.fromEntries(Object.keys(STATUS).map(k => [k, deliveries.filter(d => d.status === k).length]));

  /* ── colori colonna giorno ── */
  const todayStr = toISO(new Date());

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius: 14, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(123,111,208,0.3)', flexShrink: 0 }}>
            <Truck size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Consegne Negozi</h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>Pianifica le missioni di consegna settimana per settimana</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Link corriere */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
            <ExternalLink size={12} color="#10B981" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>Vista Corriere</span>
            <button onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/deliveries/driver'); toast.success('Link copiato!'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'flex', padding: 0 }} title="Copia link"><Copy size={12} /></button>
            <button onClick={() => window.open('/deliveries/driver', '_blank')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'flex', padding: 0 }} title="Apri"><ExternalLink size={12} /></button>
          </div>
          <button onClick={() => openCreate('','','')} className="sp-btn sp-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nuova Consegna
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        {Object.entries(STATUS).map(([k, s]) => {
          const { Icon } = s;
          return (
            <div key={k} style={{ flex: 1, background: 'var(--color-surface)', border: `1.5px solid ${s.color}30`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-text)', lineHeight: 1 }}>{counts[k] || 0}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Navigazione settimana ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => setWeekStart(d => addDays(d, -7))} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', minWidth: 280, textAlign: 'center' }}>
          {fmtWeekRange()}
        </div>
        <button onClick={() => setWeekStart(d => addDays(d, 7))} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => setWeekStart(getMonday(new Date()))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Oggi
        </button>
      </div>

      {/* ── Griglia settimanale ── */}
      <div style={{ overflowX: 'auto', flex: 1, borderRadius: 14, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              {/* Intestazione negozio */}
              <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-bg)', borderBottom: '2px solid var(--color-border)', borderRight: '1px solid var(--color-border)', position: 'sticky', left: 0, zIndex: 3, minWidth: 160, whiteSpace: 'nowrap' }}>
                Store / Negozio
              </th>
              {weekDays.map(day => {
                const isToday = day.dateStr === todayStr;
                return (
                  <th key={day.dateStr} style={{
                    padding: '10px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center',
                    background: isToday ? 'rgba(123,111,208,0.08)' : 'var(--color-bg)',
                    borderBottom: `2px solid ${isToday ? '#7B6FD0' : 'var(--color-border)'}`,
                    borderRight: '1px solid var(--color-border)',
                    color: isToday ? '#7B6FD0' : 'var(--color-text)',
                    minWidth: 128, position: 'sticky', top: 0, zIndex: 2,
                  }}>
                    <div style={{ fontWeight: 800 }}>{day.short}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: isToday ? '#7B6FD0' : 'var(--color-text-tertiary)', marginTop: 2 }}>{day.display}</div>
                    {isToday && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#7B6FD0', margin: '4px auto 0' }} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {storesInGrid.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                  <Truck size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Nessun negozio trovato</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Aggiungi una consegna o attendi il caricamento degli store</div>
                </td>
              </tr>
            ) : storesInGrid.map((store, si) => (
              <tr key={store.id} style={{ background: si % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                {/* Nome negozio (sticky) */}
                <td style={{
                  padding: '10px 14px', fontWeight: 800, fontSize: 13,
                  color: 'var(--color-text)', background: si % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)',
                  borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)',
                  position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `hsl(${(si * 47 + 220) % 360},60%,55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                      {store.name.charAt(0).toUpperCase()}
                    </div>
                    {store.name}
                  </div>
                </td>
                {/* Cella per ogni giorno */}
                {weekDays.map(day => {
                  const isToday = day.dateStr === todayStr;
                  const cell = cellDeliveries(store.id, day.dateStr);
                  return (
                    <td key={day.dateStr}
                      style={{
                        padding: 6, verticalAlign: 'top', height: 80,
                        borderBottom: '1px solid var(--color-border)',
                        borderRight: '1px solid var(--color-border)',
                        background: isToday ? 'rgba(123,111,208,0.04)' : 'transparent',
                        position: 'relative', cursor: 'default',
                      }}
                    >
                      {/* Consegne nella cella */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
                        {cell.map(d => {
                          const st = STATUS[d.status] || STATUS.pending;
                          return (
                            <div key={d.id}
                              style={{
                                background: st.bg, border: `1px solid ${st.color}40`,
                                borderLeft: `3px solid ${st.color}`,
                                borderRadius: 6, padding: '4px 7px', fontSize: 11, fontWeight: 700,
                                color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
                                transition: 'opacity 0.1s',
                              }}
                              onClick={() => openEdit(d)}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {d.items || d.notes || '—'}
                              </span>
                              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                <button
                                  title={`Stato: ${st.label} — clicca per cambiare`}
                                  onClick={e => { e.stopPropagation(); toggleStatus(d.id); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, display: 'flex', borderRadius: 4, color: st.color }}
                                >
                                  <st.Icon size={11} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDelete(d.id); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, display: 'flex', borderRadius: 4, color: '#EF4444', opacity: 0.6 }}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Pulsante + aggiungi */}
                      <button
                        onClick={() => openCreate(store.id, store.name, day.dateStr)}
                        style={{
                          position: 'absolute', bottom: 4, right: 4,
                          width: 20, height: 20, borderRadius: 5, border: '1px dashed var(--color-border)',
                          background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)',
                          fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.1s', lineHeight: 1, padding: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,111,208,0.12)'; e.currentTarget.style.color = '#7B6FD0'; e.currentTarget.style.borderColor = '#7B6FD0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                        title={`Aggiungi consegna per ${store.name} il ${day.display}`}
                      >+</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal crea / modifica ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{editId ? 'Modifica Consegna' : 'Nuova Consegna'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label">Negozio *</label>
                <select className="sp-select" value={form.store_id} onChange={e => {
                  const s = storeList.find(x => String(x.id) === e.target.value);
                  setForm(f => ({ ...f, store_id: e.target.value, store_name: s ? (s.name || s.store_name) : '' }));
                }}>
                  <option value="">— Seleziona negozio —</option>
                  {storeList.map(s => <option key={s.id} value={s.id}>{s.name || s.store_name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Data *</label>
                <input className="sp-input" type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <label className="sp-label">Priorità</label>
                <select className="sp-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">🟢 Bassa</option>
                  <option value="normal">🟡 Normale</option>
                  <option value="high">🔴 Urgente</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              {editId && (
                <button className="sp-btn" onClick={() => { handleDelete(editId); setShowModal(false); }} style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', marginRight: 'auto' }}>
                  <Trash2 size={13} /> Elimina
                </button>
              )}
              <button className="sp-btn sp-btn-ghost" onClick={() => setShowModal(false)}>Annulla</button>
              <button className="sp-btn sp-btn-primary" onClick={handleSave}>
                <Check size={14} /> {editId ? 'Salva' : 'Crea Consegna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
