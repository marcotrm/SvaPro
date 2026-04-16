import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, ShoppingBag, Truck, Landmark, Calendar,
  BookOpen, TrendingUp, FileText, FolderOpen, PieChart,
  CreditCard, Wallet, ArrowUpRight, ArrowDownRight, Search,
  Plus, Filter, Download, Eye, Edit2, Trash2, ChevronRight,
  AlertCircle, CheckCircle2, Clock, Ban, Building2, Receipt,
  DollarSign, TrendingDown, Target, RefreshCw, Send, Copy,
  Loader, ExternalLink, UserCheck, Package,
} from 'lucide-react';
import { customers as customersApi, suppliers as suppliersApi, employees as employeesApi, reports, orders as ordersApi, cashMovements as cashMovementsApi, stores as storesApi } from '../api.jsx';
import { toast } from 'react-hot-toast';

// ── Palette colori ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F5F7FA',
  sidebar:   '#0E1726',
  surface:   '#FFFFFF',
  accent:    '#3B82F6',
  gold:      '#F59E0B',
  success:   '#10B981',
  danger:    '#EF4444',
  warning:   '#F97316',
  muted:     '#94A3B8',
  border:    '#E2E8F0',
  text:      '#0F172A',
  textSub:   '#64748B',
};

// ── Menu sezioni interne ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'dashboard',       label: 'Dashboard',         icon: BarChart3   },
  { id: 'anagrafiche',     label: 'Anagrafiche',       icon: Users       },
  { id: 'vendite',         label: 'Vendite',           icon: ShoppingBag },
  { id: 'acquisti',        label: 'Acquisti',          icon: Truck       },
  { id: 'tesoreria',       label: 'Tesoreria',         icon: Landmark    },
  { id: 'scadenziario',    label: 'Scadenziario',      icon: Calendar    },
  { id: 'contabilita',     label: 'Contabilità',       icon: BookOpen    },
  { id: 'iva',             label: 'IVA e Fiscale',     icon: PieChart    },
  { id: 'conto_economico', label: 'Conto Economico',   icon: TrendingDown},
  { id: 'documenti',       label: 'Documenti',         icon: FolderOpen  },
  { id: 'report',          label: 'Report',            icon: TrendingUp  },
];

// ── Componenti riutilizzabili ────────────────────────────────────────────────
const KPICard = ({ label, value, sub, color = C.accent, icon: Icon, trend, loading }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', flex: 1, minWidth: 160 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>
          {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.muted }} /> : value}
        </div>
        {sub && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{sub}</div>}
      </div>
      {Icon && <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} style={{ color }} />
      </div>}
    </div>
    {trend !== undefined && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 12, fontWeight: 600, color: trend >= 0 ? C.success : C.danger }}>
        {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {Math.abs(trend)}% vs mese scorso
      </div>
    )}
  </div>
);

const StatoBadge = ({ stato }) => {
  const map = {
    attivo:      { bg: '#F0FDF4', color: '#166534', label: 'Attivo'     },
    active:      { bg: '#F0FDF4', color: '#166534', label: 'Attivo'     },
    scaduto:     { bg: '#FEF2F2', color: '#991B1B', label: 'Scaduto'    },
    sospeso:     { bg: '#FFFBEB', color: '#92400E', label: 'Sospeso'    },
    suspended:   { bg: '#FFFBEB', color: '#92400E', label: 'Sospeso'    },
    bozza:       { bg: '#F8FAFC', color: '#475569', label: 'Bozza'      },
    inviato:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Inviato'    },
    pagato:      { bg: '#F0FDF4', color: '#166534', label: 'Pagato'     },
    paid:        { bg: '#F0FDF4', color: '#166534', label: 'Pagato'     },
    pending:     { bg: '#FFFBEB', color: '#92400E', label: 'In Attesa'  },
    'In Scadenza': { bg: '#FFFBEB', color: '#92400E', label: 'In Scadenza' },
    'Abbinato':  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Abbinato'  },
    'In Attesa': { bg: '#FEF9EC', color: '#B45309', label: 'In Attesa' },
  };
  const s = map[stato] || { bg: '#F1F5F9', color: '#475569', label: stato };
  return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>;
};

const SearchBar = ({ placeholder = 'Cerca...', onNew, newLabel = 'Nuovo', value, onChange }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
    <div style={{ flex: 1, position: 'relative' }}>
      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
      <input
        placeholder={placeholder}
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, outline: 'none', background: '#F8FAFC', boxSizing: 'border-box' }}
      />
    </div>
    {onNew && (
      <button onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: 'none', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <Plus size={14} /> {newLabel}
      </button>
    )}
  </div>
);

const Table = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
);

const Td = ({ children, mono }) => (
  <td style={{ padding: '12px 14px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}`, fontFamily: mono ? 'monospace' : undefined }}>{children}</td>
);

const EmptyState = ({ message, icon: Icon = FileText, action, actionLabel }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
    <Icon size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{message}</div>
    {action && (
      <button onClick={action} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Plus size={13} /> {actionLabel}
      </button>
    )}
  </div>
);

const LoadingSpinner = () => (
  <div style={{ textAlign: 'center', padding: 40 }}>
    <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: C.muted }} />
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// SEZIONE DASHBOARD — dati reali da reports.summary
// ══════════════════════════════════════════════════════════════════════════════

const SectionDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [trend, setTrend] = useState([]);

  useEffect(() => {
    Promise.all([
      reports.summary({ days: 30 }).catch(() => ({ data: {} })),
      reports.revenueTrend({ period: 'monthly', days: 365 }).catch(() => ({ data: { data: [] } }))
    ])
      .then(([r1, r2]) => {
        setStats(r1.data?.data || r1.data);
        setTrend(r2.data?.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const fmt = (v) => v != null ? `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0 })}` : '—';
  const num = (v) => v != null ? Number(v).toLocaleString('it-IT') : '—';

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Fatturato Mese"  value={fmt(stats?.revenue)}              loading={loading} trend={stats?.delta_revenue}  color={C.success} icon={TrendingUp}    />
        <KPICard label="Ordini Mese"     value={num(stats?.orders)}               loading={loading}                                color={C.accent}  icon={ShoppingBag}  />
        <KPICard label="Clienti Totali"  value={num(stats?.total_customers)}       loading={loading}                                color={C.gold}    icon={Users}        />
        <KPICard label="Scontrino Medio" value={fmt(stats?.avg_order)}            loading={loading}                                color={C.warning} icon={Receipt}      />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
        {/* Grafico andamento — placeholder visivo */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Andamento Incassi</div>
            <button onClick={() => navigate('/reports')} style={{ fontSize: 12, color: C.accent, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              Vedi Report Completo <ExternalLink size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader size={20} className="sp-spin" color={C.muted} /></div>
          ) : trend.length === 0 ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 13 }}>Nessun dato</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {(() => {
                const max = Math.max(...trend.map(t => parseFloat(t.revenue) || 0), 1);
                return trend.slice(-12).map((t, i) => {
                  const val = parseFloat(t.revenue) || 0;
                  const pct = Math.max((val / max) * 100, 5);
                  // parse label (e.g. 2026-04 -> Apr)
                  let lbl = t.period || t.label || '';
                  if (lbl.includes('-')) {
                    const d = new Date(lbl + '-01');
                    lbl = d.toLocaleDateString('it-IT', { month: 'short' });
                  }
                  return (
                    <div key={i} title={`€ ${val.toLocaleString('it-IT')}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', height: `${pct}%`, background: `linear-gradient(to top, ${C.accent}, ${C.accent}66)`, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease' }} />
                      <div style={{ fontSize: 9, color: C.muted, textTransform: 'capitalize' }}>{lbl}</div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Accesso rapido */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Accesso Rapido</div>
          {[
            { label: 'Gestione Clienti',   path: '/customers',      icon: Users,        color: C.accent  },
            { label: 'Gestione Fornitori', path: '/suppliers',      icon: Truck,        color: C.gold    },
            { label: 'Gestione Dipendenti',path: '/employees',      icon: UserCheck,    color: C.success },
            { label: 'Ordini Clienti',     path: '/orders',         icon: ShoppingBag,  color: C.warning },
            { label: 'Inventario',         path: '/inventory',      icon: Package,      color: C.danger  },
            { label: 'Report',             path: '/reports',        icon: TrendingUp,   color: C.muted   },
          ].map(({ label, path, icon: Icon, color }) => (
            <div
              key={path}
              onClick={() => navigate(path)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color }}>
                <Icon size={14} /> {label}
              </div>
              <ChevronRight size={14} style={{ color: C.muted }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SEZIONE ANAGRAFICHE — dati reali: Clienti, Dipendenti, Fornitori
// ══════════════════════════════════════════════════════════════════════════════

const SectionAnagrafiche = () => {
  const [subTab, setSubTab] = useState('clienti');
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const TABS = [
    ['clienti',    'Clienti'],
    ['dipendenti', 'Dipendenti'],
    ['fornitori',  'Fornitori'],
    ['pagamenti',  'Metodi Pagamento'],
    ['banche',     'Banche/Casse'],
    ['iva',        'Aliquote IVA'],
  ];

  const fetchData = useCallback(async (tab) => {
    setLoading(true);
    try {
      let res;
      if (tab === 'clienti')    res = await customersApi.getCustomers({ per_page: 50 });
      if (tab === 'dipendenti') res = await employeesApi.getEmployees({ per_page: 50 });
      if (tab === 'fornitori')  res = await suppliersApi.getAll({ per_page: 50 });
      setData(res?.data?.data || res?.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearch('');
    if (['clienti', 'dipendenti', 'fornitori'].includes(subTab)) fetchData(subTab);
    else setData([]);
  }, [subTab, fetchData]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(r => {
      const name = r.full_name || r.first_name || r.name || r.company_name || '';
      const email = r.email || '';
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });
  }, [data, search]);

  const handleNew = () => {
    if (subTab === 'clienti')    navigate('/customers');
    if (subTab === 'dipendenti') navigate('/employees');
    if (subTab === 'fornitori')  navigate('/suppliers');
  };

  const handleView = (item) => {
    if (subTab === 'clienti')    navigate(`/customers/${item.id}`);
    if (subTab === 'dipendenti') navigate(`/employees`);
    if (subTab === 'fornitori')  navigate(`/suppliers`);
  };

  const renderClienteRow = (c) => (
    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
      <Td><span style={{ fontWeight: 700 }}>{c.full_name || c.name}</span></Td>
      <Td mono>{c.phone || '—'}</Td>
      <Td mono>{c.email || '—'}</Td>
      <Td><span style={{ fontSize: 12, color: C.textSub }}>{c.loyalty_tier || '—'}</span></Td>
      <Td><StatoBadge stato={c.status || 'attivo'} /></Td>
      <Td>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={e => { e.stopPropagation(); navigate(`/customers/${c.id}`); }} style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }} title="Visualizza">
            <Eye size={13} style={{ color: C.textSub }} />
          </button>
        </div>
      </Td>
    </tr>
  );

  const renderDipendenteRow = (e) => (
    <tr key={e.id}>
      <Td><span style={{ fontWeight: 700 }}>{`${e.first_name || ''} ${e.last_name || ''}`.trim()}</span></Td>
      <Td>{e.role || e.position || '—'}</Td>
      <Td mono>{e.email || '—'}</Td>
      <Td mono>{e.phone || '—'}</Td>
      <Td><StatoBadge stato={e.status || 'active'} /></Td>
      <Td>
        <button onClick={() => navigate('/employees')} style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }} title="Visualizza">
          <ExternalLink size={13} style={{ color: C.accent }} />
        </button>
      </Td>
    </tr>
  );

  const renderFornitoreRow = (f) => (
    <tr key={f.id}>
      <Td><span style={{ fontWeight: 700 }}>{f.name || f.company_name}</span></Td>
      <Td mono>{f.vat_number || f.piva || '—'}</Td>
      <Td mono>{f.phone || '—'}</Td>
      <Td mono>{f.email || '—'}</Td>
      <Td><StatoBadge stato={f.status || 'attivo'} /></Td>
      <Td>
        <button onClick={() => navigate('/suppliers')} style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }} title="Visualizza">
          <Eye size={13} style={{ color: C.textSub }} />
        </button>
      </Td>
    </tr>
  );

  const isRealTab = ['clienti', 'dipendenti', 'fornitori'].includes(subTab);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>
            {l}
          </button>
        ))}
      </div>

      {isRealTab ? (
        <>
          <SearchBar
            placeholder={`Cerca ${subTab}...`}
            value={search}
            onChange={setSearch}
            onNew={handleNew}
            newLabel={subTab === 'clienti' ? 'Nuovo Cliente' : subTab === 'dipendenti' ? 'Nuovo Dipendente' : 'Nuovo Fornitore'}
          />
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
              <EmptyState
                message={`Nessun ${subTab === 'dipendenti' ? 'dipendente' : subTab === 'fornitori' ? 'fornitore' : 'cliente'} trovato`}
                icon={Users}
                action={handleNew}
                actionLabel="Crea nuovo"
              />
            ) : (
              <Table
                headers={
                  subTab === 'clienti'    ? ['Nome', 'Telefono', 'Email', 'Tier', 'Stato', 'Azioni'] :
                  subTab === 'dipendenti' ? ['Nome', 'Ruolo', 'Email', 'Telefono', 'Stato', 'Azioni'] :
                  ['Nome / Azienda', 'P.IVA', 'Telefono', 'Email', 'Stato', 'Azioni']
                }
                rows={filtered.slice(0, 50).map(item =>
                  subTab === 'clienti'    ? renderClienteRow(item) :
                  subTab === 'dipendenti' ? renderDipendenteRow(item) :
                  renderFornitoreRow(item)
                )}
              />
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
            {filtered.length} {subTab} mostrati
            {filtered.length >= 50 && ' — vai alla pagina dedicata per vedere tutti'}
          </div>
        </>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <AlertCircle size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sezione in costruzione</div>
          <div style={{ fontSize: 13, color: C.textSub }}>La gestione di {subTab} sarà disponibile a breve.</div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SEZIONE VENDITE — ordini reali  
// ══════════════════════════════════════════════════════════════════════════════

const SectionVendite = () => {
  const [subTab, setSubTab] = useState('ordini');
  const [ordersList, setOrdersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const TABS = [
    ['ordini',       'Ordini Clienti'],
    ['fatture',      'Fatture Emesse'],
    ['preventivi',   'Preventivi'],
    ['note',         'Note di Credito'],
    ['corrispettivi','Corrispettivi'],
  ];

  useEffect(() => {
    if (subTab !== 'ordini') return;
    setLoading(true);
    ordersApi.getOrders({ per_page: 20, sort: 'desc' })
      .then(r => setOrdersList(r?.data?.data || r?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subTab]);

  const formatEur = (v) => `€ ${Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>

      {subTab === 'ordini' ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => navigate('/orders')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <ExternalLink size={13} /> Gestisci Ordini
            </button>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {loading ? <LoadingSpinner /> : ordersList.length === 0 ? (
              <EmptyState message="Nessun ordine trovato" icon={ShoppingBag} action={() => navigate('/orders')} actionLabel="Vai agli Ordini" />
            ) : (
              <Table
                headers={['Numero', 'Data', 'Cliente', 'Totale', 'Stato', 'Azioni']}
                rows={ordersList.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/orders')}>
                    <Td mono>{o.order_number || `ORD-${o.id}`}</Td>
                    <Td>{o.created_at ? new Date(o.created_at).toLocaleDateString('it-IT') : '—'}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{o.customer_name || o.customer?.full_name || '—'}</span></Td>
                    <Td><span style={{ fontWeight: 700, color: C.success }}>{formatEur(o.grand_total)}</span></Td>
                    <Td><StatoBadge stato={o.status} /></Td>
                    <Td>
                      <button onClick={e => { e.stopPropagation(); navigate('/orders'); }} style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }}>
                        <Eye size={13} style={{ color: C.textSub }} />
                      </button>
                    </Td>
                  </tr>
                ))}
              />
            )}
          </div>
        </>
      ) : subTab === 'fatture' ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <Receipt size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Fatture Emesse</div>
          <button onClick={() => navigate('/invoices')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ExternalLink size={13} /> Vai alle Fatture
          </button>
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <AlertCircle size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sezione in costruzione</div>
          <div style={{ fontSize: 13, color: C.textSub }}>La sezione {TABS.find(t => t[0] === subTab)?.[1]} sarà disponibile a breve.</div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SEZIONE ACQUISTI
// ══════════════════════════════════════════════════════════════════════════════

const SectionAcquisti = () => {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState('ordini');
  const TABS = [['ordini','Ordini Fornitori'],['fatture','Fatture Ricevute'],['note','Note Credito Forn.'],['costi','Costi Ricorrenti']];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        {subTab === 'ordini' && (
          <>
            <Truck size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Ordini Fornitori</div>
            <button onClick={() => navigate('/purchase-orders')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ExternalLink size={13} /> Gestisci Ordini Fornitori
            </button>
          </>
        )}
        {subTab === 'fatture' && (
          <>
            <FileText size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Fatture Fornitori</div>
            <button onClick={() => navigate('/supplier-invoices')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ExternalLink size={13} /> Vai alle Fatture Fornitori
            </button>
          </>
        )}
        {!['ordini','fatture'].includes(subTab) && (
          <>
            <AlertCircle size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sezione in costruzione</div>
            <div style={{ fontSize: 13, color: C.textSub }}>Disponibile a breve.</div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Cash Alert Monitor (usato in Tesoreria) ────────────────────────────────
function CashAlertMonitor() {
  const [storeBalances, setStoreBalances] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [alertOnly, setAlertOnly]         = useState(false);
  const THRESHOLD = 1000;

  const loadBalances = async () => {
    try {
      const [storesRes, movRes] = await Promise.all([
        storesApi.getStores(),
        cashMovementsApi.getAll({ per_page: 500 }),
      ]);
      const stores = storesRes.data?.data || storesRes.data || [];
      const movements = movRes.data?.data || [];

      const balances = stores.map(store => {
        const storeMov = movements.filter(m => m.store_id === store.id);
        const balance = storeMov.reduce((sum, m) => {
          if (m.type === 'in' || m.type === 'sale') return sum + parseFloat(m.amount || 0);
          if (m.type === 'out' || m.type === 'expense') return sum - parseFloat(m.amount || 0);
          return sum;
        }, 0);
        return { ...store, balance };
      });
      setStoreBalances(balances);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadBalances();
    const t = setInterval(loadBalances, 30000);
    return () => clearInterval(t);
  }, []);

  const alertStores = storeBalances.filter(s => s.balance >= THRESHOLD);
  const displayed   = alertOnly ? alertStores : storeBalances;
  const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={18} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>Monitoraggio Cassa Live</div>
            <div style={{ fontSize: 12, color: C.textSub }}>Aggiornamento ogni 30s · Soglia allerta ≥ €1.000</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {alertStores.length > 0 && (
            <button
              onClick={() => setAlertOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: alertOnly ? '#ef4444' : 'rgba(239,68,68,0.12)', color: alertOnly ? '#fff' : '#ef4444', transition: 'all 0.2s' }}
            >
              🔴 {alertStores.length} negoz{alertStores.length === 1 ? 'io' : 'i'} ≥ €1.000
            </button>
          )}
          <button onClick={loadBalances} title="Aggiorna" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Loader size={20} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} /></div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: C.textSub }}>Nessun dato cassa disponibile.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {displayed.map(store => {
            const isAlert = store.balance >= THRESHOLD;
            return (
              <div key={store.id} style={{
                padding: '12px 14px', borderRadius: 10,
                background: isAlert ? 'rgba(239,68,68,0.07)' : C.bg,
                border: `1px solid ${isAlert ? 'rgba(239,68,68,0.35)' : C.border}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{store.name}</span>
                  {isAlert && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 10 }}>⚠ ALLERTA</span>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: isAlert ? '#ef4444' : C.text }}>{fmt(store.balance)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mock sections — con bottoni "Crea" e link alle pagine dedicate
const SectionTesoreria = () => {
  const navigate = useNavigate();
  return (
    <div>
      <CashAlertMonitor />
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Saldo Totale"       value="—"  color={C.success} icon={Wallet}     />
        <KPICard label="Saldo Banca"        value="—"  color={C.accent}  icon={Landmark}   />
        <KPICard label="Saldo Cassa"        value="—"  color={C.gold}    icon={DollarSign} />
        <KPICard label="Flusso Previsto 7gg" value="—" color={C.warning} icon={TrendingUp} />
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <Wallet size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Modulo Tesoreria</div>
        <button onClick={() => navigate('/tesoreria')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ExternalLink size={13} /> Vai alla Tesoreria
        </button>
      </div>
    </div>
  );
};

const SectionScadenziario = () => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
    <Calendar size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Scadenziario</div>
    <div style={{ fontSize: 13, color: C.textSub }}>Modulo in sviluppo.</div>
  </div>
);

const SectionContabilita = () => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
    <BookOpen size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Contabilità</div>
    <div style={{ fontSize: 13, color: C.textSub }}>Modulo in sviluppo.</div>
  </div>
);

const SectionIva = () => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
    <PieChart size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>IVA e Fiscale</div>
    <div style={{ fontSize: 13, color: C.textSub }}>Modulo in sviluppo.</div>
  </div>
);

const SectionDocumenti = () => {
  const navigate = useNavigate();
  return (
    <div>
      <SearchBar placeholder="Cerca per nome, tipo, cliente..." onNew={() => {}} newLabel="Carica Documento" />
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <FolderOpen size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Gestione Documenti</div>
        <div style={{ fontSize: 13, color: C.textSub }}>Modulo in sviluppo.</div>
      </div>
    </div>
  );
};

const SectionReport = () => {
  const navigate = useNavigate();
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Fatturato Totale" value="—" color={C.success} icon={TrendingUp}   />
        <KPICard label="Costi Totali"     value="—" color={C.danger}  icon={TrendingDown} />
        <KPICard label="Margine"          value="—" color={C.accent}  icon={Target}       />
        <KPICard label="Clienti Attivi"   value="—" color={C.gold}    icon={Users}        />
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <TrendingUp size={36} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Report Avanzati</div>
        <button onClick={() => navigate('/reports')} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ExternalLink size={13} /> Vai ai Report
        </button>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTO ECONOMICO NEGOZIO
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CATEGORIES = [
  { id: 'affitto',        label: 'Affitto / Leasing',       icon: '🏠' },
  { id: 'corrente',       label: 'Corrente Elettrica',       icon: '⚡' },
  { id: 'gas',            label: 'Gas',                      icon: '🔥' },
  { id: 'telefono',       label: 'Telefono / Internet',      icon: '📱' },
  { id: 'dipendenti',     label: 'Stipendi Dipendenti',      icon: '👥' },
  { id: 'contributi',     label: 'Contributi / INPS',        icon: '🏛️' },
  { id: 'pubblicita',     label: 'Pubblicità & Marketing',   icon: '📣' },
  { id: 'forniture',      label: 'Forniture & Materiali',    icon: '📦' },
  { id: 'commercialista', label: 'Commercialista / Consulenze', icon: '📋' },
  { id: 'assicurazione',  label: 'Assicurazione',            icon: '🛡️' },
  { id: 'tasse',          label: 'Tasse & Imposte',          icon: '🏦' },
  { id: 'altro',          label: 'Altri Costi',              icon: '📎' },
];

const SectionContoEconomico = () => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [storesList, setStoresList] = useState([]);
  const [storeId, setStoreId] = useState('all');
  const [revenue, setRevenue] = useState(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [expenses, setExpenses] = useState({});
  const [customCats, setCustomCats] = useState([]);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const lsKey = `svapro_conto_eco_${storeId}_${month}`;

  // Carica negozi
  useEffect(() => {
    storesApi.getStores().then(r => setStoresList(r.data?.data || [])).catch(() => {});
  }, []);

  // Carica spese dal localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(lsKey) || '{}');
      setExpenses(saved.expenses || {});
      setCustomCats(saved.customCats || []);
    } catch { setExpenses({}); setCustomCats([]); }
  }, [lsKey]);

  // Carica ricavi dal backend
  useEffect(() => {
    const fetchRevenue = async () => {
      setLoadingRevenue(true);
      try {
        const [y, m] = month.split('-');
        const params = { year: y, month: m, ...(storeId !== 'all' ? { store_id: storeId } : {}) };
        const res = await reports.getSummary?.(params) || await reports.getCashSummary?.(params);
        const data = res?.data?.data || res?.data || {};
        setRevenue(parseFloat(data.total_net_revenue ?? data.net_revenue ?? data.total_revenue ?? data.total ?? 0));
      } catch { setRevenue(null); }
      finally { setLoadingRevenue(false); }
    };
    fetchRevenue();
  }, [month, storeId]);

  const allCats = [...DEFAULT_CATEGORIES, ...customCats.map(c => ({ id: c.id, label: c.label, icon: '💼' }))];

  const totalExpenses = allCats.reduce((acc, c) => acc + (parseFloat(expenses[c.id]) || 0), 0);
  const utile = revenue != null ? (revenue - totalExpenses) : null;

  const handleExpenseChange = (id, val) => {
    setExpenses(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(lsKey, JSON.stringify({ expenses, customCats }));
    setTimeout(() => setSaving(false), 600);
  };

  const addCustomCat = () => {
    if (!newCatLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    setCustomCats(prev => [...prev, { id, label: newCatLabel.trim() }]);
    setNewCatLabel('');
  };

  const removeCustomCat = (id) => {
    setCustomCats(prev => prev.filter(c => c.id !== id));
    setExpenses(prev => { const n = {...prev}; delete n[id]; return n; });
  };

  const fmt = (v) => v != null ? `€ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filtri */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Negozio</div>
          <select value={storeId} onChange={e => setStoreId(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
            <option value="all">Tutti i negozi</option>
            {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 6 }}>Mese di competenza</div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }} />
        </div>
        <button onClick={handleSave} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: saving ? C.success : C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
          {saving ? <><CheckCircle2 size={14} /> Salvato!</> : <><Download size={14} /> Salva Dati</>}
        </button>
      </div>

      {/* KPI Riepilogo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>💰 Ricavi (Vendite)</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.success }}>
            {loadingRevenue ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : fmt(revenue)}
          </div>
          <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>Fatturato netto da ordini</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>📉 Totale Spese</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.danger }}>{fmt(totalExpenses)}</div>
          <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>Somma di tutti i costi</div>
        </div>
        <div style={{ background: utile != null && utile >= 0 ? '#F0FDF4' : '#FEF2F2', border: `2px solid ${utile != null && utile >= 0 ? C.success : C.danger}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, color: utile != null && utile >= 0 ? C.success : C.danger }}>
            {utile != null && utile >= 0 ? '📈 Utile Netto' : '📉 Perdita'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: utile != null && utile >= 0 ? C.success : C.danger }}>
            {utile != null ? fmt(utile) : '—'}
          </div>
          {utile != null && revenue != null && revenue > 0 && (
            <div style={{ fontSize: 11, marginTop: 4, color: utile >= 0 ? C.success : C.danger }}>
              Margine: {((utile / revenue) * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Tabella spese */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>📋 Voci di Costo</div>
          <div style={{ fontSize: 12, color: C.textSub }}>Inserisci gli importi mensili per ogni voce</div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allCats.map(cat => {
            const val = expenses[cat.id] ?? '';
            const isCustom = customCats.some(c => c.id === cat.id);
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: val && parseFloat(val) > 0 ? '#FEF9EC' : '#F8FAFC', border: `1px solid ${val && parseFloat(val) > 0 ? '#FDE68A' : C.border}`, transition: 'all 0.15s' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{cat.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{cat.label}</span>
                <div style={{ position: 'relative', width: 160 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.muted, fontWeight: 700 }}>€</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={val}
                    onChange={e => handleExpenseChange(cat.id, e.target.value)}
                    placeholder="0,00"
                    style={{ width: '100%', padding: '8px 10px 8px 28px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: val && parseFloat(val) > 0 ? C.danger : C.text, textAlign: 'right', boxSizing: 'border-box', background: '#fff', outline: 'none' }}
                  />
                </div>
                {val && parseFloat(val) > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.danger, minWidth: 90, textAlign: 'right' }}>{fmt(parseFloat(val))}</span>
                )}
                {isCustom && (
                  <button onClick={() => removeCustomCat(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4, display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Aggiungi voce personalizzata */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomCat()}
              placeholder="+ Aggiungi voce personalizzata (es: Manutenzione)..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, background: '#F8FAFC', outline: 'none' }} />
            <button onClick={addCustomCat} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Riepilogo finale */}
      {utile != null && (
        <div style={{ padding: '20px 24px', background: utile >= 0 ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', border: `2px solid ${utile >= 0 ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: utile >= 0 ? '#166534' : '#991B1B', marginBottom: 4 }}>
                {utile >= 0 ? '✅ Risultato Positivo' : '⚠️ Risultato Negativo'} — {month.split('-').reverse().join('/')}
              </div>
              <div style={{ fontSize: 11, color: utile >= 0 ? '#166534' : '#991B1B', opacity: 0.7 }}>
                Ricavi {fmt(revenue)} — Costi {fmt(totalExpenses)}
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: utile >= 0 ? '#166534' : '#991B1B', letterSpacing: '-0.02em' }}>
              {fmt(utile)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGINA PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminPanelPage() {
  const [active, setActive] = useState('dashboard');
  const [hoveredTab, setHoveredTab] = useState(null);

  const content = useMemo(() => {
    switch (active) {
      case 'dashboard':        return <SectionDashboard />;
      case 'anagrafiche':      return <SectionAnagrafiche />;
      case 'vendite':          return <SectionVendite />;
      case 'acquisti':         return <SectionAcquisti />;
      case 'tesoreria':        return <SectionTesoreria />;
      case 'scadenziario':     return <SectionScadenziario />;
      case 'contabilita':      return <SectionContabilita />;
      case 'iva':              return <SectionIva />;
      case 'conto_economico':  return <SectionContoEconomico />;
      case 'documenti':        return <SectionDocumenti />;
      case 'report':           return <SectionReport />;
      default:                 return null;
    }
  }, [active]);

  const current = SECTIONS.find(s => s.id === active);
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)', background: C.bg, margin: '-24px -32px -40px', overflow: 'hidden' }}>

      {/* ── Tab Bar orizzontale ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: C.sidebar, padding: '10px 16px',
        overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isAct = active === id;
          const isHov = hoveredTab === id;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              onMouseEnter={() => setHoveredTab(id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 10, border: 'none',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontSize: 13, fontWeight: isAct ? 700 : 500, transition: 'all 0.15s',
                background: isAct ? C.accent : isHov ? 'rgba(255,255,255,0.09)' : 'transparent',
                color: isAct ? '#fff' : isHov ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: isAct ? `0 0 0 1px ${C.accent}` : 'none',
                transform: isHov && !isAct ? 'translateY(-1px)' : 'translateY(0)',
              }}
            >
              <Icon size={14} style={{ opacity: isAct ? 1 : 0.7, flexShrink: 0 }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
              {current?.icon && React.createElement(current.icon, { size: 20, style: { display: 'inline', marginRight: 8, verticalAlign: 'middle', color: C.accent } })}
              Dashboard Amministrativa — {current?.label}
            </h1>
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 2 }}>
              Vista aggiornata al {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.location.reload()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
              <RefreshCw size={13} /> Aggiorna
            </button>
          </div>
        </div>

        {content}
      </div>

      {/* Spin CSS */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
