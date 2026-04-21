import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
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
import CustomersPage from './CustomersPage.jsx';
import SuppliersPage from './SuppliersPage.jsx';
import EmployeesPage from './EmployeesPage.jsx';
import CategoryPage from './CategoryPage.jsx';
// â”€â”€ Palette colori â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Menu sezioni interne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SECTIONS = [
  { id: 'dashboard',       label: 'Dashboard',         icon: BarChart3   },
  { id: 'anagrafiche',     label: 'Anagrafiche',       icon: Users       },
  { id: 'vendite',         label: 'Vendite',           icon: ShoppingBag },
  { id: 'acquisti',        label: 'Acquisti',          icon: Truck       },
  { id: 'tesoreria',       label: 'Tesoreria',         icon: Landmark    },
  { id: 'scadenziario',    label: 'Scadenziario',      icon: Calendar    },
  { id: 'contabilita',     label: 'ContabilitÃ ',       icon: BookOpen    },
  { id: 'iva',             label: 'IVA e Fiscale',     icon: PieChart    },
  { id: 'conto_economico', label: 'Conto Economico',   icon: TrendingDown},
  { id: 'documenti',       label: 'Documenti',         icon: FolderOpen  },
  { id: 'report',          label: 'Report',            icon: TrendingUp  },
];

// â”€â”€ Componenti riutilizzabili â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SEZIONE DASHBOARD â€” dati reali da reports.summary
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  const fmt = (v) => v != null ? `â‚¬ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 0 })}` : 'â€”';
  const num = (v) => v != null ? Number(v).toLocaleString('it-IT') : 'â€”';

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Fatturato Mese"  value={fmt(stats?.revenue)}              loading={loading} trend={stats?.delta_revenue}  color={C.success} icon={TrendingUp}    />
        <KPICard label="Ordini Mese"     value={num(stats?.orders)}               loading={loading}                                color={C.accent}  icon={ShoppingBag}  />
        <KPICard label="Clienti Totali"  value={num(stats?.total_customers)}       loading={loading}                                color={C.gold}    icon={Users}        />
        <KPICard label="Scontrino Medio" value={fmt(stats?.avg_order)}            loading={loading}                                color={C.warning} icon={Receipt}      />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
        {/* Grafico andamento â€” placeholder visivo */}
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
                    <div key={i} title={`â‚¬ ${val.toLocaleString('it-IT')}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SEZIONE ANAGRAFICHE â€” dati reali: Clienti, Dipendenti, Fornitori
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Generic CRUD form/list for new mock tabs
const GenericCrudTab = ({ title, fields, defaultData }) => {
  const [data, setData] = useState(defaultData || []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  const handleSave = (e) => {
    e.preventDefault();
    setData([...data, { id: Date.now(), ...form }]);
    setForm({});
    setShowForm(false);
    toast.success(`${title} creato con successo!`);
  };

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 800 }}>{title}</h3>
        <button onClick={() => setShowForm(!showForm)} className="sp-btn sp-btn-primary" style={{ padding: '8px 16px', fontSize: 13, gap: 6, display: 'flex', alignItems: 'center' }}>
          {showForm ? 'Annulla' : <><Plus size={14} /> Crea Nuovo</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {fields.map(f => (
              <div key={f.name}>
                <label className="sp-label">{f.label}</label>
                <input required className="sp-input" type={f.type || 'text'} value={form[f.name] || ''} onChange={e => setForm({...form, [f.name]: e.target.value})} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button type="submit" className="sp-btn sp-btn-primary">Salva {title}</button>
          </div>
        </form>
      )}

      {data.length === 0 ? (
        <EmptyState message={`Nessun ${title.toLowerCase()} configurato.`} />
      ) : (
        <Table
          headers={fields.map(f => f.label).concat(['Azioni'])}
          rows={data.map((item, i) => (
            <tr key={item.id || i}>
              {fields.map(f => <Td key={f.name}>{item[f.name]}</Td>)}
              <Td>
                <button onClick={() => setData(data.filter(d => d.id !== item.id))} style={{ color: C.danger, background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </Td>
            </tr>
          ))}
        />
      )}
    </div>
  );
};

const SectionAnagrafiche = () => {
  const [subTab, setSubTab] = useState('clienti');

  const TABS = [
    ['clienti',    'Clienti'],
    ['dipendenti', 'Dipendenti'],
    ['fornitori',  'Fornitori'],
    ['pagamenti',  'Metodi Pagamento'],
    ['banche',     'Banche/Casse'],
    ['iva',        'Aliquote IVA'],
    ['categoria',  'Categorie'],
    ['listini',    'Listini'],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {subTab === 'clienti' && <CustomersPage />}
        {subTab === 'dipendenti' && <EmployeesPage />}
        {subTab === 'fornitori' && <SuppliersPage />}
        {subTab === 'categoria' && <CategoryPage />}
        
        {subTab === 'pagamenti' && (
          <GenericCrudTab 
            title="Metodi Pagamento" 
            fields={[{label: 'Nome Metodo', name: 'nome'}, {label: 'Tipo', name: 'tipo'}]} 
            defaultData={[{id: 1, nome: 'Contanti', tipo: 'Cash'}, {id: 2, nome: 'Carta di Credito', tipo: 'POS'}]} 
          />
        )}

        {subTab === 'banche' && (
          <GenericCrudTab 
            title="Banche e Casse" 
            fields={[{label: 'Nome Banca', name: 'nome'}, {label: 'IBAN', name: 'iban'}]} 
            defaultData={[{id: 1, nome: 'Banca Intesa', iban: 'IT00A12345678901234567890'}]} 
          />
        )}

        {subTab === 'iva' && (
          <GenericCrudTab 
            title="Aliquote IVA" 
            fields={[{label: 'Codice', name: 'codice'}, {label: 'Percentuale', name: 'percentuale', type: 'number'}]} 
            defaultData={[{id: 1, codice: 'IVA22', percentuale: '22'}, {id: 2, codice: 'IVA10', percentuale: '10'}]} 
          />
        )}

        {subTab === 'listini' && (
          <GenericCrudTab 
            title="Listini Prezzo" 
            fields={[{label: 'Nome Listino', name: 'nome'}, {label: 'Descrizione', name: 'desc'}]} 
            defaultData={[{id: 1, nome: 'Listino Base', desc: 'Prezzi di listino standard'}, {id: 2, nome: 'Listino Rivenditori', desc: 'Sconto 20%'}]} 
          />
        )}
      </div>
    </div>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SEZIONE VENDITE â€” ordini reali  
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  const formatEur = (v) => `â‚¬ ${Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;

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
                    <Td>{o.created_at ? new Date(o.created_at).toLocaleDateString('it-IT') : 'â€”'}</Td>
                    <Td><span style={{ fontWeight: 600 }}>{o.customer_name || o.customer?.full_name || 'â€”'}</span></Td>
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
          <div style={{ fontSize: 13, color: C.textSub }}>La sezione {TABS.find(t => t[0] === subTab)?.[1]} sarÃ  disponibile a breve.</div>
        </div>
      )}
    </div>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SEZIONE ACQUISTI
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â”€â”€â”€ Cash Alert Monitor (usato in Tesoreria) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            <div style={{ fontSize: 12, color: C.textSub }}>Aggiornamento ogni 30s Â· Soglia allerta â‰¥ â‚¬1.000</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {alertStores.length > 0 && (
            <button
              onClick={() => setAlertOnly(v => !v)}
              style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: alertOnly ? '#ef4444' : 'rgba(239,68,68,0.12)', color: alertOnly ? '#fff' : '#ef4444', transition: 'all 0.2s' }}
            >
              ðŸ”´ {alertStores.length} negoz{alertStores.length === 1 ? 'io' : 'i'} â‰¥ â‚¬1.000
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
                  {isAlert && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 10 }}>âš  ALLERTA</span>}
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

// Mock sections â€” con bottoni "Crea" e link alle pagine dedicate
const SectionTesoreria = () => {
  const navigate = useNavigate();
  return (
    <div>
      <CashAlertMonitor />
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Saldo Totale"       value="â€”"  color={C.success} icon={Wallet}     />
        <KPICard label="Saldo Banca"        value="â€”"  color={C.accent}  icon={Landmark}   />
        <KPICard label="Saldo Cassa"        value="â€”"  color={C.gold}    icon={DollarSign} />
        <KPICard label="Flusso Previsto 7gg" value="â€”" color={C.warning} icon={TrendingUp} />
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
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>ContabilitÃ </div>
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
        <KPICard label="Fatturato Totale" value="â€”" color={C.success} icon={TrendingUp}   />
        <KPICard label="Costi Totali"     value="â€”" color={C.danger}  icon={TrendingDown} />
        <KPICard label="Margine"          value="â€”" color={C.accent}  icon={Target}       />
        <KPICard label="Clienti Attivi"   value="â€”" color={C.gold}    icon={Users}        />
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONTO ECONOMICO NEGOZIO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const DEFAULT_CATEGORIES = [
  { id: 'affitto',        label: 'Affitto / Leasing',       icon: 'ðŸ ' },
  { id: 'corrente',       label: 'Corrente Elettrica',       icon: 'âš¡' },
  { id: 'gas',            label: 'Gas',                      icon: 'ðŸ”¥' },
  { id: 'telefono',       label: 'Telefono / Internet',      icon: 'ðŸ“±' },
  { id: 'dipendenti',     label: 'Stipendi Dipendenti',      icon: 'ðŸ‘¥' },
  { id: 'contributi',     label: 'Contributi / INPS',        icon: 'ðŸ›ï¸' },
  { id: 'pubblicita',     label: 'PubblicitÃ  & Marketing',   icon: 'ðŸ“£' },
  { id: 'forniture',      label: 'Forniture & Materiali',    icon: 'ðŸ“¦' },
  { id: 'commercialista', label: 'Commercialista / Consulenze', icon: 'ðŸ“‹' },
  { id: 'assicurazione',  label: 'Assicurazione',            icon: 'ðŸ›¡ï¸' },
  { id: 'tasse',          label: 'Tasse & Imposte',          icon: 'ðŸ¦' },
  { id: 'altro',          label: 'Altri Costi',              icon: 'ðŸ“Ž' },
];

const SectionContoEconomico = ({ selectedStoreId }) => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [storesList, setStoresList] = useState([]);
  const [storeId, setStoreId] = useState('all');

  // Sync with global store selector
  useEffect(() => {
    if (selectedStoreId) setStoreId(String(selectedStoreId));
    else setStoreId('all');
  }, [selectedStoreId]);

  useEffect(() => {
    storesApi.getStores().then(r => setStoresList(r.data?.data || [])).catch(() => {});
  }, []);
  const [summary,  setSummary]  = useState(null);
  const [stores_,  setStores_]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  const fmt = (v) => v != null
    ? `â‚¬ ${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'â€”';

  useEffect(() => {
    const [y, m] = month.split('-');
    setLoading(true); setSummary(null); setStores_([]);
    const params = { year: y, month: m, ...(storeId !== 'all' ? { store_id: storeId } : {}) };
    Promise.all([
      reports.summary(params).catch(() => null),
      reports.storeRevenue(params).catch(() => null),
    ]).then(([sumRes, storeRes]) => {
      setSummary(sumRes?.data?.data || sumRes?.data || null);
      const raw = storeRes?.data?.data || storeRes?.data || [];
      setStores_(Array.isArray(raw) ? raw : []);
    }).finally(() => setLoading(false));
  }, [month, storeId]);

  const revenue      = parseFloat(summary?.total_net_revenue ?? summary?.net_revenue ?? summary?.total_revenue ?? summary?.total ?? 0) || 0;
  const orders       = parseInt(summary?.total_orders ?? summary?.orders_count ?? 0) || 0;
  const avgOrder     = orders > 0 ? revenue / orders : 0;
  const cogs         = parseFloat(summary?.total_cost ?? summary?.cogs ?? 0) || 0;
  const margine      = revenue > 0 ? ((revenue - cogs) / revenue * 100) : null;

  const monthLabel   = new Date(month + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filter: mese + negozio */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mese di competenza</div>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: 12, border: `2px solid ${C.accent}`, fontSize: 15, fontWeight: 700, color: C.text, background: '#fff', cursor: 'pointer', outline: 'none' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Negozio</div>
          <select value={storeId} onChange={e => setStoreId(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, cursor: 'pointer', background: '#fff', fontWeight: 600, height: 44 }}>
            <option value="all">Tutti i negozi</option>
            {storesList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        </div>
        {loading && <Loader size={18} style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} />}
      </div>

      {/* â”€â”€ KPI Riepilogo â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'ðŸ’° Fatturato Netto', value: fmt(revenue),    color: C.success, sub: 'Da vendite POS' },
          { label: 'ðŸ§¾ NÂ° Ordini',       value: orders || 'â€”',   color: C.accent,  sub: 'Transazioni totali' },
          { label: 'ðŸ“Š Scontrino Medio', value: fmt(avgOrder),   color: C.gold,    sub: 'Media per ordine' },
          { label: 'ðŸ“‰ Costo Merce',     value: fmt(cogs),       color: C.danger,  sub: 'COGS stimato' },
          ...(margine != null ? [{ label: 'ðŸ“ˆ Margine Lordo', value: `${margine.toFixed(1)}%`, color: margine >= 40 ? C.success : margine >= 20 ? C.gold : C.danger, sub: 'Su ricavi netti' }] : []),
        ].map(k => (
          <div key={k.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: loading ? C.muted : k.color }}>
              {loading ? 'â€¦' : k.value}
            </div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* â”€â”€ Breakdown per negozio â”€â”€ */}
      {stores_.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 800, fontSize: 14 }}>
            ðŸ“ Fatturato per Negozio â€” {monthLabel}
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stores_.sort((a,b) => (parseFloat(b.total_revenue||b.revenue||0)) - (parseFloat(a.total_revenue||a.revenue||0))).map((s, i) => {
              const val = parseFloat(s.total_revenue ?? s.revenue ?? s.net_revenue ?? 0);
              const maxVal = parseFloat(stores_[0]?.total_revenue ?? stores_[0]?.revenue ?? 1);
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={s.store_id ?? s.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `hsl(${(i*67+210)%360},55%,52%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, fontWeight: 900, color:'#fff', flexShrink: 0 }}>
                    {i+1}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 100 }}>
                    {s.store_name ?? s.name ?? `Store ${s.store_id}`}
                  </div>
                  <div style={{ flex: 3, background: '#F1F5F9', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `hsl(${(i*67+210)%360},55%,52%)`, borderRadius: 6, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.success, minWidth: 110, textAlign: 'right' }}>
                    {fmt(val)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !summary && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: C.textSub, fontSize: 14 }}>
          <TrendingDown size={36} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
          Nessun dato disponibile per {monthLabel}
        </div>
      )}
    </div>
  );
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function AdminPanelPage() {
  const { selectedStoreId } = useOutletContext?.() || {};
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
      case 'conto_economico':  return <SectionContoEconomico selectedStoreId={selectedStoreId} />;
      case 'documenti':        return <SectionDocumenti />;
      case 'report':           return <SectionReport />;
      default:                 return null;
    }
  }, [active]);

  const current = SECTIONS.find(s => s.id === active);
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)', background: C.bg, margin: '-24px -32px -40px', overflow: 'hidden' }}>

      {/* â”€â”€ Tab Bar orizzontale â”€â”€ */}
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

      {/* â”€â”€ Main Content â”€â”€ */}
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.02em' }}>
              {current?.icon && React.createElement(current.icon, { size: 20, style: { display: 'inline', marginRight: 8, verticalAlign: 'middle', color: C.accent } })}
              Dashboard Amministrativa â€” {current?.label}
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
