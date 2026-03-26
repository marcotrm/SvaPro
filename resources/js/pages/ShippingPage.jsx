import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { shipping, orders } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function ShippingPage() {
  const { selectedStoreId } = useOutletContext();
  const [tab, setTab] = useState('shipments');
  const [shipments, setShipments] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Carrier form
  const [showCarrierForm, setShowCarrierForm] = useState(false);
  const [carrierForm, setCarrierForm] = useState({ name: '', api_type: '' });
  const [savingCarrier, setSavingCarrier] = useState(false);

  // Shipment form
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipForm, setShipForm] = useState({ sales_order_id: '', carrier_id: '', tracking_number: '', service_code: '' });
  const [savingShip, setSavingShip] = useState(false);

  // Status update
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true); setError('');
      const [shipRes, carrRes] = await Promise.all([
        shipping.getShipments(),
        shipping.getCarriers(),
      ]);
      setShipments(shipRes.data?.data || []);
      setCarriers(carrRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const handleSaveCarrier = async () => {
    try {
      setSavingCarrier(true); setError('');
      await shipping.createCarrier(carrierForm);
      setCarrierForm({ name: '', api_type: '' });
      setShowCarrierForm(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSavingCarrier(false); }
  };

  const handleCreateShipment = async () => {
    try {
      setSavingShip(true); setError('');
      await shipping.createShipment({
        sales_order_id: parseInt(shipForm.sales_order_id),
        carrier_id: shipForm.carrier_id ? parseInt(shipForm.carrier_id) : null,
        tracking_number: shipForm.tracking_number || null,
        service_code: shipForm.service_code || null,
      });
      setShipForm({ sales_order_id: '', carrier_id: '', tracking_number: '', service_code: '' });
      setShowShipForm(false);
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSavingShip(false); }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      await shipping.updateShipment(id, { status: newStatus });
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setUpdatingId(null); }
  };

  const statusBadge = (s) => {
    const map = { pending: 'mid', shipped: 'high', delivered: 'up', cancelled: 'low' };
    const labels = { pending: 'In Attesa', shipped: 'Spedito', delivered: 'Consegnato', cancelled: 'Annullato' };
    return <span className={`badge ${map[s] || 'mid'}`}><span className="badge-dot" />{labels[s] || s}</span>;
  };

  const filteredShipments = shipments.filter(s =>
    String(s.sales_order_id).includes(search) ||
    s.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.carrier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '-';

  if (loading) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Spedizioni</div>
          <div className="page-head-sub">{shipments.length} spedizioni, {carriers.length} corrieri</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setShowCarrierForm(!showCarrierForm); setShowShipForm(false); }}>+ Corriere</button>
          <button className="btn btn-gold" onClick={() => { setShowShipForm(!showShipForm); setShowCarrierForm(false); }}>+ Spedizione</button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchAll} />}

      {/* Carrier quick form */}
      {showCarrierForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Nuovo Corriere</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
            <div><label className="field-label">Nome *</label><input className="field-input" value={carrierForm.name} onChange={e => setCarrierForm({ ...carrierForm, name: e.target.value })} /></div>
            <div><label className="field-label">Tipo API</label><input className="field-input" placeholder="brt, gls, sda..." value={carrierForm.api_type} onChange={e => setCarrierForm({ ...carrierForm, api_type: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setShowCarrierForm(false)}>Annulla</button>
            <button className="btn btn-gold" onClick={handleSaveCarrier} disabled={savingCarrier || !carrierForm.name}>{savingCarrier ? 'Salvataggio...' : 'Salva'}</button>
          </div>
        </div>
      )}

      {/* Shipment create form */}
      {showShipForm && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Nuova Spedizione</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, padding: '0 16px 16px' }}>
            <div><label className="field-label">ID Ordine *</label><input className="field-input" type="number" value={shipForm.sales_order_id} onChange={e => setShipForm({ ...shipForm, sales_order_id: e.target.value })} /></div>
            <div>
              <label className="field-label">Corriere</label>
              <select className="field-input" value={shipForm.carrier_id} onChange={e => setShipForm({ ...shipForm, carrier_id: e.target.value })}>
                <option value="">— seleziona —</option>
                {carriers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="field-label">Tracking</label><input className="field-input" value={shipForm.tracking_number} onChange={e => setShipForm({ ...shipForm, tracking_number: e.target.value })} /></div>
            <div><label className="field-label">Servizio</label><input className="field-input" placeholder="express, standard..." value={shipForm.service_code} onChange={e => setShipForm({ ...shipForm, service_code: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setShowShipForm(false)}>Annulla</button>
            <button className="btn btn-gold" onClick={handleCreateShipment} disabled={savingShip || !shipForm.sales_order_id}>{savingShip ? 'Creazione...' : 'Crea Spedizione'}</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {['shipments', 'carriers'].map(t => (
          <button key={t} className={`filter-chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'shipments' ? `Spedizioni (${shipments.length})` : `Corrieri (${carriers.length})`}
          </button>
        ))}
      </div>

      {tab === 'shipments' && (
        <div className="table-card">
          <div className="table-toolbar">
            <input className="search-input" placeholder="Cerca per ordine, tracking, corriere..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{filteredShipments.length} risultati</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Ordine</th>
                <th>Corriere</th>
                <th>Tracking</th>
                <th>Stato</th>
                <th>Spedito</th>
                <th>Consegnato</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.length > 0 ? filteredShipments.map(s => (
                <tr key={s.id}>
                  <td className="mono">#{s.id}</td>
                  <td className="mono">#{s.sales_order_id}</td>
                  <td>{s.carrier_name || '-'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{s.tracking_number || '-'}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(s.shipped_at)}</td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(s.delivered_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {s.status === 'pending' && (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} disabled={updatingId === s.id} onClick={() => handleUpdateStatus(s.id, 'shipped')}>
                          Segna Spedito
                        </button>
                      )}
                      {s.status === 'shipped' && (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} disabled={updatingId === s.id} onClick={() => handleUpdateStatus(s.id, 'delivered')}>
                          Segna Consegnato
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessuna spedizione trovata</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'carriers' && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo API</th>
                <th>Stato</th>
                <th>Creato</th>
              </tr>
            </thead>
            <tbody>
              {carriers.length > 0 ? carriers.map(c => (
                <tr key={c.id}>
                  <td className="mono">#{c.id}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="mono">{c.api_type || '-'}</td>
                  <td><span className={`badge ${c.active ? 'high' : 'mid'}`}><span className="badge-dot" />{c.active ? 'Attivo' : 'Inattivo'}</span></td>
                  <td style={{ color: 'var(--muted2)' }}>{fmtDate(c.created_at)}</td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun corriere configurato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
