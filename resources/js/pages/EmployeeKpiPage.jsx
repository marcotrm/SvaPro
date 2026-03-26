import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { employees } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function EmployeeKpiPage() {
  const { selectedStoreId } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Target form
  const [targetEmployee, setTargetEmployee] = useState(null);
  const [targetForm, setTargetForm] = useState({ sales_target: '', orders_target: '' });
  const [savingTarget, setSavingTarget] = useState(false);

  useEffect(() => { fetchKpi(); }, [period, selectedStoreId]);

  const fetchKpi = async () => {
    try {
      setLoading(true); setError('');
      const res = await employees.getKpiDashboard({ period, store_id: selectedStoreId || undefined });
      setData(res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const handleSetTarget = (emp) => {
    setTargetEmployee(emp);
    setTargetForm({
      sales_target: emp.sales_target ?? '',
      orders_target: emp.orders_target ?? '',
    });
  };

  const handleSaveTarget = async () => {
    if (!targetEmployee) return;
    try {
      setSavingTarget(true);
      await employees.setKpiTarget(targetEmployee.id, {
        period,
        sales_target: parseFloat(targetForm.sales_target) || 0,
        orders_target: parseInt(targetForm.orders_target) || 0,
      });
      setTargetEmployee(null);
      await fetchKpi();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setSavingTarget(false); }
  };

  const fmtCurrency = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));
  const periodLabel = (p) => {
    const [y, m] = p.split('-');
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return `${months[parseInt(m) - 1]} ${y}`;
  };

  const changePeriod = (delta) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const overview = data?.overview;
  const empList = data?.employees || [];
  const dailyTrend = data?.daily_trend || [];

  if (loading && !data) return <SkeletonTable />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">KPI Dipendenti</div>
          <div className="page-head-sub">Performance e obiettivi mensili</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => changePeriod(-1)}>&larr;</button>
          <span style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{periodLabel(period)}</span>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => changePeriod(1)}>&rarr;</button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchKpi} />}

      {/* KPI Overview */}
      {overview && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Dipendenti Attivi</div>
            <div className="kpi-value">{overview.active_employees}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Vendite Mese</div>
            <div className="kpi-value gold">{fmtCurrency(overview.total_sales)}</div>
            <div className={`kpi-delta ${overview.sales_growth >= 0 ? 'up' : 'warn'}`}>
              {overview.sales_growth >= 0 ? '+' : ''}{overview.sales_growth}% vs mese prec.
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ordini</div>
            <div className="kpi-value">{overview.total_orders}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Ticket Medio</div>
            <div className="kpi-value">{fmtCurrency(overview.avg_ticket)}</div>
          </div>
        </div>
      )}

      {/* Daily Trend */}
      {dailyTrend.length > 0 && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar"><div className="section-title">Trend Giornaliero</div></div>
          <div style={{ display: 'flex', gap: 4, padding: '0 16px 16px', overflowX: 'auto', alignItems: 'flex-end', height: 100 }}>
            {dailyTrend.map((d, i) => {
              const maxSales = Math.max(...dailyTrend.map(x => Number(x.sales || 0)), 1);
              const h = Math.max(4, (Number(d.sales || 0) / maxSales) * 72);
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 24 }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>{fmtCurrency(d.sales)}</div>
                  <div style={{ width: '100%', maxWidth: 28, height: h, background: 'var(--gold)', borderRadius: 3, opacity: 0.85 }} title={`${d.day}: ${d.orders} ordini, ${fmtCurrency(d.sales)}`} />
                  <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>{d.day?.slice(8)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Target form modal */}
      {targetEmployee && (
        <div className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-toolbar">
            <div className="section-title">Imposta Target — {targetEmployee.first_name} {targetEmployee.last_name}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px 16px' }}>
            <div><label className="field-label">Target Vendite (€)</label><input className="field-input" type="number" step="100" value={targetForm.sales_target} onChange={e => setTargetForm({ ...targetForm, sales_target: e.target.value })} placeholder="5000" /></div>
            <div><label className="field-label">Target Ordini</label><input className="field-input" type="number" value={targetForm.orders_target} onChange={e => setTargetForm({ ...targetForm, orders_target: e.target.value })} placeholder="100" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 16px 16px' }}>
            <button className="btn btn-ghost" onClick={() => setTargetEmployee(null)}>Annulla</button>
            <button className="btn btn-gold" onClick={handleSaveTarget} disabled={savingTarget}>{savingTarget ? 'Salvataggio...' : 'Salva Target'}</button>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="section-title">Dettaglio Dipendenti</div>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{empList.length} dipendenti</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Dipendente</th>
              <th>Store</th>
              <th>Vendite</th>
              <th>Ordini</th>
              <th>Ticket Medio</th>
              <th>Margine</th>
              <th>vs Prec.</th>
              <th>Target</th>
              <th style={{ textAlign: 'right' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {empList.length > 0 ? empList.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{e.first_name} {e.last_name}</td>
                <td style={{ color: 'var(--muted2)' }}>{e.store_name || '-'}</td>
                <td className="mono" style={{ fontWeight: 600 }}>{fmtCurrency(e.current_sales)}</td>
                <td className="mono">{e.current_orders}</td>
                <td className="mono">{fmtCurrency(e.current_avg_ticket)}</td>
                <td className="mono">{fmtCurrency(e.current_margin)}</td>
                <td>
                  <span className={`kpi-delta ${e.sales_growth >= 0 ? 'up' : 'warn'}`} style={{ fontSize: 12 }}>
                    {e.sales_growth >= 0 ? '+' : ''}{e.sales_growth}%
                  </span>
                </td>
                <td>
                  {e.target_progress !== null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
                        <div style={{ width: `${Math.min(e.target_progress, 100)}%`, height: '100%', background: e.target_progress >= 100 ? '#22c55e' : 'var(--gold)', borderRadius: 3 }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11 }}>{e.target_progress}%</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>-</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => handleSetTarget(e)}>
                    Target
                  </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>Nessun dato per il periodo selezionato</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
