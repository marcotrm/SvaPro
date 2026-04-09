import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { customers, orders as ordersApi, loyalty } from '../api.jsx';

const TABS = ['anagrafica', 'ordini', 'loyalty', 'note'];
const TAB_LABELS = { anagrafica: '📋 Anagrafica', ordini: '🛒 Ordini', loyalty: '🎁 Loyalty & Punti', note: '📝 Note CRM' };

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedStoreId } = useOutletContext();
  const [activeTab, setActiveTab] = useState('anagrafica');
  const [customer, setCustomer] = useState(null);
  const [ordersList, setOrdersList] = useState([]);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const [custRes, ordRes] = await Promise.all([
        customers.getCustomer(id),
        ordersApi.getOrders({ customer_id: id, limit: 50 }),
      ]);
      setCustomer(custRes.data?.data || custRes.data || null);
      setOrdersList(ordRes.data?.data || []);
      // Try loyalty wallet
      try {
        const loyRes = await loyalty.getWallet(id);
        setLoyaltyData(loyRes.data?.data || loyRes.data || null);
      } catch { setLoyaltyData(null); }
    } catch (err) {
      setError(err.response?.data?.message || 'Errore nel caricamento cliente');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveNote = () => {
    if (!newNote.trim()) return;
    const note = { text: newNote, created_at: new Date().toISOString(), author: 'Operatore' };
    const all = [...notes, note];
    setNotes(all);
    localStorage.setItem(`crm_notes_${id}`, JSON.stringify(all));
    setNewNote('');
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`crm_notes_${id}`);
      if (saved) setNotes(JSON.parse(saved));
    } catch {}
  }, [id]);

  const fmt = v => v ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v) : '—';
  const fmtDate = v => v ? new Date(v).toLocaleDateString('it-IT') : '—';
  const totalSpent = ordersList.reduce((s, o) => s + (o.grand_total || 0), 0);
  const avgOrder = ordersList.length ? totalSpent / ordersList.length : 0;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  );

  if (!customer) return (
    <div className="sp-alert sp-alert-error" style={{ margin: 24 }}>
      {error || 'Cliente non trovato.'} <button className="sp-btn sp-btn-ghost" onClick={() => navigate('/customers')}>← Torna</button>
    </div>
  );

  return (
    <div className="animate-v3" style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>

      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
        borderRadius: 24, padding: '28px 32px', marginBottom: 24, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <button onClick={() => navigate('/customers')} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: '6px 14px',
          color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13, marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>← Clienti</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: '#fff',
            border: '3px solid rgba(255,255,255,0.2)',
          }}>
            {((customer.first_name || customer.name || '?')[0]).toUpperCase()}
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
              {customer.first_name || ''} {customer.last_name || ''}
            </h1>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
              {customer.email || '—'} {customer.phone ? '· ' + customer.phone : ''}
            </div>
          </div>
          {/* Mini KPIs */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
            {[
              { label: 'Ordini', value: ordersList.length },
              { label: 'Speso', value: fmt(totalSpent) },
              { label: 'Punti', value: loyaltyData?.balance ?? '—' },
            ].map(kpi => (
              <div key={kpi.label} style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 20 }}>{kpi.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '10px 20px', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
            background: activeTab === t ? '#4f46e5' : 'rgba(0,0,0,0.04)',
            color: activeTab === t ? '#fff' : '#64748b',
            transition: 'all 0.2s',
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── ANAGRAFICA ── */}
      {activeTab === 'anagrafica' && (
        <div className="card-v3" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 20px', color: '#0f172a' }}>Dati Anagrafici</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {[
              ['Nome', `${customer.first_name || ''} ${customer.last_name || ''}`.trim()],
              ['Email', customer.email],
              ['Telefono', customer.phone],
              ['Codice Fiscale', customer.fiscal_code],
              ['Partita IVA', customer.vat_number],
              ['Indirizzo', customer.address],
              ['Città', `${customer.city || ''} ${customer.postal_code || ''}`.trim()],
              ['Paese', customer.country],
              ['Cliente dal', fmtDate(customer.created_at)],
              ['Ultima visita', fmtDate(customer.last_order_at || (ordersList[0]?.created_at))],
              ['Ordine medio', fmt(avgOrder)],
              ['Spesa totale', fmt(totalSpent)],
            ].map(([label, value]) => value ? (
              <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{value}</div>
              </div>
            ) : null)}
          </div>

          {customer.notes && (
            <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Note Cliente</div>
              <div style={{ fontSize: 14, color: '#334155' }}>{customer.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* ── ORDINI ── */}
      {activeTab === 'ordini' && (
        <div className="card-v3 overflow-hidden">
          <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Storico Ordini ({ordersList.length})</h2>
          </div>
          {ordersList.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#cbd5e1' }}>Nessun ordine trovato</div>
          ) : (
            <table className="table-v3">
              <thead><tr><th>Ordine</th><th>Data</th><th>Stato</th><th>Totale</th><th>Articoli</th></tr></thead>
              <tbody>
                {ordersList.map(o => (
                  <tr key={o.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{String(o.id).padStart(4, '0')}</span></td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td><span className={`badge-v3 ${o.status === 'paid' ? 'badge-v3-emerald' : 'badge-v3-amber'}`}>{o.status}</span></td>
                    <td><strong>{fmt(o.grand_total)}</strong></td>
                    <td style={{ color: '#64748b' }}>{(o.lines || []).length} art.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── LOYALTY ── */}
      {activeTab === 'loyalty' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {loyaltyData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {[
                  { label: 'Punti Disponibili', value: loyaltyData.balance || 0, color: '#4f46e5' },
                  { label: 'Punti Totali Guadagnati', value: loyaltyData.total_earned || 0, color: '#16a34a' },
                  { label: 'Punti Utilizzati', value: loyaltyData.total_redeemed || 0, color: '#d97706' },
                ].map(kpi => (
                  <div key={kpi.label} className="card-v3" style={{ padding: '20px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: kpi.color }}>{kpi.value.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, marginTop: 4 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
              {loyaltyData.transactions?.length > 0 && (
                <div className="card-v3 overflow-hidden">
                  <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 14 }}>Transazioni Punti</div>
                  <table className="table-v3">
                    <thead><tr><th>Data</th><th>Tipo</th><th>Punti</th><th>Descrizione</th></tr></thead>
                    <tbody>
                      {loyaltyData.transactions.map((t, i) => (
                        <tr key={i}>
                          <td>{fmtDate(t.created_at)}</td>
                          <td><span className={`badge-v3 ${t.event_type === 'earn' ? 'badge-v3-emerald' : 'badge-v3-amber'}`}>{t.event_type}</span></td>
                          <td style={{ fontWeight: 700, color: t.points > 0 ? '#16a34a' : '#dc2626' }}>{t.points > 0 ? '+' : ''}{t.points}</td>
                          <td style={{ color: '#64748b' }}>{t.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="card-v3" style={{ padding: 40, textAlign: 'center', color: '#cbd5e1' }}>
              Nessun dato loyalty disponibile per questo cliente.
            </div>
          )}
        </div>
      )}

      {/* ── NOTE CRM ── */}
      {activeTab === 'note' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card-v3" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>Aggiungi Nota Interna</h2>
            <textarea
              value={newNote} onChange={e => setNewNote(e.target.value)}
              placeholder="Scrivi una nota interna su questo cliente (es. preferenze, follow-up, accordi specifici)..."
              style={{
                width: '100%', minHeight: 100, padding: '12px 16px', border: '2px solid #e2e8f0',
                borderRadius: 12, fontFamily: 'inherit', fontSize: 14, resize: 'vertical',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={saveNote} style={{
                background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>
                Salva Nota
              </button>
            </div>
          </div>

          {notes.length > 0 && (
            <div className="card-v3 overflow-hidden">
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: 14 }}>
                Note Salvate ({notes.length})
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...notes].reverse().map((note, i) => (
                  <div key={i} style={{
                    background: '#f8fafc', borderRadius: 12, padding: '14px 16px',
                    borderLeft: '3px solid #6366f1',
                  }}>
                    <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{note.text}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                      {note.author} · {new Date(note.created_at).toLocaleString('it-IT')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {notes.length === 0 && (
            <div className="card-v3" style={{ padding: 40, textAlign: 'center', color: '#cbd5e1' }}>
              Nessuna nota per questo cliente. Aggiungine una sopra.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
