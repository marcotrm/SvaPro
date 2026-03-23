import React, { useState, useEffect } from 'react';
import { loyalty, customers } from '../api.jsx';
import { SkeletonKpi, SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function LoyaltyAnalyticsPage() {
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true); setError('');
      const response = await customers.getCustomers();
      setCustomersList(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei clienti');
    } finally { setLoading(false); }
  };

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const response = await loyalty.getWallet(customer.id);
      setWallet(response.data.wallet);
    } catch (err) {
      setWallet(null);
    }
  };

  const initials = c => `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase();

  // Build chart data from ledger
  const chartData = wallet?.ledger?.slice(0, 8).map(e => ({
    date: new Date(e.created_at).toLocaleDateString('it-IT', {day:'2-digit',month:'short'}),
    punti: e.type === 'earn' ? e.points : 0,
    utilizzo: e.type === 'redeem' ? e.points : 0,
  })) || [];

  const pieData = wallet ? [
    { name: 'Guadagnati', value: wallet.ledger?.filter(e => e.type === 'earn').reduce((s,e) => s + e.points, 0) || 0 },
    { name: 'Utilizzati',  value: wallet.ledger?.filter(e => e.type === 'redeem').reduce((s,e) => s + e.points, 0) || 0 },
  ] : [];
  const PIE_COLORS = ['#c9a227', '#3d8ef0'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:8,padding:'10px 14px',fontSize:12}}>
        <div style={{color:'var(--muted)',marginBottom:4}}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{color: p.color, fontWeight:700}}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
  };

  if (loading) return <><SkeletonKpi count={3} /><SkeletonTable cols={4} rows={5} /></>;

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-head-title">Loyalty Analytics</div>
          <div className="page-head-sub">Gestione programma fedeltÃ  e punti clienti</div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchCustomers} />}

      {/* Customer selector */}
      <div className="table-card" style={{padding:20}}>
        <div style={{fontSize:12,fontWeight:700,letterSpacing:'1px',textTransform:'uppercase',color:'var(--muted)',marginBottom:12}}>
          Seleziona Cliente
        </div>
        <div className="loyalty-customers">
          {customersList.map(customer => (
            <button
              key={customer.id}
              className={`customer-card${selectedCustomer?.id === customer.id ? ' selected' : ''}`}
              onClick={() => handleSelectCustomer(customer)}
            >
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <div className="avatar-sm" style={{width:26,height:26,fontSize:10}}>{initials(customer)}</div>
                <div className="customer-card-name">{customer.first_name} {customer.last_name}</div>
              </div>
              <div className="customer-card-code">{customer.code}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Wallet KPIs */}
      {selectedCustomer && wallet && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {/* Punti */}
          <div className="kpi-card">
            <div className="kpi-label">Punti Totali</div>
            <div className="kpi-value gold" style={{fontSize:32,marginTop:8}}>{wallet.current_points || 0}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Saldo attuale</div>
          </div>
          {/* Valore */}
          <div className="kpi-card">
            <div className="kpi-label">Valore Monetario</div>
            <div className="kpi-value positive" style={{fontSize:32,marginTop:8}}>â‚¬{((wallet.current_points || 0) * 0.05).toFixed(2)}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>0.05â‚¬ per punto</div>
          </div>
          {/* Stato carta */}
          <div className="kpi-card">
            <div className="kpi-label">Stato Carta</div>
            <div style={{marginTop:8}}>
              <span className={`badge ${wallet.card_status === 'active' ? 'high' : 'mid'}`} style={{fontSize:14,padding:'4px 12px'}}>
                <span className="badge-dot" />
                {wallet.card_status || 'Attiva'}
              </span>
            </div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:8,fontFamily:'IBM Plex Mono, monospace'}}>
              {wallet.card_number ? `â€¢â€¢â€¢â€¢ ${wallet.card_number.slice(-4)}` : 'Nessuna carta'}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {selectedCustomer && wallet && chartData.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Bar chart */}
          <div className="table-card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:16}}>Storico Punti</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:11,fill:'var(--muted)'}} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="punti" name="Guadagnati" fill="#c9a227" radius={[3,3,0,0]} />
                <Bar dataKey="utilizzo" name="Utilizzati" fill="#3d8ef0" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Pie chart */}
          <div className="table-card" style={{padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:16}}>Distribuzione</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Legend formatter={(v) => <span style={{color:'var(--muted2)',fontSize:12}}>{v}</span>} />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ledger table */}
      {selectedCustomer && wallet?.ledger?.length > 0 && (
        <div className="table-card">
          <div className="table-toolbar">
            <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Cronologia Punti</span>
            <span style={{fontSize:12,color:'var(--muted)',marginLeft:'auto'}}>{wallet.ledger.length} movimenti</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Punti</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {wallet.ledger.map((entry, idx) => (
                <tr key={idx}>
                  <td style={{color:'var(--muted2)'}}>
                    {new Date(entry.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td>
                    <span className={`badge ${entry.type === 'earn' ? 'high' : 'low'}`}>
                      <span className="badge-dot" />
                      {entry.type === 'earn' ? 'Guadagnato' : 'Utilizzato'}
                    </span>
                  </td>
                  <td>
                    <span className={`mono ${entry.type === 'earn' ? 'positive' : 'negative'}`}>
                      {entry.type === 'earn' ? '+' : '-'}{entry.points}
                    </span>
                  </td>
                  <td style={{color:'var(--muted)'}}>{entry.description || 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!selectedCustomer && (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'64px 0', color:'var(--muted)', gap:12,
          border:'1px dashed var(--border)', borderRadius:'var(--radius)',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:.4}}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
          <div style={{fontSize:14,fontWeight:600}}>Seleziona un cliente</div>
          <div style={{fontSize:13}}>Visualizza i dettagli del programma fedeltÃ </div>
        </div>
      )}
    </>
  );
}

