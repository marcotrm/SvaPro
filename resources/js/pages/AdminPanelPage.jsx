import React, { useState, useMemo } from 'react';
import {
  BarChart3, Users, ShoppingBag, Truck, Landmark, Calendar,
  BookOpen, TrendingUp, FileText, FolderOpen, PieChart,
  CreditCard, Wallet, ArrowUpRight, ArrowDownRight, Search,
  Plus, Filter, Download, Eye, Edit2, Trash2, ChevronRight,
  AlertCircle, CheckCircle2, Clock, Ban, Building2, Receipt,
  DollarSign, TrendingDown, Target, RefreshCw, Send, Copy,
} from 'lucide-react';

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

// ── Dati mock ───────────────────────────────────────────────────────────────
const MOCK_CLIENTI = [
  { id: 1, nome: 'Rossi Srl',       piva: '02764000730', contatto: '340-1234567', scadenza: '31/05/2025', stato: 'attivo'  },
  { id: 2, nome: 'Rey Gi',          piva: '02842001',     contatto: '320-9876543', scadenza: '31/03/2025', stato: 'scaduto' },
  { id: 3, nome: 'Rossi Srl',       piva: '02764000730', contatto: '340-1234567', scadenza: '21/03/2025', stato: 'attivo'  },
  { id: 4, nome: 'Senoni Srl',      piva: '08726541001', contatto: '347-5550099', scadenza: '21/03/2025', stato: 'attivo'  },
  { id: 5, nome: 'Resi Gi',         piva: '02842001',     contatto: '320-9876543', scadenza: '24/10/2025', stato: 'sospeso' },
];

const MOCK_FATTURE = [
  { id: 'DOC-001', data: '30/09/2023', cliente: 'NasoSrl',        totale: 30000, stato: 'SU_Lead',   pagamento: 'bonifico' },
  { id: 'DOC-002', data: '41/09/2023', cliente: 'NasoSrl001',     totale: 20000, stato: 'SU_Lead',   pagamento: 'contanti' },
  { id: 'DOC-003', data: '11/09/2023', cliente: 'NasoSrlLarange', totale: 16000, stato: 'Testabile', pagamento: 'carta'    },
  { id: 'DOC-004', data: '22/09/2023', cliente: 'NasoSrl2nto',    totale: 30000, stato: 'SU_Lead',   pagamento: 'bonifico' },
];

const MOCK_MOVIMENTI = [
  { data: '30/04/2024', desc: 'Incasso Pos&cali', conto: 'Cassa',    entrata: 15200, uscita: 0,      stato: 'Abbinato' },
  { data: '30/04/2024', desc: 'Fornitura',        conto: 'Banca',    entrata: 0,     uscita: 21000,  stato: 'In Attesa' },
  { data: '30/04/2024', desc: 'Gare Banco',       conto: 'Banca',    entrata: 25000, uscita: 0,      stato: 'Abbinato' },
  { data: '30/04/2024', desc: 'Quele Lavoro',     conto: 'Banca',    entrata: 14000, uscita: 160.00, stato: 'In Attesa' },
];

const MOCK_SCADENZE = [
  { scadenza: '08/03/2023', soggetto: 'Banco Corso',  documento: 'boo0',  totale: 10400, pagato: 0,     residuo: 10400, stato: 'In Scadenza' },
  { scadenza: '10/03/2023', soggetto: 'Podenho',      documento: 'boo0',  totale: 25000, pagato: 0,     residuo: 25000, stato: 'SR Made'     },
  { scadenza: '40/11/2023', soggetto: 'Banco Corso',  documento: 'B300',  totale: 15000, pagato: 5000,  residuo: 10000, stato: 'SR Made'     },
  { scadenza: '20/11/2023', soggetto: 'Banco Corso',  documento: 'Pragas',totale: 29000, pagato: 0,     residuo: 29000, stato: 'In Scadenza' },
];

// ── Menu sezioni interne ─────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'dashboard',    label: 'Dashboard',      icon: BarChart3   },
  { id: 'anagrafiche',  label: 'Anagrafiche',    icon: Users       },
  { id: 'vendite',      label: 'Vendite',        icon: ShoppingBag },
  { id: 'acquisti',     label: 'Acquisti',       icon: Truck       },
  { id: 'tesoreria',    label: 'Tesoreria',      icon: Landmark    },
  { id: 'scadenziario', label: 'Scadenziario',   icon: Calendar    },
  { id: 'contabilita',  label: 'Contabilità',    icon: BookOpen    },
  { id: 'iva',          label: 'IVA e Fiscale',  icon: PieChart    },
  { id: 'documenti',    label: 'Documenti',      icon: FolderOpen  },
  { id: 'report',       label: 'Report',         icon: TrendingUp  },
];

// ── Componenti riutilizzabili ────────────────────────────────────────────────
const KPICard = ({ label, value, sub, color = C.accent, icon: Icon, trend }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', flex: 1, minWidth: 160 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>{value}</div>
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
    scaduto:     { bg: '#FEF2F2', color: '#991B1B', label: 'Scaduto'    },
    sospeso:     { bg: '#FFFBEB', color: '#92400E', label: 'Sospeso'    },
    bozza:       { bg: '#F8FAFC', color: '#475569', label: 'Bozza'      },
    inviato:     { bg: '#EFF6FF', color: '#1D4ED8', label: 'Inviato'    },
    pagato:      { bg: '#F0FDF4', color: '#166534', label: 'Pagato'      },
    'In Scadenza': { bg: '#FFFBEB', color: '#92400E', label: 'In Scadenza' },
    'SR Made':   { bg: '#F0FDF4', color: '#166534', label: 'SR Made'    },
    'Abbinato':  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Abbinato'   },
    'In Attesa': { bg: '#FEF9EC', color: '#B45309', label: 'In Attesa'  },
    'SU_Lead':   { bg: '#FEF9EC', color: '#B45309', label: 'Su Lead'    },
    'Testabile': { bg: '#EDE9FE', color: '#6D28D9', label: 'Testabile'  },
  };
  const s = map[stato] || { bg: '#F1F5F9', color: '#475569', label: stato };
  return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{s.label}</span>;
};

const SearchBar = ({ placeholder = 'Cerca...', onNew, newLabel = 'Nuovo' }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
    <div style={{ flex: 1, position: 'relative' }}>
      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
      <input placeholder={placeholder} style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, outline: 'none', background: '#F8FAFC' }} />
    </div>
    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', border: `1px solid ${C.border}`, borderRadius: 10, background: '#F8FAFC', color: C.textSub, fontSize: 13, cursor: 'pointer' }}>
      <Filter size={14} /> Filtri
    </button>
    {onNew && (
      <button onClick={onNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: 'none', borderRadius: 10, background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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

const RowActions = () => (
  <div style={{ display: 'flex', gap: 6 }}>
    <button style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }} title="Visualizza"><Eye size={13} style={{ color: C.textSub }} /></button>
    <button style={{ padding: '5px 8px', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer' }} title="Modifica"><Edit2 size={13} style={{ color: C.accent }} /></button>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// SEZIONI
// ══════════════════════════════════════════════════════════════════════════════

const SectionDashboard = () => (
  <div>
    <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
      <KPICard label="Fatturato Mese"  value="€ 48.250" trend={+12}  color={C.success} icon={TrendingUp}    />
      <KPICard label="Costi Mese"      value="€ 21.400" trend={-3}   color={C.danger}  icon={TrendingDown}  />
      <KPICard label="Utile Lordo"     value="€ 26.550" trend={+8}   color={C.accent}  icon={Target}        />
      <KPICard label="Saldo Banche"    value="€ 75.320"              color={C.gold}    icon={Landmark}      />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
      {/* Grafici mock */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Andamento Incassi e Uscite</div>
          <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>■ Entrate</span>
            <span style={{ color: C.gold, fontWeight: 600 }}>■ Uscite</span>
          </div>
        </div>
        {/* Grafico barre semplice */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {[['Ott', 60, 40], ['Nov', 80, 50], ['Dic', 70, 55], ['Gen', 90, 60], ['Feb', 85, 45], ['Mar', 95, 50], ['Apr', 110, 65], ['Mag', 100, 70], ['Giu', 88, 48], ['Lug', 92, 52], ['Ago', 105, 60], ['Set', 115, 58]].map(([m, e, u]) => (
            <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 100 }}>
                <div style={{ flex: 1, height: `${e}%`, background: `${C.accent}88`, borderRadius: '3px 3px 0 0' }} />
                <div style={{ flex: 1, height: `${u}%`, background: `${C.gold}88`, borderRadius: '3px 3px 0 0' }} />
              </div>
              <div style={{ fontSize: 9, color: C.muted }}>{m}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pannello cliente example */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Petele Cliente</div>
        <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>Rossi Srl</div>
          <div style={{ fontSize: 12, color: C.textSub }}>P.IVA: 02764000730956</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>📍 Viterbo Recines So, 2326 – 2323 Vitalia...</div>
          <div style={{ fontSize: 12, color: C.textSub }}>📞 Dta: 394-589 N222</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {['Dati Generali', 'Documenti', 'Storico'].map(t => (
            <button key={t} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: t === 'Dati Generali' ? C.accent : '#fff', color: t === 'Dati Generali' ? '#fff' : C.textSub }}>{t}</button>
          ))}
        </div>
        {[['Dati Generali', ChevronRight], ['Documenti', ChevronRight], ['Scadenze', ChevronRight]].map(([l, Icon]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>• {l}</div>
            <Icon size={14} style={{ color: C.muted }} />
          </div>
        ))}
      </div>
    </div>

    {/* Bottom row */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      {[
        { title: 'Incassi da Ricevere', items: [['T20', '€ 14.250'], ['2000', '€ 35.500'], ['B500', '€ 71.300']], color: C.success },
        { title: 'Pagamenti in Scadenza', items: [['Inviata', '€ 10.400'], ['Dan-Dr-4000', '€ 31.000'], ['Dat 244 250', '€ 11.200']], color: C.warning },
        { title: 'Fatture Scadute', items: [['Inviata', 'IVA Merce'], ['Scadute', 'Firme'], ['Scadute', 'BL.GOBS –']], color: C.danger },
      ].map(({ title, items, color }) => (
        <div key={title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, borderBottom: `2px solid ${color}`, paddingBottom: 8 }}>{title}</div>
          {items.map(([a, b], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span style={{ color: C.textSub }}>📄 {a}</span>
              <span style={{ fontWeight: 700, color }}>{b}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const SectionAnagrafiche = () => {
  const [subTab, setSubTab] = useState('clienti');
  const TABS = [['clienti','Clienti'],['fornitori','Fornitori'],['pagamenti','Metodi Pagamento'],['banche','Banche/Casse'],['iva','Aliquote IVA'],['categorie','Categorie'],['listini','Listini']];
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>
            {l}
          </button>
        ))}
      </div>
      <SearchBar placeholder="Cerca cliente per nome, P.IVA..." newLabel="Nuovo Cliente" />
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <Table
          headers={['Nome', 'Partita IVA', 'Contatto', 'Scad. Pagamento', 'Stato', 'Azioni']}
          rows={MOCK_CLIENTI.map(c => (
            <tr key={c.id}>
              <Td><span style={{ fontWeight: 700 }}>{c.nome}</span></Td>
              <Td mono>{c.piva}</Td>
              <Td>{c.contatto}</Td>
              <Td mono>{c.scadenza}</Td>
              <Td><StatoBadge stato={c.stato} /></Td>
              <Td><RowActions /></Td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
};

const SectionVendite = () => {
  const [subTab, setSubTab] = useState('fatture');
  const TABS = [['preventivi','Preventivi'],['ordini','Ordini Clienti'],['ddt','DDT'],['fatture','Fatture Emesse'],['note','Note di Credito'],['corrispettivi','Corrispettivi']];
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {['Periodo', 'Cliente', 'Stato', 'Importo', 'Punto Vendita'].map(f => (
          <button key={f} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#F8FAFC', fontSize: 12, color: C.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Filter size={11} /> {f}
          </button>
        ))}
        <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={12} /> Nuova Fattura
        </button>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <Table
          headers={['Numero', 'Data', 'Cliente', 'Totale', 'Stato', 'Pagamento', 'Azioni']}
          rows={MOCK_FATTURE.map(f => (
            <tr key={f.id}>
              <Td mono>{f.id}</Td>
              <Td>{f.data}</Td>
              <Td><span style={{ fontWeight: 600 }}>{f.cliente}</span></Td>
              <Td><span style={{ fontWeight: 700, color: C.success }}>€ {f.totale.toLocaleString('it-IT')}</span></Td>
              <Td><StatoBadge stato={f.stato} /></Td>
              <Td>{f.pagamento}</Td>
              <Td>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 11 }} title="PDF">PDF</button>
                  <RowActions />
                </div>
              </Td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
};

const SectionAcquisti = () => {
  const [subTab, setSubTab] = useState('fatture');
  const TABS = [['ordini','Ordini Fornitori'],['fatture','Fatture Ricevute'],['note','Note Credito Forn.'],['costi','Costi Ricorrenti']];
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {TABS.map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>
      <SearchBar placeholder="Cerca per fornitore o numero..." newLabel="Nuova Fattura" />
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
        <Table
          headers={['Numero', 'Data', 'Fornitore', 'Importo', 'Scadenza', 'Categoria', 'Stato', 'Azioni']}
          rows={[
            ['10/11/2023', 'Maoco Plexit',  '€ 35.000', '10/12/2023', 'Forniture',   'DA Pagare'],
            ['11/11/2023', 'Maoco Plexit',  '€ 35.500', '10/12/2023', 'Servizi',     'DA Pagare'],
            ['02/11/2023', 'Maoco Plexit',  '€ 330.000','10/12/2023', 'Merce',       'Pagato'],
            ['10/11/2023', 'Dreco-Cross',   '€ 335.000','10/12/2023', 'Attrezzature','DA Pagare'],
          ].map((r, i) => (
            <tr key={i}>
              <Td mono>FAT-2023-{String(i+1).padStart(3,'0')}</Td>
              <Td>{r[0]}</Td>
              <Td><span style={{ fontWeight: 600 }}>{r[1]}</span></Td>
              <Td><span style={{ fontWeight: 700, color: C.danger }}>{r[2]}</span></Td>
              <Td>{r[3]}</Td>
              <Td>{r[4]}</Td>
              <Td><StatoBadge stato={r[5]} /></Td>
              <Td><RowActions /></Td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
};

const SectionTesoreria = () => {
  const [subTab, setSubTab] = useState('movimenti');
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Saldo Totale"      value="€ 82.450" color={C.success} icon={Wallet}      />
        <KPICard label="Saldo Banca"       value="€ 58.300" color={C.accent}  icon={Landmark}    />
        <KPICard label="Saldo Cassa"       value="€ 5.120"  color={C.gold}    icon={DollarSign}  />
        <KPICard label="Flusso Previsto 7gg" value="€ 4.900" color={C.warning} icon={TrendingUp} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['movimenti','Prima Nota'],['bancari','Movimenti Bancari'],['cassa','Cassa'],['carte','Carte'],['riconciliazione','Riconciliazione'],['flussi','Flussi Previsionali']].map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Movimenti</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Download size={12} /> Esporta</button>
            <button style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Plus size={12} /> Nuovo</button>
          </div>
        </div>
        <Table
          headers={['Data', 'Descrizione', 'Conto', 'Entrata', 'Uscita', 'Stato']}
          rows={MOCK_MOVIMENTI.map((m, i) => (
            <tr key={i}>
              <Td mono>{m.data}</Td>
              <Td><span style={{ fontWeight: 600 }}>{m.desc}</span></Td>
              <Td>{m.conto}</Td>
              <Td><span style={{ color: C.success, fontWeight: 700 }}>{m.entrata > 0 ? `€ ${m.entrata.toLocaleString('it-IT')}` : '—'}</span></Td>
              <Td><span style={{ color: C.danger, fontWeight: 700 }}>{m.uscita > 0 ? `€ ${m.uscita.toLocaleString('it-IT')}` : '—'}</span></Td>
              <Td><StatoBadge stato={m.stato} /></Td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
};

const SectionScadenziario = () => {
  const [subTab, setSubTab] = useState('incassi');
  const [filter, setFilter] = useState('30giorni');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['incassi','Incassi'],['pagamenti','Pagamenti'],['insoluti','Insoluti'],['solleciti','Solleciti']].map(([id, l]) => (
          <button key={id} onClick={() => setSubTab(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subTab === id ? C.accent : '#F1F5F9', color: subTab === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['oggi','Oggi'],['7giorni','7 Giorni'],['30giorni','30 Giorni'],['scaduti','Scaduti']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${filter === v ? C.accent : C.border}`, background: filter === v ? `${C.accent}15` : '#F8FAFC', color: filter === v ? C.accent : C.textSub, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
        ))}
        <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: C.success, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <CheckCircle2 size={12} /> Registra Incasso
        </button>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <Table
          headers={['Scadenza', 'Soggetto', 'Documento', 'Totale', 'Pagato', 'Residuo', 'Stato', 'Azioni']}
          rows={MOCK_SCADENZE.map((s, i) => (
            <tr key={i}>
              <Td mono>{s.scadenza}</Td>
              <Td><span style={{ fontWeight: 600 }}>{s.soggetto}</span></Td>
              <Td mono>{s.documento}</Td>
              <Td><span style={{ fontWeight: 700 }}>€ {s.totale.toLocaleString('it-IT')}</span></Td>
              <Td><span style={{ color: C.success }}>{s.pagato > 0 ? `€ ${s.pagato.toLocaleString('it-IT')}` : '€ 0'}</span></Td>
              <Td><span style={{ color: C.danger, fontWeight: 700 }}>€ {s.residuo.toLocaleString('it-IT')}</span></Td>
              <Td><StatoBadge stato={s.stato} /></Td>
              <Td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ padding: '4px 7px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }} title="Sollecito"><Send size={11} /></button>
                  <RowActions />
                </div>
              </Td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
};

const SectionContabilita = () => (
  <div>
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <select style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: '#F8FAFC', cursor: 'pointer' }}>
        <option>Ottobre 2024</option><option>Settembre 2024</option><option>Agosto 2024</option>
      </select>
      {['Causale', 'Conto', 'Filtro'].map(f => (
        <button key={f} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#F8FAFC', fontSize: 12, color: C.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Filter size={11} /> {f}</button>
      ))}
    </div>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <Table
        headers={['Data', 'Protocollo', 'Causale', 'Conto Dare', 'Conto Avere', 'Importo', 'Rif. Documento']}
        rows={[
          ['01/10/2024', 'REG-001', 'Vendita merce',    'Clienti',       'Ricavi vendite',  '€ 12.500', 'FAT-001'],
          ['02/10/2024', 'REG-002', 'Acquisto merce',   'Merci c/acquisti','Fornitori',     '€ 8.200',  'FAT-ACQ-001'],
          ['05/10/2024', 'REG-003', 'Pagamento forn.',  'Fornitori',     'Banca c/c',       '€ 8.200',  'BNIM-001'],
          ['10/10/2024', 'REG-004', 'Incasso cassa',    'Cassa',         'Clienti',         '€ 5.300',  'INC-001'],
        ].map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => <Td key={j} mono={j === 0 || j === 1}><span style={j === 5 ? { fontWeight: 700, color: C.accent } : {}}>{v}</span></Td>)}
          </tr>
        ))}
      />
    </div>
  </div>
);

const SectionIva = () => (
  <div>
    <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
      <KPICard label="IVA a Debito"    value="€ 9.680"  color={C.danger}   icon={ArrowUpRight}   />
      <KPICard label="IVA a Credito"   value="€ 2.940"  color={C.success}  icon={ArrowDownRight} />
      <KPICard label="Saldo Periodo"   value="€ 6.740"  color={C.accent}   icon={TrendingUp}     />
      <KPICard label="Prossima Liquid." value="16/01"    color={C.warning}  icon={Calendar}       />
    </div>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
        {['Registro Vendite','Registro Acquisti','Liquidazione'].map(t => (
          <button key={t} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}>{t}</button>
        ))}
        <button style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Download size={12} /> Esporta
        </button>
      </div>
      <Table
        headers={['Periodo', 'Imponibile', 'IVA', 'Totale', 'Stato Liquidazione']}
        rows={[
          ['Q3 2024', '€ 48.250', '€ 9.650', '€ 57.900', 'pagato'],
          ['Q2 2024', '€ 42.100', '€ 8.420', '€ 50.520', 'pagato'],
          ['Q1 2024', '€ 38.600', '€ 7.720', '€ 46.320', 'pagato'],
        ].map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => <Td key={j}><span style={j === 4 ? {} : j > 0 ? { fontWeight: 600 } : {}}>{j === 4 ? <StatoBadge stato={v} /> : v}</span></Td>)}
          </tr>
        ))}
      />
    </div>
  </div>
);

const SectionDocumenti = () => (
  <div>
    <SearchBar placeholder="Cerca per nome, tipo, cliente..." newLabel="Carica Documento" />
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <Table
        headers={['Nome File', 'Tipo', 'Soggetto', 'Documento Collegato', 'Data Caric.', 'Tag', 'Azioni']}
        rows={[
          ['Contratto_RossiSrl.pdf', 'PDF', 'Rossi Srl', 'FAT-2024-001', '10/11/2024', 'contratto'],
          ['Fattura_001.xml', 'XML', 'Rey Gi', 'FAT-2024-002', '11/11/2024', 'fattura'],
          ['Bolletta_Energia.pdf', 'PDF', 'Enel', 'COST-2024-045', '12/11/2024', 'costi'],
          ['Preventivo_A.pdf', 'PDF', 'Senoni Srl', 'PREV-2024-003', '15/11/2024', 'preventivo'],
        ].map((r, i) => (
          <tr key={i}>
            <Td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={14} style={{ color: C.accent }} /><span style={{ fontWeight: 600 }}>{r[0]}</span></div></Td>
            <Td><span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{r[1]}</span></Td>
            <Td>{r[2]}</Td>
            <Td mono>{r[3]}</Td>
            <Td mono>{r[4]}</Td>
            <Td><span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>{r[5]}</span></Td>
            <Td><RowActions /></Td>
          </tr>
        ))}
      />
    </div>
  </div>
);

const SectionReport = () => {
  const [subReport, setSubReport] = useState('fatturato');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[['fatturato','Fatturato'],['costi','Costi'],['margini','Margini'],['cashflow','Cash Flow'],['clienti','Clienti'],['iva','IVA'],['performance','Performance Sede']].map(([id, l]) => (
          <button key={id} onClick={() => setSubReport(id)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subReport === id ? C.accent : '#F1F5F9', color: subReport === id ? '#fff' : C.textSub }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard label="Fatturato Totale" value="€ 145.200" trend={+15}  color={C.success}  icon={TrendingUp}  />
        <KPICard label="Costi Totali"     value="€ 64.800"  trend={+4}   color={C.danger}   icon={TrendingDown}/>
        <KPICard label="Margine"          value="55,4%"     trend={+6}   color={C.accent}   icon={Target}      />
        <KPICard label="Clienti Attivi"   value="248"       trend={+22}  color={C.gold}     icon={Users}       />
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700 }}>Andamento Mensile</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Download size={12} /> CSV</button>
            <button style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}><Download size={12} /> PDF</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {[70, 85, 60, 95, 80, 100, 90, 110, 95, 120, 105, 130].map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${v}%`, background: `linear-gradient(to top, ${C.accent}, ${C.accent}55)`, borderRadius: '4px 4px 0 0' }} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PAGINA PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPanelPage() {
  const [active, setActive] = useState('dashboard');

  const content = useMemo(() => {
    switch (active) {
      case 'dashboard':    return <SectionDashboard />;
      case 'anagrafiche':  return <SectionAnagrafiche />;
      case 'vendite':      return <SectionVendite />;
      case 'acquisti':     return <SectionAcquisti />;
      case 'tesoreria':    return <SectionTesoreria />;
      case 'scadenziario': return <SectionScadenziario />;
      case 'contabilita':  return <SectionContabilita />;
      case 'iva':          return <SectionIva />;
      case 'documenti':    return <SectionDocumenti />;
      case 'report':       return <SectionReport />;
      default:             return null;
    }
  }, [active]);

  const current = SECTIONS.find(s => s.id === active);

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)', background: C.bg, margin: '-24px -32px -40px', overflow: 'hidden' }}>

      {/* ── Inner Sidebar ── */}
      <div style={{ width: 220, background: C.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '20px 0' }}>
        <div style={{ padding: '0 16px 20px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Amministrazione</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 2, textAlign: 'left',
                  background: isActive ? C.accent : 'transparent',
                  color: isActive ? '#fff' : '#94A3B8',
                  fontWeight: isActive ? 700 : 500, fontSize: 13,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1E293B'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {label}
              </button>
            );
          })}
        </nav>
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
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
              <RefreshCw size={13} /> Aggiorna
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Download size={13} /> Esporta
            </button>
          </div>
        </div>

        {content}
      </div>
    </div>
  );
}
