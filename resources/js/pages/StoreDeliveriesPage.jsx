import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Truck, Plus, Check, Clock, MapPin, Package, Store, ChevronDown,
  ChevronUp, X, AlertCircle, CheckCircle2, Circle, Edit3, Trash2,
  RefreshCw, ExternalLink, Copy
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { stores } from '../api.jsx';

/* ── helpers localStorage ─────────────────────────────────── */
const STORAGE_KEY = 'svapro_store_deliveries';

const loadDeliveries = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const saveDeliveries = (list) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

const STATUS = {
  pending:     { label: 'Da fare',      color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  Icon: Circle },
  in_progress: { label: 'In corso',     color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  Icon: Truck },
  done:        { label: 'Consegnato',   color: '#10B981', bg: 'rgba(16,185,129,0.1)',  Icon: CheckCircle2 },
  issue:       { label: 'Problema',     color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   Icon: AlertCircle },
};

const newId = () => `del_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—';

/* ────────────────────────────────────────────────────────── */
export default function StoreDeliveriesPage() {
  const [deliveries, setDeliveries] = useState(loadDeliveries);
  const [storeList,  setStoreList]  = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [driverLink, setDriverLink]    = useState('');

  /* form state */
  const emptyForm = { store_id: '', store_name: '', notes: '', items: '', scheduled_date: '', priority: 'normal' };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    stores.getAll?.().then(r => setStoreList(r.data?.data || r.data || [])).catch(() => {});
    // Genera link driver
    const base = window.location.origin;
    setDriverLink(`${base}/deliveries/driver`);
  }, []);

  const persist = useCallback((list) => {
    setDeliveries(list);
    saveDeliveries(list);
  }, []);

  const handleFormChange = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'store_id') {
      const s = storeList.find(s => String(s.id) === String(v));
      if (s) setForm(f => ({ ...f, store_id: v, store_name: s.name || s.store_name || '' }));
    }
  };

  const handleSave = () => {
    if (!form.store_name && !form.store_id) return toast.error('Seleziona un negozio');
    const storeName = form.store_name || storeList.find(s => String(s.id) === String(form.store_id))?.name || form.store_id;
    if (editId) {
      persist(deliveries.map(d => d.id === editId ? { ...d, ...form, store_name: storeName, updated_at: new Date().toISOString() } : d));
      toast.success('Consegna aggiornata');
    } else {
      const nd = {
        id: newId(),
        ...form,
        store_name: storeName,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        driver_note: '',
      };
      persist([nd, ...deliveries]);
      toast.success(`✅ Consegna creata per ${storeName}`);
    }
    setForm(emptyForm);
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = (id) => {
    if (!confirm('Eliminare questa consegna?')) return;
    persist(deliveries.filter(d => d.id !== id));
    toast.success('Eliminata');
  };

  const handleEdit = (d) => {
    setForm({ store_id: d.store_id || '', store_name: d.store_name || '', notes: d.notes || '', items: d.items || '', scheduled_date: d.scheduled_date || '', priority: d.priority || 'normal' });
    setEditId(d.id);
    setShowForm(true);
  };

  const filtered = filterStatus === 'all' ? deliveries : deliveries.filter(d => d.status === filterStatus);
  const counts   = Object.fromEntries(Object.keys(STATUS).map(k => [k, deliveries.filter(d => d.status === k).length]));

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius: 14, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(123,111,208,0.35)', flexShrink: 0 }}>
            <Truck size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 900, margin: 0 }}>Consegne Negozi</h1>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '2px 0 0' }}>
              Gestisci le missioni di consegna — il corriere vede cosa fare in tempo reale
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Link corriere */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
            <ExternalLink size={12} color="#10B981" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>Accesso Corriere</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(driverLink); toast.success('Link copiato!'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'flex', padding: 0 }}
              title="Copia link"
            ><Copy size={12} /></button>
            <button
              onClick={() => window.open('/deliveries/driver', '_blank')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', display: 'flex', padding: 0 }}
              title="Apri vista corriere"
            ><ExternalLink size={12} /></button>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
            className="sp-btn sp-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Nuova Consegna
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(STATUS).map(([k, s]) => {
          const { Icon } = s;
          return (
            <button key={k}
              onClick={() => setFilterStatus(f => f === k ? 'all' : k)}
              style={{
                background: filterStatus === k ? s.bg : 'var(--color-surface)',
                border: `1.5px solid ${filterStatus === k ? s.color : 'var(--color-border)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon size={16} color={s.color} />
                <span style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-text)' }}>{counts[k] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* ── Form nuova consegna ── */}
      {showForm && (
        <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-accent)', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 4px 24px rgba(123,111,208,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{editId ? 'Modifica Consegna' : 'Nuova Missione di Consegna'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div style={{ gridColumn: '1/2' }}>
              <label className="sp-label">Negozio *</label>
              {storeList.length > 0 ? (
                <select className="sp-select" value={form.store_id} onChange={e => handleFormChange('store_id', e.target.value)}>
                  <option value="">— Seleziona negozio —</option>
                  {storeList.map(s => <option key={s.id} value={s.id}>{s.name || s.store_name}</option>)}
                </select>
              ) : (
                <input className="sp-input" value={form.store_name} onChange={e => handleFormChange('store_name', e.target.value)} placeholder="Nome negozio / store" />
              )}
            </div>
            <div>
              <label className="sp-label">Data prevista</label>
              <input className="sp-input" type="date" value={form.scheduled_date} onChange={e => handleFormChange('scheduled_date', e.target.value)} />
            </div>
            <div>
              <label className="sp-label">Priorità</label>
              <select className="sp-select" value={form.priority} onChange={e => handleFormChange('priority', e.target.value)}>
                <option value="low">🟢 Bassa</option>
                <option value="normal">🟡 Normale</option>
                <option value="high">🔴 Urgente</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="sp-label">Articoli / Descrizione spedizione</label>
              <input className="sp-input" value={form.items} onChange={e => handleFormChange('items', e.target.value)} placeholder="Es: 3 scatole Kiwi Spark, 2 kit hardware..." />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="sp-label">Note per il corriere</label>
              <textarea className="sp-input" value={form.notes} onChange={e => handleFormChange('notes', e.target.value)} rows={2} placeholder="Es: Consegnare al responsabile, orari di apertura 9-19..." style={{ resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="sp-btn sp-btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Annulla</button>
            <button className="sp-btn sp-btn-primary" onClick={handleSave}>
              <Check size={14} /> {editId ? 'Salva Modifiche' : 'Crea Consegna'}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista consegne ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-tertiary)' }}>
          <Truck size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <p style={{ fontSize: 15, fontWeight: 600 }}>
            {filterStatus === 'all' ? 'Nessuna consegna creata' : `Nessuna consegna con stato "${STATUS[filterStatus]?.label}"`}
          </p>
          <p style={{ fontSize: 13 }}>Clicca "+ Nuova Consegna" per aggiungerne una</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(d => {
            const st = STATUS[d.status] || STATUS.pending;
            const { Icon } = st;
            const priColor = d.priority === 'high' ? '#EF4444' : d.priority === 'low' ? '#10B981' : '#F59E0B';
            const priLabel = d.priority === 'high' ? '🔴 Urgente' : d.priority === 'low' ? '🟢 Bassa' : '🟡 Normale';
            return (
              <div key={d.id} style={{
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Status icon */}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={st.color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>{d.store_name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: priColor }}>{priLabel}</span>
                    {d.scheduled_date && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{fmtDate(d.scheduled_date + 'T00:00:00')}</span>}
                  </div>
                  {d.items && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}><Package size={11} />{d.items}</div>}
                  {d.notes && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={11} />{d.notes}</div>}
                  {d.driver_note && (
                    <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 11, color: '#10B981', fontWeight: 600 }}>
                      💬 Corriere: {d.driver_note}
                    </div>
                  )}
                  {d.completed_at && (
                    <div style={{ fontSize: 11, color: '#10B981', marginTop: 4, fontWeight: 600 }}>
                      ✅ Consegnato il {fmtDate(d.completed_at)} alle {fmtTime(d.completed_at)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleEdit(d)} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                    <Edit3 size={13} />
                  </button>
                  <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
