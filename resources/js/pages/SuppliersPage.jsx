import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { suppliers } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function SuppliersPage() {
  const { selectedStoreId } = useOutletContext();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', email: '', phone: '', vat_number: '',
    address: '', city: '', province: '', zip: '', country: 'IT', notes: '',
    // Logistica riordino
    lead_time_giorni: '', min_stock_days: '', max_stock_days: '', moq: '',
  });
  const [confirmToDelete, setConfirmToDelete] = useState(null);

  useEffect(() => { fetchList(); }, []);

  const fetchList = async () => {
    try {
      setLoading(true); setError('');
      const res = await suppliers.getAll();
      setList(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento fornitori');
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm({ name: '', code: '', email: '', phone: '', vat_number: '', address: '', city: '', province: '', zip: '', country: 'IT', notes: '' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '', code: item.code || '', email: item.email || '', phone: item.phone || '',
      vat_number: item.vat_number || '', address: item.address || '', city: item.city || '',
      province: item.province || '', zip: item.zip || '', country: item.country || 'IT', notes: item.notes || '',
      lead_time_giorni: item.lead_time_giorni ?? '',
      min_stock_days:   item.min_stock_days ?? '',
      max_stock_days:   item.max_stock_days ?? '',
      moq:              item.moq ?? '',
    });
    setEditing(item);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      if (editing) {
        await suppliers.update(editing.id, form);
      } else {
        await suppliers.create(form);
      }
      resetForm();
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel salvataggio');
    } finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmToDelete(id);
  };

  const doDelete = async () => {
    const id = confirmToDelete;
    setConfirmToDelete(null);
    try {
      await suppliers.remove(id);
      await fetchList();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella cancellazione');
    }
  };

  const filtered = list.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Fornitori</div>
          <div className="page-head-sub">{list.length} fornitori registrati</div>
        </div>
        <button className="btn btn-gold" onClick={() => { resetForm(); setShowForm(true); }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuovo Fornitore
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchList} />}

      {showForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar">
            <div className="section-title">{editing ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: '0 16px 16px' }}>
            <div><label className="field-label">Nome *</label><input className="field-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="field-label">Codice</label><input className="field-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input className="field-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="field-label">Telefono</label><input className="field-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="field-label">P.IVA</label><input className="field-input" value={form.vat_number} onChange={e => setForm({ ...form, vat_number: e.target.value })} /></div>
            <div><label className="field-label">Indirizzo</label><input className="field-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><label className="field-label">Città</label><input className="field-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><label className="field-label">Provincia</label><input className="field-input" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} /></div>
            <div><label className="field-label">CAP</label><input className="field-input" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label className="field-label">Note</label><input className="field-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>

            {/* ── Sezione logistica riordino ── */}
            <div style={{ gridColumn: '1 / -1', margin: '8px 0 4px', borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>📦 Impostazioni Logistica &amp; Riordino Automatico</span>
            </div>
            <div>
              <label className="field-label">Tempo Consegna (giorni) <span style={{ color: '#6366f1', fontWeight: 700 }}>*</span></label>
              <input className="field-input" type="number" min="1" max="365"
                placeholder="es. 7"
                value={form.lead_time_giorni}
                onChange={e => setForm({ ...form, lead_time_giorni: e.target.value })}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Usato nella formula di riordino: vendite/giorno × giorni</div>
            </div>
            <div>
              <label className="field-label">Giorni Scorta Min. (Trigger)</label>
              <input className="field-input" type="number" min="1" max="365"
                placeholder="es. 20"
                value={form.min_stock_days}
                onChange={e => setForm({ ...form, min_stock_days: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">Giorni Scorta Max. (Target)</label>
              <input className="field-input" type="number" min="1" max="365"
                placeholder="es. 30"
                value={form.max_stock_days}
                onChange={e => setForm({ ...form, max_stock_days: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label">MOQ — Minimo d'Ordine (pz)</label>
              <input className="field-input" type="number" min="1"
                placeholder="es. 6"
                value={form.moq}
                onChange={e => setForm({ ...form, moq: e.target.value })}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Quantità minima per ordine al fornitore</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={resetForm}>Annulla</button>
            <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <input className="search-input" placeholder="Cerca fornitore..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 280 }} />
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{filtered.length} risultati</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Codice</th>
              <th>Email</th>
              <th>Telefono</th>
              <th>P.IVA</th>
              <th>Città</th>
              <th>Lead Time</th>
              <th>Min/Max (gg)</th>
              <th style={{ textAlign: 'center' }}>MOQ</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{s.name}</td>
                <td className="mono">{s.code || '-'}</td>
                <td>{s.email || '-'}</td>
                <td>{s.phone || '-'}</td>
                <td className="mono">{s.vat_number || '-'}</td>
                <td>{s.city || '-'}</td>
                <td style={{ textAlign: 'center' }}>
                  {s.lead_time_giorni
                    ? <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{s.lead_time_giorni}gg</span>
                    : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                </td>
                <td>
                  {s.min_stock_days || s.max_stock_days
                    ? <span style={{ fontSize: 12, fontWeight: 600 }}>{s.min_stock_days || '20'}/{s.max_stock_days || '30'}</span>
                    : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Standard</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {s.moq ? <span style={{ fontSize: 12, fontWeight: 600 }}>{s.moq} pz</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => handleEdit(s)}>Modifica</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: '#ef4444' }} onClick={() => handleDelete(s.id)}>Elimina</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun fornitore trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ConfirmModal
        isOpen={confirmToDelete !== null}
        title="Elimina fornitore"
        message="Vuoi eliminare questo fornitore? Tutte le fatture associate potrebbero essere influenzate."
        onConfirm={doDelete}
        onCancel={() => setConfirmToDelete(null)}
      />
    </>
  );
}
