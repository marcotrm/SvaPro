import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { promotions } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import DatePicker from '../components/DatePicker.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

const PROMO_TYPES = [
  { value: 'percentage', label: 'Percentuale (%)' },
  { value: 'fixed', label: 'Fisso (€)' },
  { value: 'buy_x_get_y', label: 'Compra X Ottieni Y' },
  { value: 'bundle', label: 'Bundle' },
];

export default function PromotionsPage() {
  const { selectedStoreId } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', type: 'percentage', value: '', min_order_amount: '',
    max_uses: '', starts_at: '', ends_at: '',
  });
  const [confirmToDelete, setConfirmToDelete] = useState(null);

  useEffect(() => { fetchList(); }, [filter]);

  const fetchList = async () => {
    try {
      setLoading(true); setError('');
      const res = await promotions.getAll({ status: filter !== 'all' ? filter : undefined });
      setList(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm({ name: '', code: '', type: 'percentage', value: '', min_order_amount: '', max_uses: '', starts_at: '', ends_at: '' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '', code: item.code || '', type: item.type || 'percentage',
      value: item.value ?? '', min_order_amount: item.min_order_amount ?? '',
      max_uses: item.max_uses ?? '', starts_at: item.starts_at?.slice(0, 10) || '',
      ends_at: item.ends_at?.slice(0, 10) || '',
    });
    setEditing(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      const payload = {
        ...form,
        value: parseFloat(form.value) || 0,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      };
      if (editing) {
        await promotions.update(editing.id, payload);
      } else {
        await promotions.create(payload);
      }
      resetForm();
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try {
      await promotions.toggle(id);
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleDelete = (id) => {
    setConfirmToDelete(id);
  };

  const doDelete = async () => {
    const id = confirmToDelete;
    setConfirmToDelete(null);
    try {
      await promotions.remove(id);
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const isExpired = (p) => p.ends_at && new Date(p.ends_at) < new Date();
  const isActive = (p) => p.active && !isExpired(p);
  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';
  const fmtValue = (type, val) => {
    if (type === 'percentage') return `${val}%`;
    if (type === 'fixed') return `€${parseFloat(val).toFixed(2)}`;
    return val;
  };

  const filtered = list.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase())
  );

  // KPIs
  const activeCount = list.filter(p => isActive(p)).length;
  const totalUses = list.reduce((sum, p) => sum + (p.used_count || 0), 0);

  if (loading && list.length === 0) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Promozioni & Bundle</div>
          <div className="page-head-sub">{list.length} promozioni, {activeCount} attive</div>
        </div>
        <button className="btn btn-gold" onClick={() => { resetForm(); setShowForm(true); }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuova Promozione
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Totale Promozioni</div><div className="kpi-value">{list.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Attive</div><div className="kpi-value gold">{activeCount}</div></div>
        <div className="kpi-card"><div className="kpi-label">Scadute</div><div className="kpi-value">{list.filter(p => isExpired(p)).length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Utilizzi Totali</div><div className="kpi-value">{totalUses}</div></div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchList} />}

      {showForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">{editing ? 'Modifica Promozione' : 'Nuova Promozione'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: '0 16px 16px' }}>
            <div><label className="field-label">Nome *</label><input className="field-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="field-label">Codice</label><input className="field-input" placeholder="ESTATE2026" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div>
              <label className="field-label">Tipo *</label>
              <select className="field-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="field-label">Valore *</label><input className="field-input" type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percentage' ? '10' : '5.00'} /></div>
            <div><label className="field-label">Ordine Minimo (€)</label><input className="field-input" type="number" step="0.01" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} /></div>
            <div><label className="field-label">Max Utilizzi</label><input className="field-input" type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} /></div>
            <div><label className="field-label">Inizio</label><DatePicker className="field-input" name="starts_at" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} placeholder="Data inizio" /></div>
            <div><label className="field-label">Fine</label><DatePicker className="field-input" name="ends_at" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} placeholder="Data fine" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={resetForm}>Annulla</button>
            <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.name || !form.value}>{saving ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </div>
      )}

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {['all', 'active', 'inactive', 'expired'].map(f => (
          <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {{ all: 'Tutte', active: 'Attive', inactive: 'Inattive', expired: 'Scadute' }[f]}
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <input className="search-input" placeholder="Cerca promozione..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{filtered.length} risultati</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Codice</th>
              <th>Tipo</th>
              <th>Valore</th>
              <th>Utilizzi</th>
              <th>Periodo</th>
              <th>Stato</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</td>
                <td className="mono">{p.code || '-'}</td>
                <td>{PROMO_TYPES.find(t => t.value === p.type)?.label || p.type}</td>
                <td className="mono" style={{ fontWeight: 600, color: 'var(--gold)' }}>{fmtValue(p.type, p.value)}</td>
                <td className="mono">{p.used_count || 0}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                <td style={{ fontSize: 12, color: 'var(--muted2)' }}>
                  {p.starts_at || p.ends_at ? `${fmtDate(p.starts_at)} → ${fmtDate(p.ends_at)}` : 'Sempre'}
                </td>
                <td>
                  {isExpired(p)
                    ? <span className="badge low"><span className="badge-dot" />Scaduta</span>
                    : p.active
                      ? <span className="badge high"><span className="badge-dot" />Attiva</span>
                      : <span className="badge mid"><span className="badge-dot" />Inattiva</span>
                  }
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleToggle(p.id)}>
                      {p.active ? 'Disattiva' : 'Attiva'}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleEdit(p)}>Modifica</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444' }} onClick={() => handleDelete(p.id)}>Elimina</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessuna promozione trovata</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmModal
        isOpen={confirmToDelete !== null}
        title="Elimina promozione"
        message="Vuoi eliminare questa promozione? I codici sconto non saranno più validi."
        onConfirm={doDelete}
        onCancel={() => setConfirmToDelete(null)}
      />
    </>
  );
}
