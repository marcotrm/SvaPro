import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { cashMovements } from '../api.jsx';
import { Plus, ArrowDownCircle, ArrowUpCircle, Filter } from 'lucide-react';

export default function TesoreriaPage() {
  const { selectedStoreId } = useOutletContext();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtri locali
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal stato
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStoreId) params.store_id = selectedStoreId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      
      const res = await cashMovements.get(params);
      setMovements(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [selectedStoreId, dateFrom, dateTo]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedStoreId) {
      alert("Seleziona prima un negozio dall'intestazione.");
      return;
    }
    if (!amount || amount <= 0) {
      alert("Inserisci un importo valido.");
      return;
    }
    
    try {
      await cashMovements.create({
        store_id: selectedStoreId,
        type: type,
        amount: amount,
        note: note
      });
      setIsModalOpen(false);
      setAmount('');
      setNote('');
      fetchMovements();
    } catch (err) {
      console.error(err);
      alert("Errore durante il salvataggio");
    }
  };

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
            Tesoreria & Cassa
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Gestione flusso di cassa, versamenti e prelievi
          </p>
        </div>
        <button
          onClick={() => {
            if (!selectedStoreId) {
              alert("Per registrare un movimento devi selezionare un negozio specifico dall'intestazione.");
              return;
            }
            setIsModalOpen(true);
          }}
          className="sp-button-primary"
        >
          <Plus size={16} /> Registra Movimento
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--color-surface)', padding: 16, borderRadius: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
        <Filter size={18} color="var(--color-text-secondary)" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Da:</span>
          <input type="date" className="sp-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>A:</span>
          <input type="date" className="sp-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }} className="sp-spin" />
        ) : movements.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            Nessun movimento trovato per i filtri selezionati.
          </div>
        ) : (
          <table className="sp-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Data</th>
                {!selectedStoreId && <th>Negozio</th>}
                <th>Operatore</th>
                <th>Tipo</th>
                <th>Note</th>
                <th style={{ textAlign: 'right' }}>Importo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString('it-IT')}</td>
                  {!selectedStoreId && <td>{m.store_name || '-'}</td>}
                  <td>{m.employee_name || '-'}</td>
                  <td>
                    {m.type === 'deposit' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10B981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 99, fontSize: 12 }}>
                        <ArrowDownCircle size={14} /> Incasso / Versamento in cassa
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#EF4444', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 99, fontSize: 12 }}>
                        <ArrowUpCircle size={14} /> Prelievo / Versamento banca
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{m.note || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: m.type === 'deposit' ? '#10B981' : '#EF4444' }}>
                    {m.type === 'deposit' ? '+' : '-'}{fmt(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="sp-animate-in" style={{ background: 'var(--color-surface)', width: '100%', maxWidth: 460, borderRadius: 24, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>Registra Movimento di Cassa</h2>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="sp-label">Tipo di Movimento</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setType('deposit')} style={{ flex: 1, padding: 12, borderRadius: 12, border: '2px solid', borderColor: type === 'deposit' ? '#10B981' : 'var(--color-border)', background: type === 'deposit' ? 'rgba(16,185,129,0.1)' : 'transparent', color: type === 'deposit' ? '#10B981' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowDownCircle size={16} /> Incasso in cassa
                  </button>
                  <button type="button" onClick={() => setType('withdrawal')} style={{ flex: 1, padding: 12, borderRadius: 12, border: '2px solid', borderColor: type === 'withdrawal' ? '#EF4444' : 'var(--color-border)', background: type === 'withdrawal' ? 'rgba(239,68,68,0.1)' : 'transparent', color: type === 'withdrawal' ? '#EF4444' : 'var(--color-text)', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowUpCircle size={16} /> Prelievo / Banca
                  </button>
                </div>
              </div>

              <div>
                <label className="sp-label">Importo (€)</label>
                <input type="number" step="0.01" min="0.01" className="sp-input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
              </div>

              <div>
                <label className="sp-label">Note / Causale</label>
                <textarea className="sp-input" style={{ minHeight: 80, resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)} placeholder="Es. Versamento in banca, fondo cassa..."></textarea>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="sp-button" style={{ flex: 1 }}>Annulla</button>
                <button type="submit" className="sp-button-primary" style={{ flex: 1 }}>Salva Movimento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
