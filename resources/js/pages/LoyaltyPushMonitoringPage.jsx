import React, { useEffect, useMemo, useState } from 'react';
import { loyalty } from '../api.jsx';
import { SkeletonKpi, SkeletonTable } from '../components/Skeleton.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const DEFAULT_DATA = {
  summary: {
    pending_queue: 0,
    in_flight: 0,
    success_count: 0,
    failed_count: 0,
    processed_count: 0,
    success_rate: 0,
    active_devices: 0,
    total_devices: 0,
  },
  status_breakdown: {},
  delivery_trend: [],
  device_registration_trend: [],
  recent_notifications: [],
  meta: {
    days: 7,
    from: null,
    to: null,
  },
};

export default function LoyaltyPushMonitoringPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMonitoringData(days);
  }, [days]);

  const fetchMonitoringData = async (selectedDays) => {
    try {
      setLoading(true);
      setError('');
      const response = await loyalty.getPushMonitoringStats({ days: selectedDays });
      setData(response.data || DEFAULT_DATA);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore nel caricamento del monitor loyalty push');
    } finally {
      setLoading(false);
    }
  };

  const summary = data.summary || DEFAULT_DATA.summary;

  const statusRows = useMemo(() => {
    const labels = {
      queued: 'In coda',
      pending_device: 'In attesa device',
      dispatched: 'In consegna',
      delivered: 'Consegnate',
      partially_delivered: 'Parziali',
      read: 'Lette',
    };

    return Object.entries(data.status_breakdown || {})
      .map(([status, count]) => ({
        status,
        label: labels[status] || status,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data.status_breakdown]);

  const statusBadge = (status) => {
    const map = {
      queued: { text: 'In coda', cls: 'mid' },
      pending_device: { text: 'Attesa device', cls: 'mid' },
      dispatched: { text: 'In consegna', cls: 'mid' },
      delivered: { text: 'Consegnata', cls: 'high' },
      partially_delivered: { text: 'Parziale', cls: 'mid' },
      failed: { text: 'Fallita', cls: 'low' },
      read: { text: 'Letta', cls: 'high' },
    };

    const item = map[status] || { text: status, cls: 'mid' };

    return (
      <span className={`badge ${item.cls}`}>
        <span className="badge-dot" />
        {item.text}
      </span>
    );
  };

  if (loading) {
    return <><SkeletonKpi count={4} /><SkeletonTable cols={5} rows={5} /></>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-head-title">Loyalty Push Monitor</div>
          <div className="page-head-sub">Coda notifiche, delivery rate e trend registrazione device</div>
        </div>
        <div className="tab-bar">
          {[7, 14, 30].map((windowDays) => (
            <button
              key={windowDays}
              className={`tab${days === windowDays ? ' active' : ''}`}
              onClick={() => setDays(windowDays)}
            >
              {windowDays} giorni
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => fetchMonitoringData(days)} />}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Notifiche In Coda</div>
          <div className="kpi-value red">{summary.pending_queue || 0}</div>
          <span className="kpi-delta warn">queued + pending_device</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Notifiche In Consegna</div>
          <div className="kpi-value">{summary.in_flight || 0}</div>
          <span className="kpi-delta up">status dispatched</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Delivery Success Rate</div>
          <div className="kpi-value gold">{Number(summary.success_rate || 0).toFixed(1)}%</div>
          <span className="kpi-delta up">{summary.success_count || 0} OK su {summary.processed_count || 0}</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Device Attivi</div>
          <div className="kpi-value">{summary.active_devices || 0}</div>
          <span className="kpi-delta up">totali: {summary.total_devices || 0}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            Trend Delivery ({data.meta?.days || days} giorni)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.delivery_trend || []}>
              <defs>
                <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.36} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--red)" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="success_count" name="Successo" stroke="var(--green)" fill="url(#successGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="failed_count" name="Fallite" stroke="var(--red)" fill="url(#failedGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            Distribuzione Stati Notifiche
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statusRows.length > 0 ? (
              statusRows.map((row) => {
                const total = statusRows.reduce((sum, current) => sum + current.count, 0) || 1;
                const width = Math.max(4, Math.round((row.count / total) * 100));
                return (
                  <div key={row.status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted2)', fontSize: 12 }}>{row.label}</span>
                      <span className="mono" style={{ color: 'var(--text)' }}>{row.count}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: 'var(--border)' }}>
                      <div
                        style={{
                          width: `${width}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'linear-gradient(90deg, var(--gold), var(--blue))',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Nessun dato disponibile nel periodo selezionato.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            Registrazioni Device
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.device_registration_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="registered_count" name="Nuovi device" fill="var(--blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            Stato Pipeline (ultimi {data.meta?.days || days} giorni)
          </div>
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--green)' }} />
            <div className="activity-text">Eventi processati con successo</div>
            <span className="mono positive">{summary.success_count || 0}</span>
          </div>
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--red)' }} />
            <div className="activity-text">Eventi falliti</div>
            <span className="mono negative">{summary.failed_count || 0}</span>
          </div>
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--amber)' }} />
            <div className="activity-text">Eventi totali processati</div>
            <span className="mono neutral">{summary.processed_count || 0}</span>
          </div>
          <div className="activity-item">
            <div className="activity-dot" style={{ background: 'var(--blue)' }} />
            <div className="activity-text">Intervallo analizzato</div>
            <span className="mono" style={{ color: 'var(--text)' }}>
              {data.meta?.from || '-'} / {data.meta?.to || '-'}
            </span>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notifiche Recenti</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {data.recent_notifications?.length || 0} record
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Stato</th>
              <th>Target Device</th>
              <th>Sent</th>
              <th>Delivered</th>
            </tr>
          </thead>
          <tbody>
            {(data.recent_notifications || []).length > 0 ? (
              (data.recent_notifications || []).map((notification) => (
                <tr key={notification.id}>
                  <td><span className="mono">#{String(notification.id).padStart(5, '0')}</span></td>
                  <td>
                    <div className="avatar-name">
                      {`${notification.first_name || ''} ${notification.last_name || ''}`.trim() || '-'}
                    </div>
                    <div className="avatar-sub">{notification.customer_code || '-'}</div>
                  </td>
                  <td style={{ color: 'var(--muted2)' }}>{notification.notification_type}</td>
                  <td>{statusBadge(notification.status)}</td>
                  <td><span className="mono">{notification.target_devices_count || 0}</span></td>
                  <td style={{ color: 'var(--muted2)' }}>
                    {notification.sent_at ? new Date(notification.sent_at).toLocaleString('it-IT') : '-'}
                  </td>
                  <td style={{ color: 'var(--muted2)' }}>
                    {notification.delivered_at ? new Date(notification.delivered_at).toLocaleString('it-IT') : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)' }}>
                  Nessuna notifica disponibile
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
