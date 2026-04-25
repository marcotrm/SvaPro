import React, { useState, useEffect, useCallback } from 'react';
import { Truck, ShoppingBag, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Play, Package, Building2, Zap, Settings } from 'lucide-react';
import { smartRestocking } from '../api.jsx';

const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

/* ── Tab 1: Fabbisogno Rete (DDT Negozi) ──────────────────────────────── */
function NetworkTab() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [expanded, setExpanded] = useState({});
  const [approving, setApproving] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await smartRestocking.networkNeeds();
      setData(res.data?.data || null);
    } catch (e) { setError(e?.message || 'Errore caricamento'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approveDdt = async (transferId, storeId) => {
    setApproving(p => ({ ...p, [storeId]: true }));
    try {
      await smartRestocking.approveDdt(transferId);
      await load();
    } catch (e) { alert('Errore approvazione: ' + e?.message); }
    finally { setApproving(p => ({ ...p, [storeId]: false })); }
  };

  if (loading) return <div style={styles.center}>Analisi fabbisogno rete in corso…</div>;
  if (error)   return <div style={styles.errBox}><AlertTriangle size={15}/> {error}</div>;
  if (!data?.stores?.length) return (
    <div style={styles.emptyBox}>
      <CheckCircle size={40} color="#10b981" style={{ marginBottom: 12 }}/>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#065f46' }}>Tutti i negozi sono sopra soglia</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Nessun trasferimento necessario al momento</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {data.central_warehouse && (
        <div style={{ padding: '10px 16px', background: 'rgba(99,102,241,0.07)', borderRadius: 10, fontSize: 12, color: '#4338ca', fontWeight: 700, border: '1px solid rgba(99,102,241,0.2)' }}>
          ?? Deposito sorgente: {data.central_warehouse.name}
        </div>
      )}
      {data.stores.map(store => {
        const isOpen = expanded[store.store_id];
        const hasWarn = store.has_warnings;
        return (
          <div key={store.store_id} style={{ background: 'var(--color-surface)', borderRadius: 16, border: `1.5px solid ${hasWarn ? '#fcd34d' : 'rgba(99,102,241,0.15)'}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: 14 }} onClick={() => setExpanded(p => ({ ...p, [store.store_id]: !isOpen }))}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: hasWarn ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={18} color={hasWarn ? '#d97706' : '#6366f1'}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>{store.store_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  {store.total_lines} righe mancanti{hasWarn ? ' · ?? scorte deposito insufficienti' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {store.draft_transfer_id ? (
                  <button onClick={e => { e.stopPropagation(); approveDdt(store.draft_transfer_id, store.store_id); }} disabled={approving[store.store_id]}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <Play size={12}/> {approving[store.store_id] ? 'Approvando…' : 'Approva e Manda in Picking'}
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Nessuna bozza DDT</span>
                )}
                {isOpen ? <ChevronUp size={16} color="#94a3b8"/> : <ChevronDown size={16} color="#94a3b8"/>}
              </div>
            </div>
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg)' }}>
                      {['Prodotto','Disponibile','Soglia','Da trasferire','Deposito','Note'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: 11, borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {store.lines.map((line, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', background: line.warning ? 'rgba(253,224,71,0.06)' : 'transparent' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--color-text)' }}>{line.product_name}<br/><span style={{ fontSize: 11, color: '#94a3b8' }}>{line.sku}</span></td>
                        <td style={{ padding: '9px 14px', color: '#ef4444', fontWeight: 700 }}>{line.available} pz</td>
                        <td style={{ padding: '9px 14px', color: '#64748b' }}>{line.scorta_minima} pz</td>
                        <td style={{ padding: '9px 14px', color: '#6366f1', fontWeight: 800 }}>{line.needed_qty} pz</td>
                        <td style={{ padding: '9px 14px', color: line.warning ? '#d97706' : '#10b981', fontWeight: 700 }}>{line.central_available} pz</td>
                        <td style={{ padding: '9px 14px', fontSize: 11, color: '#d97706' }}>{line.warning || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab 2: Fabbisogno Deposito (PO per Fornitore) ───────────────────── */
function DepotTab() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [expanded, setExpanded] = useState({});
  const [editQty, setEditQty]   = useState({});
  const [selectedSuppliers, setSelectedSuppliers] = useState({});
  const [generating, setGen]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await smartRestocking.depotNeeds();
      const d = res.data?.data || null;
      setData(d);
      
      if (d?.brands) {
        const initQty = {};
        const initSuppliers = {};
        d.brands.forEach(b => {
          b.lines.forEach(l => {
            initQty[`${b.brand_id}_${l.product_variant_id}`] = l.needed_qty;
          });
          // Seleziona il fornitore primario se c'�, altrimenti il primo
          if (b.mapped_suppliers?.length > 0) {
             const prim = b.mapped_suppliers.find(s => s.is_primario);
             initSuppliers[b.brand_id] = prim ? prim.supplier_id : b.mapped_suppliers[0].supplier_id;
          }
        });
        setEditQty(initQty);
        setSelectedSuppliers(initSuppliers);
      }
    } catch (e) { setError(e?.message || 'Errore caricamento'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateBulkPo = async () => {
    setGen(true);
    try {
      // Raggruppa le righe per supplier_id selezionato
      const bySup = {};
      data.brands.forEach(b => {
        const supId = selectedSuppliers[b.brand_id];
        if (!supId) return; // Ignora se non ha selezionato un fornitore
        
        if (!bySup[supId]) bySup[supId] = [];
        
        b.lines.forEach(l => {
           bySup[supId].push({
             product_variant_id: l.product_variant_id,
             qty: editQty[`${b.brand_id}_${l.product_variant_id}`] ?? l.needed_qty,
             unit_cost: l.cost_price,
           });
        });
      });

      const supIds = Object.keys(bySup);
      if (supIds.length === 0) {
        alert('Nessun fornitore selezionato per i marchi da riordinare.');
        setGen(false);
        return;
      }

      // Esegui sequenzialmente le chiamate API
      for (const supId of supIds) {
         await smartRestocking.generatePo({ supplier_id: parseInt(supId), lines: bySup[supId] });
      }

      alert(`Generati ${supIds.length} ordini d'acquisto accorpati!`);
      await load();
    } catch (e) { alert('Errore generazione PO: ' + e?.message); }
    finally { setGen(false); }
  };

  if (loading) return <div style={styles.center}>Analisi fabbisogno deposito in corso…</div>;
  if (error)   return <div style={styles.errBox}><AlertTriangle size={15}/> {error}</div>;
  if (!data?.brands?.length) return (
    <div style={styles.emptyBox}>
      <CheckCircle size={40} color="#10b981" style={{ marginBottom: 12 }}/>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#065f46' }}>Il deposito ??ben rifornito</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Nessun ordine fornitore necessario al momento</div>
    </div>
  );

  const totalValueOverall = data.brands.reduce((sum, b) => {
    return sum + b.lines.reduce((s, l) => {
      return s + (editQty[`${b.brand_id}_${l.product_variant_id}`] ?? l.needed_qty) * l.cost_price;
    }, 0);
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {data.warehouse && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(16,185,129,0.07)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ fontSize: 12, color: '#065f46', fontWeight: 700 }}>
            🏭 Deposito analizzato: {data.warehouse.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>Totale Bozza: {fmt(totalValueOverall)}</span>
            <button onClick={generateBulkPo} disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: generating ? '#94a3b8' : '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
              <Package size={14}/> {generating ? 'Generazione in corso…' : 'Genera Ordini Accorpati'}
            </button>
          </div>
        </div>
      )}
      {data.brands.map(brand => {
        const isOpen = expanded[brand.brand_id ?? 'unbranded'];
        const totalEdit = brand.lines.reduce((s, l) => {
          const q = editQty[`${brand.brand_id}_${l.product_variant_id}`] ?? l.needed_qty;
          return s + q * l.cost_price;
        }, 0);
        const mapped = brand.mapped_suppliers || [];
        const currentSup = selectedSuppliers[brand.brand_id];

        return (
          <div key={brand.brand_id ?? 'unbranded'} style={{ background: 'var(--color-surface)', borderRadius: 18, border: `1.5px solid ${currentSup ? 'rgba(99,102,241,0.2)' : '#fca5a5'}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', gap: 14 }} onClick={() => setExpanded(p => ({ ...p, [brand.brand_id ?? 'unbranded']: !isOpen }))}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: currentSup ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShoppingBag size={20} color={currentSup ? '#6366f1' : '#ef4444'}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{brand.brand_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  {brand.lines.length} referenze in riordino · Valore stimato <strong style={{ color: '#6366f1' }}>{fmt(totalEdit)}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                   <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Fornitore Scelto:</span>
                   <select 
                     value={currentSup || ''} 
                     onChange={e => setSelectedSuppliers(p => ({ ...p, [brand.brand_id]: e.target.value ? parseInt(e.target.value) : null }))}
                     style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12, fontWeight: 700, color: 'var(--color-text)', background: 'var(--color-bg)', outline: 'none' }}
                   >
                     <option value="">-- Seleziona Fornitore --</option>
                     {mapped.map(s => (
                       <option key={s.supplier_id} value={s.supplier_id}>
                         {s.is_primario ? '⭐ ' : ''}{s.supplier_name}
                       </option>
                     ))}
                   </select>
                </div>
                <div onClick={() => setExpanded(p => ({ ...p, [brand.brand_id ?? 'unbranded']: !isOpen }))} style={{ cursor: 'pointer', padding: 4 }}>
                   {isOpen ? <ChevronUp size={16} color="#94a3b8"/> : <ChevronDown size={16} color="#94a3b8"/>}
                </div>
              </div>
            </div>
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg)' }}>
                      {['Prodotto','Disp.','Soglia','Q.tà Ordine','Costo/u','Totale riga'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: 11, borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {brand.lines.map((line, i) => {
                      const qKey = `${brand.brand_id}_${line.product_variant_id}`;
                      const qty  = editQty[qKey] ?? line.needed_qty;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 600 }}>{line.product_name}<br/><span style={{ fontSize: 11, color: '#94a3b8' }}>{line.sku}</span></td>
                          <td style={{ padding: '9px 14px', color: '#ef4444', fontWeight: 700 }}>{line.available} pz</td>
                          <td style={{ padding: '9px 14px', color: '#64748b' }}>{line.scorta_minima} pz</td>
                          <td style={{ padding: '9px 14px' }}>
                            <input type="number" min="0" value={qty}
                              onChange={e => setEditQty(p => ({ ...p, [qKey]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              style={{ width: 72, padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--color-border)', fontSize: 13, fontWeight: 700, color: '#6366f1', textAlign: 'center', background: 'var(--color-bg)' }}/>
                          </td>
                          <td style={{ padding: '9px 14px', color: '#64748b' }}>{fmt(line.cost_price)}</td>
                          <td style={{ padding: '9px 14px', fontWeight: 700, color: '#10b981' }}>{fmt(qty * line.cost_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Pagina Principale ─────────────────────────────────────────────────── */
export default function SmartRestockingPage() {
  const [tab, setTab]           = useState('network');
  const [lastRun, setLastRun]   = useState(null);
  const [calculating, setCalc]  = useState(false);
  const [networkKey, setNK]     = useState(0);
  const [depotKey, setDK]       = useState(0);

  useEffect(() => {
    smartRestocking.status().then(r => setLastRun(r.data?.last_run || null)).catch(() => {});
  }, []);

  const forceCalculate = async () => {
    setCalc(true);
    try {
      const res = await smartRestocking.calculate();
      setLastRun(res.data?.data || null);
      setNK(k => k + 1);
      setDK(k => k + 1);
    } catch (e) { alert('Errore calcolo: ' + e?.message); }
    finally { setCalc(false); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 0 48px' }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)', borderRadius: 24, padding: '28px 32px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={28} color="#f59e0b"/>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: 0 }}>Controllo Riordini</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 0' }}>
              Cabina di Regia Acquisti · Distribuzione automatica verso negozi e rifornimento deposito
            </p>
            {lastRun && (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '6px 0 0' }}>
                Ultimo calcolo: {new Date(lastRun.calculated_at).toLocaleString('it-IT')} · {lastRun.ddt_drafts_created} DDT · {lastRun.po_drafts_created} PO generati
              </p>
            )}
          </div>
          <button onClick={forceCalculate} disabled={calculating}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: calculating ? '#475569' : '#f59e0b', color: calculating ? '#cbd5e1' : '#1c1917', border: 'none', borderRadius: 12, padding: '11px 20px', cursor: calculating ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, transition: 'all 0.15s' }}>
            <RefreshCw size={15} style={{ animation: calculating ? 'spin 1s linear infinite' : 'none' }}/>
            {calculating ? 'Calcolo in corso…' : 'Forza Calcolo Fabbisogno'}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--color-surface)', borderRadius: 14, padding: 4, border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {[
          { key: 'network', icon: Truck,      label: 'Fabbisogno Rete',    sub: 'DDT verso negozi' },
          { key: 'depot',   icon: ShoppingBag, label: 'Fabbisogno Deposito', sub: 'Ordini a fornitori' },
          { key: 'matrix',  icon: Settings,    label: 'Matrice Marchi',     sub: 'Brand → Fornitore' },
        ].map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: active ? '#0f172a' : 'transparent', color: active ? '#fff' : 'var(--color-text-secondary)', transition: 'all 0.15s' }}>
              <Icon size={16}/>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{t.label}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{t.sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'network' && <NetworkTab key={networkKey}/>}
      {tab === 'depot'   && <DepotTab   key={depotKey}/>}
      {tab === 'matrix'  && <BrandMatrixTab/>}
    </div>
  );
}

/* ── Tab 3: Matrice Marchi → Fornitori ───────────────────────────────── */
function BrandMatrixTab() {
  const [matrix, setMatrix]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState({});

  useEffect(() => {
    Promise.all([
      smartRestocking.brandMatrix(),
      import('../api.jsx').then(m => m.suppliers.getAll()),
    ]).then(([bm, sp]) => {
      setMatrix(bm.data?.data || []);
      setSuppliers((sp.data?.data || sp.data || []).map ? (sp.data?.data || sp.data || []) : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const setPrimary = async (brandId, supplierId) => {
    setSaving(p => ({ ...p, [`${brandId}_${supplierId}`]: true }));
    try {
      await smartRestocking.upsertBrand({ brand_id: brandId, supplier_id: supplierId, is_primario: true });
      const res = await smartRestocking.brandMatrix();
      setMatrix(res.data?.data || []);
    } catch (e) { alert('Errore: ' + e?.message); }
    finally { setSaving(p => ({ ...p, [`${brandId}_${supplierId}`]: false })); }
  };

  if (loading) return <div style={styles.center}>Caricamento matrice…</div>;

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Configura quale fornitore è <strong>primario</strong> per ciascun marchio. Il motore di calcolo userà questa matrice per generare gli ordini automatici.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {matrix.map(brand => (
          <div key={brand.brand_id} style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '16px 18px', border: '1.5px solid var(--color-border)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={15} color="#6366f1"/> {brand.brand_name}
            </div>
            {brand.suppliers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {brand.suppliers.map(s => (
                  <div key={s.supplier_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: s.is_primario ? 'rgba(16,185,129,0.08)' : 'var(--color-bg)', border: `1px solid ${s.is_primario ? '#6ee7b7' : 'var(--color-border)'}` }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: s.is_primario ? 700 : 500, color: s.is_primario ? '#065f46' : 'var(--color-text)' }}>
                      {s.is_primario && '⭐ '}{s.supplier_name}
                    </div>
                    {!s.is_primario && (
                      <button onClick={() => setPrimary(brand.brand_id, s.supplier_id)} disabled={saving[`${brand.brand_id}_${s.supplier_id}`]}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #6366f1', color: '#6366f1', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>
                        Imposta primario
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠️ Nessun fornitore mappato</div>
            )}
            <select onChange={async e => {
              if (!e.target.value) return;
              await smartRestocking.upsertBrand({ brand_id: brand.brand_id, supplier_id: parseInt(e.target.value), is_primario: false });
              const res = await smartRestocking.brandMatrix();
              setMatrix(res.data?.data || []);
              e.target.value = '';
            }} style={{ marginTop: 10, width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px dashed var(--color-border)', fontSize: 12, color: 'var(--color-text-secondary)', background: 'var(--color-bg)', cursor: 'pointer' }}>
              <option value="">+ Aggiungi fornitore…</option>
              {suppliers.filter(s => !brand.suppliers.find(bs => bs.supplier_id === s.id)).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  center:   { padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14 },
  errBox:   { padding: '14px 18px', background: '#fef2f2', borderRadius: 10, color: '#dc2626', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' },
  emptyBox: { padding: 48, textAlign: 'center', background: 'var(--color-surface)', borderRadius: 20, border: '1.5px solid var(--color-border)' },
};
