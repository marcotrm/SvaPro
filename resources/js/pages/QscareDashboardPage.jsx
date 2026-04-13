import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { reports, stores, orders } from '../api.jsx';
import { Shield, Loader2, Store, UserCircle, Euro, LayoutDashboard, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DatePicker from '../components/DatePicker.jsx';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function QscareDashboardPage() {
  const { selectedStoreId } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total_revenue: 0, total_qty: 0 });

  // Filtri
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [storeId, setStoreId] = useState(selectedStoreId || '');
  const [employeeId, setEmployeeId] = useState('');

  // Opzioni filtri
  const [storesList, setStoresList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);

  useEffect(() => {
    // Carica opzioni
    stores.getStores().then(res => setStoresList(res.data?.data || [])).catch(() => {});
    orders.getOptions({ store_id: selectedStoreId }).then(res => {
      setEmployeesList(res.data?.data?.employees || []);
    }).catch(() => {});
  }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        store_id: storeId,
        employee_id: employeeId
      };
      // rimuovi chiavi vuote
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      const res = await reports.qscareDashboard(params);
      setData(res.data?.data || []);
      setSummary(res.data?.summary || { total_revenue: 0, total_qty: 0 });
    } catch (err) {
      toast.error('Errore nel caricamento dei dati QScare');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, storeId, employeeId]);

  return (
    <div className="sp-content sp-animate-in">
      <div className="sp-header">
        <div>
          <h1 className="sp-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <Shield size={24} color="#fff" />
            </div>
            Dashboard QScare
          </h1>
          <p className="sp-subtitle">Monitoraggio attivazioni e fatturato garanzie QScare</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: 'var(--color-accent-light)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Euro size={18} color="var(--color-accent)" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fatturato QScare</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-text)' }}>{fmt(summary.total_revenue)}</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: 'rgba(52,211,153,0.15)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="#059669" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attivazioni Totali</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-text)' }}>{summary.total_qty} <span style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af' }}>QScare</span></div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        {/* Filtri */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, background: '#f8fafc' }}>
          <div>
            <DatePicker label="Dal" value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <DatePicker label="Al" value={dateTo} onChange={setDateTo} />
          </div>
          <div>
            <label className="sp-label" style={{ fontSize: 11 }}>Negozio</label>
            <select className="sp-input" value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">Tutti i negozi</option>
              {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="sp-label" style={{ fontSize: 11 }}>Dipendente</label>
            <select className="sp-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">Tutti i dipendenti</option>
              {employeesList.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
        </div>

        {/* Tabella */}
        <div style={{ overflowX: 'auto' }}>
          <table className="sp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Ordine ID</th>
                <th>Negozio</th>
                <th>Operatore</th>
                <th>Qt.</th>
                <th>Prezzo Cad.</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={24} className="sp-spin" style={{ margin: '0 auto', color: 'var(--color-accent)' }}/></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Nessuna vendita QScare trovata nel periodo.</td></tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.order_id + '-' + i}>
                    <td style={{ fontWeight: 600 }}>{fmtDate(row.created_at)}</td>
                    <td><span className="sp-badge sp-badge-primary">#{row.order_id}</span></td>
                    <td>{row.store_name}</td>
                    <td>{row.employee_name}</td>
                    <td><span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{row.qty}</span></td>
                    <td>{fmt(parseFloat(row.unit_price))}</td>
                    <td style={{ fontWeight: 800, color: '#10B981' }}>{fmt(parseFloat(row.line_total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
