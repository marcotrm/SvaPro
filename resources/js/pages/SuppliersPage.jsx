import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { suppliers, replenishment, clearApiCache } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { Truck, Zap, RefreshCw, PackageCheck, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '', code: '', email: '', phone: '', vat_number: '',
  address: '', city: '', province: '', zip: '', country: 'IT',
  lead_time_days: 7, notes: '',
};

export default function SuppliersPage() {
  const { selectedStoreId } = useOutletContext();
  const [list, setList]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [confirmToDelete, setConfirmToDelete] = useState(null);

  // ── Riordino Automatico ──
  const [showReplenish, setShowReplenish]     = useState(false);
  const [replenishLoading, setReplenishLoading] = useState(false);
  const [replenishResult, setReplenishResult] = useState(null);

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

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setShowForm(false); };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '', code: item.code || '', email: item.email || '',
      phone: item.phone || '', vat_number: item.vat_number || '',
      address: item.address || '', city: item.city || '',
      province: item.province || '', zip: item.zip || '',
      country: item.country || 'IT',
      lead_time_days: item.lead_time_days ?? 7,
      notes: item.notes || '',
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
      clearApiCache();
      resetForm();
      await fetchList();
      toast.success(editing ? 'Fornitore aggiornato ✅' : 'Fornitore creato 🎉');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel salvataggio');
    } finally { setSaving(false); }
  };

  const doDelete = async () => {
    const id = confirmToDelete;
    setConfirmToDelete(null);
    try {
      await suppliers.remove(id);
      await fetchList();
      toast.success('Fornitore eliminato');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nella cancellazione');
    }
  };

  // ── DRP / MRP trigger ──
  const handleReplenish = async (mode) => {
    try {
      setReplenishLoading(true);
      setReplenishResult(null);
      const res = await replenishment.trigger();
      setReplenishResult(res.data);
      const drp = res.data?.drp?.transfers_created?.length ?? 0;
      const mrp = res.data?.mrp?.orders_created?.length ?? 0;
      toast.success(`DRP: ${drp} trasferimenti — MRP: ${mrp} ordini d'acquisto`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore nel riordino');
    } finally { setReplenishLoading(false); }
  };

  const handlePreview = async () => {
    try {
      setReplenishLoading(true);
      setReplenishResult(null);
      const res = await replenishment.preview();
      setReplenishResult({ ...res.data, dry_run: true });
      toast.success('Anteprima generata (nessuna scrittura)');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore nella preview');
    } finally { setReplenishLoading(false); }
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowReplenish(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} />
            Riordino Automatico
            {showReplenish ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button className="btn btn-gold" onClick={() => { resetForm(); setShowForm(true); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuovo Fornitore
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchList} />}

      {/* ── PANNELLO RIORDINO AUTOMATICO ── */}
      {showReplenish && (
        <div className="table-card" style={{ marginBottom: 16, borderLeft: '3px solid #6366F1' }}>
          <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={16} color="#6366F1" />
              <span className="section-title" style={{ color: '#6366F1' }}>Motore Riordino Automatico</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Il motore esegue due fasi:<br />
              <strong>📦 DRP</strong> — Calcola i negozi sotto soglia e genera richieste di trasferimento dal magazzino centrale.<br />
              <strong>🛒 MRP</strong> — Controlla il magazzino centrale (dopo aver imputato gli impegni DRP) e genera ordini d'acquisto verso i fornitori.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost"
                onClick={handlePreview}
                disabled={replenishLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #6366F1', color: '#6366F1' }}
              >
                <Zap size={14} />
                {replenishLoading ? 'Calcolo...' : 'Anteprima (dry-run)'}
              </button>
              <button
                className="btn btn-gold"
                onClick={() => handleReplenish()}
                disabled={replenishLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} />
                {replenishLoading ? 'Esecuzione...' : '▶ Esegui DRP + MRP'}
              </button>
            </div>

            {/* Risultati */}
            {replenishResult && (
              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* DRP */}
                <div style={{ background: 'rgba(99,102,241,0.06)', borderRadius: 10, padding: 14, border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#6366F1' }}>
                    <PackageCheck size={14} /> DRP — Trasferimenti Negozi
                    {replenishResult.dry_run && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 6px' }}>ANTEPRIMA</span>}
                  </div>
                  {(replenishResult.drp?.transfers_created?.length > 0) ? (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--muted)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Prodotto</th>
                          <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Negozio</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Qtà</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Consegna</th>
                        </tr>
                      </thead>
                      <tbody>
                        {replenishResult.drp.transfers_created.map((t, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600 }}>{t.product_name}</td>
                            <td style={{ padding: '5px 6px', color: 'var(--muted)' }}>{t.store_name}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700 }}>{t.order_qty}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--muted)' }}>{t.expected_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                      ✅ Nessun trasferimento necessario
                    </div>
                  )}
                  {replenishResult.drp?.skipped?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                      {replenishResult.drp.skipped.length} articoli ignorati (già coperti o magazzino insufficiente)
                    </div>
                  )}
                </div>

                {/* MRP */}
                <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 10, padding: 14, border: '1px solid rgba(16,185,129,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#059669' }}>
                    <ShoppingCart size={14} /> MRP — Ordini a Fornitori
                    {replenishResult.dry_run && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 6px' }}>ANTEPRIMA</span>}
                  </div>
                  {(replenishResult.mrp?.orders_created?.length > 0) ? (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--muted)' }}>
                          <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Fornitore</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Righe</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Lead T.</th>
                          <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Arrivo previsto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {replenishResult.mrp.orders_created.map((o, i) => {
                          const sup = list.find(s => s.id === o.supplier_id);
                          return (
                            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 6px', fontWeight: 600 }}>{sup?.name || `#${o.supplier_id}`}</td>
                              <td style={{ padding: '5px 6px', textAlign: 'right' }}>{o.lines}</td>
                              <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--muted)' }}>{o.lead_time_days}gg</td>
                              <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--muted)' }}>{o.expected_at}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                      ✅ Nessun ordine necessario
                    </div>
                  )}
                  {replenishResult.mrp?.skipped?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                      {replenishResult.mrp.skipped.length} articoli ignorati (PO già in corso o nessun fornitore)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FORM FORNITORE ── */}
      {showForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar">
            <div className="section-title">{editing ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: '0 16px 16px' }}>
            <div><label className="field-label">Nome *</label><input className="field-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="field-label">Codice</label><input className="field-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input className="field-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="field-label">Telefono</label><input className="field-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="field-label">P.IVA</label><input className="field-input" value={form.vat_number} onChange={e => setForm({ ...form, vat_number: e.target.value })} /></div>
            <div>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Truck size={12} color="#6366F1" />
                Lead Time (giorni consegna)
              </label>
              <input
                className="field-input"
                type="number"
                min={1}
                max={365}
                value={form.lead_time_days}
                onChange={e => setForm({ ...form, lead_time_days: parseInt(e.target.value) || 7 })}
                style={{ borderColor: '#6366F1' }}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                Usato dal MRP per calcolare la data d'arrivo prevista dell'ordine
              </div>
            </div>
            <div><label className="field-label">Indirizzo</label><input className="field-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div><label className="field-label">Città</label><input className="field-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><label className="field-label">Provincia</label><input className="field-input" value={form.province} onChange={e => setForm({ ...form, province: e.target.value })} /></div>
            <div><label className="field-label">CAP</label><input className="field-input" value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2' }}><label className="field-label">Note</label><input className="field-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={resetForm}>Annulla</button>
            <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </div>
      )}

      {/* ── TABELLA FORNITORI ── */}
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
              <th style={{ textAlign: 'center' }}>Lead Time</th>
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
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(99,102,241,0.1)', color: '#6366F1',
                    borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700,
                  }}>
                    <Truck size={11} />
                    {s.lead_time_days ?? 7}gg
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => handleEdit(s)}>Modifica</button>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: '#ef4444' }} onClick={() => setConfirmToDelete(s.id)}>Elimina</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun fornitore trovato</td></tr>
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
