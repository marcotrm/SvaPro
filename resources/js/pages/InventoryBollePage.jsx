import React, { useState, useEffect, useRef } from 'react';
import { inventorySessions } from '../api.jsx';
import { useNavigate } from 'react-router-dom';
import { stores as storesApi, catalog } from '../api.jsx';

const STATUS_LABEL = { DRAFT:'Bozza', SENT_TO_STORE:'Inviata', IN_PROGRESS:'In corso', CLOSED_BY_STORE:'Chiusa', UNDER_REVIEW:'In revisione', APPROVED:'Approvata', DISPUTED:'Contestata', REOPENED:'Riaperta', CANCELLED:'Annullata' };
const STATUS_COLOR = { DRAFT:'#6B7280', SENT_TO_STORE:'#3B82F6', IN_PROGRESS:'#F59E0B', CLOSED_BY_STORE:'#8B5CF6', UNDER_REVIEW:'#F59E0B', APPROVED:'#10B981', DISPUTED:'#EF4444', REOPENED:'#F97316', CANCELLED:'#6B7280' };

function Badge({ status }) {
  return <span style={{ background: STATUS_COLOR[status]+'22', color: STATUS_COLOR[status], border: `1px solid ${STATUS_COLOR[status]}44`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{STATUS_LABEL[status] ?? status}</span>;
}

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '18px 20px', minWidth: 130 }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: color ?? 'var(--color-accent)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── CREATE FORM MODAL ─────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [storeList, setStoreList] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', store_id: '', due_date: '', notes_internal: '', filters: { brand: [], category: [], only_positive_stock: true } });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    storesApi.getStores().then(r => setStoreList(r.data?.data ?? r.data ?? [])).catch(() => {});
    catalog.getProducts({ per_page: 1000 }).then(r => {
      const prods = r.data?.data ?? [];
      setBrands([...new Set(prods.map(p => p.brand).filter(Boolean))].sort());
      setCategories([...new Set(prods.map(p => p.category).filter(Boolean))].sort());
    }).catch(() => {});
  }, []);

  const handlePreview = async () => {
    if (!form.store_id) return;
    try {
      const r = await inventorySessions.getPreview({ store_id: form.store_id, filters: form.filters });
      setPreview(r.data);
    } catch {}
  };

  const toggleFilter = (key, val) => {
    setForm(f => {
      const arr = f.filters[key] ?? [];
      return { ...f, filters: { ...f.filters, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] } };
    });
  };

  const handleSubmit = async () => {
    if (!form.title || !form.store_id) { setErr('Titolo e negozio obbligatori'); return; }
    setSaving(true); setErr('');
    try {
      await inventorySessions.create(form);
      onCreated();
    } catch (e) { setErr(e.response?.data?.message ?? 'Errore'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', overflow: 'auto', border: '1px solid var(--color-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--color-text)' }}>📋 Crea Bolla Inventario</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}>×</button>
        </div>
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && <div style={{ background: '#EF444422', color: '#EF4444', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>{err}</div>}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>TITOLO *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Inventario settimanale liquidi..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>NEGOZIO *</label>
              <select value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none' }}>
                <option value="">Seleziona negozio...</option>
                {storeList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>SCADENZA</label>
              <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>FILTRA PER BRAND</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {brands.slice(0, 20).map(b => (
                <button key={b} onClick={() => toggleFilter('brand', b)} style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${form.filters.brand.includes(b) ? 'var(--color-accent)' : 'var(--color-border)'}`, background: form.filters.brand.includes(b) ? 'var(--color-accent)' : 'transparent', color: form.filters.brand.includes(b) ? '#fff' : 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{b}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>FILTRA PER CATEGORIA</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.slice(0, 20).map(c => (
                <button key={c} onClick={() => toggleFilter('category', c)} style={{ padding: '4px 12px', borderRadius: 20, border: `1.5px solid ${form.filters.category.includes(c) ? '#8B5CF6' : 'var(--color-border)'}`, background: form.filters.category.includes(c) ? '#8B5CF6' : 'transparent', color: form.filters.category.includes(c) ? '#fff' : 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{c}</button>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--color-text)' }}>
            <input type="checkbox" checked={form.filters.only_positive_stock} onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, only_positive_stock: e.target.checked } }))} style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
            Solo prodotti con giacenza &gt; 0
          </label>
          <textarea value={form.notes_internal} onChange={e => setForm(f => ({ ...f, notes_internal: e.target.value }))} placeholder="Note interne (non visibili allo store)..." rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          {preview && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--color-text)' }}>
              ℹ️ Questa bolla includerà <strong>{preview.count}</strong> prodotti per il negozio selezionato.
            </div>
          )}
        </div>
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--color-bg)' }}>
          <button onClick={handlePreview} disabled={!form.store_id} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>👁 Anteprima</button>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annulla</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Creazione...' : '📋 Crea Bolla'}</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function InventoryBollePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [kpi, setKpi] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const isAdmin = user && ['superadmin','admin_cliente','magazziniere'].includes(user.role);
  const isDipendente = user && user.role === 'dipendente';

  const load = async () => {
    setLoading(true);
    try {
      if (isDipendente) {
        const r = await inventorySessions.storeGetAll();
        setSessions(r.data?.data ?? []);
      } else {
        const [kR, sR] = await Promise.all([inventorySessions.getKpi(), inventorySessions.getAll(filterStatus ? { status: filterStatus } : {})]);
        setKpi(kR.data?.data);
        setSessions(sR.data?.data ?? []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => { if (user !== null) load(); }, [user, filterStatus]);

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text)' }}>📋 Bolle Inventario</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 4 }}>{isAdmin ? 'Gestisci le bolle per tutti gli store' : 'I tuoi inventari da completare'}</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>+ Crea Bolla</button>
        )}
      </div>

      {/* KPI cards */}
      {isAdmin && kpi && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          <KpiCard label="Inviate" value={kpi.open} color="#3B82F6" />
          <KpiCard label="In corso" value={kpi.in_progress} color="#F59E0B" />
          <KpiCard label="Chiuse" value={kpi.closed} color="#8B5CF6" />
          <KpiCard label="In revisione" value={kpi.under_review} color="#F97316" />
          <KpiCard label="Approvate" value={kpi.approved} color="#10B981" />
          <KpiCard label="Totale" value={kpi.total} color="var(--color-text-secondary)" />
        </div>
      )}

      {/* Filtro status */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['', 'SENT_TO_STORE', 'IN_PROGRESS', 'CLOSED_BY_STORE', 'UNDER_REVIEW', 'APPROVED'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${filterStatus === s ? 'var(--color-accent)' : 'var(--color-border)'}`, background: filterStatus === s ? 'var(--color-accent)' : 'transparent', color: filterStatus === s ? '#fff' : 'var(--color-text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{s === '' ? 'Tutte' : (STATUS_LABEL[s] ?? s)}</button>
          ))}
        </div>
      )}

      {/* Lista bolle */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-tertiary)' }}>Caricamento...</div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Nessuna bolla inventario</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 6 }}>{isAdmin ? 'Crea la prima bolla per iniziare.' : 'Nessun inventario assegnato al momento.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map(s => (
            <div key={s.id} onClick={() => navigate(`/inventory/bolle/${s.id}`)} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '18px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, transition: 'box-shadow 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.14)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', fontFamily: 'monospace' }}>{s.inventory_number}</span>
                  <Badge status={s.status} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {s.store_name && <span>🏪 {s.store_name}</span>}
                  {s.due_date && <span>⏰ Scad. {new Date(s.due_date).toLocaleDateString('it-IT')}</span>}
                  {s.summary && <span>📦 {s.summary.total} prodotti</span>}
                  {s.total_items !== undefined && <span>📦 {s.total_items} prodotti</span>}
                </div>
              </div>
              {s.summary && (
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#10B981' }}>{s.summary.matched}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>OK</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#EF4444' }}>{s.summary.mismatched}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Diff.</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-accent)' }}>{s.summary.accuracy}%</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Accuratezza</div>
                  </div>
                </div>
              )}
              {s.total_items !== undefined && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 700 }}>{s.counted_items}/{s.total_items} contati</div>
                  <div style={{ marginTop: 6, height: 6, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden', width: 120 }}>
                    <div style={{ height: '100%', background: '#10B981', borderRadius: 4, width: `${s.total_items > 0 ? (s.counted_items / s.total_items * 100) : 0}%` }} />
                  </div>
                </div>
              )}
              <div style={{ color: 'var(--color-text-tertiary)', fontSize: 18, flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}
