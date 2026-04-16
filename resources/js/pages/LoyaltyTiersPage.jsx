import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { loyalty } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function LoyaltyTiersPage() {
  const { selectedStoreId } = useOutletContext();
  const [tab, setTab] = useState('tiers');
  const [tiers, setTiers] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [redemptionStats, setRedemptionStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tier form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', code: '', min_points: '', multiplier: '1', cashback_percent: '0', color: '#c9a227', sort_order: '0', benefits_json: '',
  });
  const [confirmToDelete, setConfirmToDelete] = useState(null);

  useEffect(() => { fetchData(); }, [tab]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      if (tab === 'tiers') {
        const res = await loyalty.getTiers();
        setTiers(res.data?.data || []);
      } else {
        const res = await loyalty.getRedemptionHistory();
        setRedemptions(res.data?.data || []);
        setRedemptionStats(res.data?.stats || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm({ name: '', code: '', min_points: '', multiplier: '1', cashback_percent: '0', color: '#c9a227', sort_order: '0', benefits_json: '' });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (tier) => {
    setForm({
      name: tier.name || '', code: tier.code || '', min_points: String(tier.min_points ?? ''),
      multiplier: String(tier.multiplier ?? '1'), cashback_percent: String(tier.cashback_percent ?? '0'),
      color: tier.color || '#c9a227', sort_order: String(tier.sort_order ?? '0'),
      benefits_json: tier.benefits_json || '',
    });
    setEditing(tier);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true); setError('');
      const payload = {
        name: form.name,
        code: form.code,
        min_points: parseInt(form.min_points) || 0,
        multiplier: parseFloat(form.multiplier) || 1,
        cashback_percent: parseFloat(form.cashback_percent) || 0,
        color: form.color,
        sort_order: parseInt(form.sort_order) || 0,
        benefits_json: form.benefits_json || null,
      };
      if (editing) {
        await loyalty.updateTier(editing.id, payload);
      } else {
        await loyalty.createTier(payload);
      }
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setConfirmToDelete(id);
  };

  const doDelete = async () => {
    const id = confirmToDelete;
    setConfirmToDelete(null);
    try {
      await loyalty.deleteTier(id);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));
  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';

  // Count total customers across tiers
  const totalCustomers = tiers.reduce((sum, t) => sum + (t.customers_count || 0), 0);

  if (loading && tiers.length === 0 && redemptions.length === 0) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Loyalty Tiers & Cashback</div>
          <div className="page-head-sub">{tiers.length} tier configurati, {totalCustomers} clienti iscritti</div>
        </div>
        {tab === 'tiers' && (
          <button className="btn btn-gold" onClick={() => { resetForm(); setShowForm(true); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuovo Tier
          </button>
        )}
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchData} />}

      {/* Tabs */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {['tiers', 'redemptions'].map(t => (
          <button key={t} className={`filter-chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'tiers' ? 'Tiers' : 'Storico Riscatti'}
          </button>
        ))}
      </div>

      {/* TIERS TAB */}
      {tab === 'tiers' && (
        <>
          {showForm && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-toolbar"><div className="section-title">{editing ? 'Modifica Tier' : 'Nuovo Tier'}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: '0 16px 16px' }}>
                <div><label className="field-label">Nome *</label><input className="field-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Gold" /></div>
                {!editing && <div><label className="field-label">Codice *</label><input className="field-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="gold" /></div>}
                <div><label className="field-label">Punti Minimi</label><input className="field-input" type="number" value={form.min_points} onChange={e => setForm({ ...form, min_points: e.target.value })} placeholder="500" /></div>
                <div><label className="field-label">Moltiplicatore Punti</label><input className="field-input" type="number" step="0.1" value={form.multiplier} onChange={e => setForm({ ...form, multiplier: e.target.value })} placeholder="1.5" /></div>
                <div><label className="field-label">Cashback %</label><input className="field-input" type="number" step="0.5" value={form.cashback_percent} onChange={e => setForm({ ...form, cashback_percent: e.target.value })} placeholder="2" /></div>
                <div><label className="field-label">Colore</label><input className="field-input" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ height: 38, padding: 4 }} /></div>
                <div><label className="field-label">Ordine</label><input className="field-input" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
                <div style={{ gridColumn: 'span 2' }}><label className="field-label">Benefici (testo)</label><input className="field-input" value={form.benefits_json} onChange={e => setForm({ ...form, benefits_json: e.target.value })} placeholder="Spedizione gratuita, sconto esclusivo..." /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
                <button className="btn btn-ghost" onClick={resetForm}>Annulla</button>
                <button className="btn btn-gold" onClick={handleSave} disabled={saving || !form.name || (!editing && !form.code)}>{saving ? 'Salvataggio...' : 'Salva'}</button>
              </div>
            </div>
          )}

          {/* Tier Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {tiers.length > 0 ? tiers.map(tier => (
              <div key={tier.id} className="kpi-card" style={{ borderLeft: `4px solid ${tier.color || '#c9a227'}`, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="kpi-label" style={{ color: tier.color || 'var(--gold)' }}>{tier.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{tier.code}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 6px' }} onClick={() => handleEdit(tier)}>Modifica</button>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 6px', color: '#ef4444' }} onClick={() => handleDelete(tier.id)}>Elimina</button>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Punti Minimi</span><div className="mono" style={{ fontWeight: 600 }}>{tier.min_points}</div></div>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Moltiplicatore</span><div className="mono" style={{ fontWeight: 600, color: 'var(--gold)' }}>x{tier.multiplier}</div></div>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Cashback</span><div className="mono" style={{ fontWeight: 600 }}>{tier.cashback_percent}%</div></div>
                  <div><span style={{ fontSize: 11, color: 'var(--muted)' }}>Clienti</span><div className="mono" style={{ fontWeight: 600 }}>{tier.customers_count || 0}</div></div>
                </div>
                {tier.benefits_json && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted2)' }}>{tier.benefits_json}</div>
                )}
              </div>
            )) : (
              <div className="table-card" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                Nessun tier configurato. Crea il primo tier per iniziare il programma fedeltà avanzato.
              </div>
            )}
          </div>
        </>
      )}

      {/* REDEMPTIONS TAB */}
      {tab === 'redemptions' && (
        <>
          {redemptionStats && (
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-label">Riscatti Totali</div><div className="kpi-value">{redemptionStats.total_redemptions || 0}</div></div>
              <div className="kpi-card"><div className="kpi-label">Punti Riscattati</div><div className="kpi-value gold">{Number(redemptionStats.total_points || 0).toLocaleString('it-IT')}</div></div>
              <div className="kpi-card"><div className="kpi-label">Valore Monetario</div><div className="kpi-value">{fmtCurrency(redemptionStats.total_value)}</div></div>
            </div>
          )}

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Punti</th>
                  <th>Valore</th>
                  <th>Stato</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.length > 0 ? redemptions.map(r => (
                  <tr key={r.id}>
                    <td className="mono">#{r.id}</td>
                    <td>{r.first_name ? `${r.first_name} ${r.last_name}` : `Cliente #${r.customer_id}`}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{r.points_redeemed}</td>
                    <td className="mono" style={{ color: 'var(--gold)', fontWeight: 600 }}>{fmtCurrency(r.monetary_value)}</td>
                    <td>
                      <span className={`badge ${r.status === 'completed' ? 'high' : 'mid'}`}>
                        <span className="badge-dot" />{r.status === 'completed' ? 'Completato' : r.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted2)' }}>{fmtDate(r.created_at)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun riscatto registrato</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ConfirmModal
        isOpen={confirmToDelete !== null}
        title="Elimina tier loyalty"
        message="Vuoi eliminare questo tier? I clienti in questo livello rimarranno senza tier fino al prossimo ricalcolo."
        onConfirm={doDelete}
        onCancel={() => setConfirmToDelete(null)}
      />
    </>
  );
}
