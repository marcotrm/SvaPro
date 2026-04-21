import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { inventory, stores as storesApi } from '../api.jsx';
import InventoryMovementModal from '../components/InventoryMovementModal.jsx';
import ProductInventoryModal from '../components/ProductInventoryModal.jsx';
import { Search, Plus, AlertTriangle, MapPin, Filter, Store, ChevronDown, ChevronRight } from 'lucide-react';

export default function InventoryPage() {
  const { user, selectedStoreId, selectedStore } = useOutletContext();
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterOutStock, setFilterOutStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('stock');
  const [allStoresStock, setAllStoresStock] = useState([]);
  const [storesList, setStoresList] = useState([]);
  const [expandedStores, setExpandedStores] = useState({});
  const [byStoreSearch, setByStoreSearch] = useState('');

  // Cross-store state
  const [crossStoreSearch, setCrossStoreSearch] = useState('');
  const [crossStoreData, setCrossStoreData] = useState([]);
  const [crossStoreLoading, setCrossStoreLoading] = useState(false);
  const crossStoreDebounce = React.useRef(null);

  const location = useLocation();

  // Attiva filtro stock basso se arrivi dalla Dashboard con ?filter=low
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'low') setFilterLowStock(true);
  }, [location.search]);

  useEffect(() => { fetchData(); }, [selectedStoreId]);

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const sp = selectedStoreId ? { store_id: selectedStoreId } : {};
      const [stockRes, movRes] = await Promise.all([
        inventory.getStock({ ...sp, limit: 200 }),
        inventory.getMovements({ ...sp, limit: 100 }),
      ]);
      setStock(stockRes.data?.data || []);
      setMovements(movRes.data?.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento');
    } finally { setLoading(false); }
  };

  const userRoles = user?.roles || [];
  const canAdjust = userRoles.includes('superadmin') || userRoles.includes('admin_cliente');
  const isSuperAdmin = userRoles.includes('superadmin');

  // Carica giacenze per tutti i negozi (solo superadmin)
  useEffect(() => {
    if (activeTab !== 'by_store' || !isSuperAdmin) return;
    const loadAllStock = async () => {
      try {
        const [sRes, stRes] = await Promise.all([
          storesApi.getStores(),
          inventory.getStock({ limit: 5000 }),
        ]);
        setStoresList(sRes.data?.data || []);
        setAllStoresStock(stRes.data?.data || []);
      } catch {}
    };
    loadAllStock();
  }, [activeTab, isSuperAdmin]);

  // Cross-store search with debounce
  const fetchCrossStore = React.useCallback(async (q) => {
    try {
      setCrossStoreLoading(true);
      const res = await inventory.getCrossStore(q ? { q } : {});
      setCrossStoreData(res.data?.data || []);
    } catch {
      setCrossStoreData([]);
    } finally { setCrossStoreLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab !== 'cross_store') return;
    clearTimeout(crossStoreDebounce.current);
    crossStoreDebounce.current = setTimeout(() => fetchCrossStore(crossStoreSearch), 500);
  }, [activeTab, crossStoreSearch, fetchCrossStore]);


  const lowCount = stock.filter(i => i.on_hand < (i.reorder_point || 5)).length;
  const outCount = stock.filter(i => i.on_hand <= 0).length;

  const filtered = stock.filter(i => {
    if (filterOutStock && i.on_hand > 0) return false;
    if (filterLowStock && i.on_hand >= (i.reorder_point || 5)) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return i.product_name?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s);
    }
    return true;
  });

  const fmt = (v) => v ? new Date(v).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  // ── Rotazione magazzino: giorni stimati all'esaurimento scorte ──────────────
  // Basata sui movimenti in uscita (qty < 0, tipo 'sale') degli ultimi 30 giorni
  const ROTATION_DAYS = 30;
  const now30 = new Date(); now30.setDate(now30.getDate() - ROTATION_DAYS);

  const calcRotation = (item) => {
    const onHand = item.available ?? item.on_hand;
    if (onHand <= 0) return 0; // già esaurito
    const outflows = movements.filter(m =>
      m.product_name === item.product_name &&
      m.qty < 0 &&
      new Date(m.occurred_at) >= now30
    );
    const totalOut = outflows.reduce((sum, m) => sum + Math.abs(m.qty), 0);
    if (totalOut <= 0) return null; // nessuna vendita nel periodo
    const dailyUsage = totalOut / ROTATION_DAYS;
    return Math.ceil(onHand / dailyUsage);
  };

  const rotationValues = filtered.map(item => calcRotation(item)).filter(v => v !== null && v > 0);
  const avgRotation = rotationValues.length > 0 ? Math.round(rotationValues.reduce((a, b) => a + b, 0) / rotationValues.length) : null;

  const printBollaScarico = () => {
    const w = window.open('', '_blank');
    const today = new Date().toLocaleDateString('it-IT');
    const storeName = selectedStore?.name || 'Tutti i Negozi';
    w.document.write(`<!DOCTYPE html><html><head>
<title>Bolla di Scarico — ${storeName} — ${today}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f5f5f7; padding: 14px 16px; border-radius: 8px; }
  .info-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin: 0 0 2px; }
  .info-block p { font-size: 14px; font-weight: 700; margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; background: #1a1a2e; color: #fff; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fafafa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
  .badge-ok { background: #d1fae5; color: #065f46; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-err { background: #fee2e2; color: #991b1b; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sign-box { border-top: 1px solid #ccc; width: 180px; text-align: center; padding-top: 6px; font-size: 11px; color: #666; }
  .totals { background: #f0f0f0; padding: 10px 14px; border-radius: 6px; font-size: 12px; margin-top: 16px; display: flex; gap: 32px; }
  .total-item { display: flex; flex-direction: column; }
  .total-item strong { font-size: 18px; font-weight: 900; }
  @media print { body { margin: 16px; } }
</style></head><body>
<h1>📦 Bolla di Scarico Merci</h1>
<div class="sub">Documento interno — Non valido ai fini fiscali</div>
<div class="info-grid">
  <div class="info-block"><h3>Negozio</h3><p>${storeName}</p></div>
  <div class="info-block"><h3>Data Emissione</h3><p>${today}</p></div>
  <div class="info-block"><h3>Totale Referenze</h3><p>${filtered.length}</p></div>
</div>
<table>
  <thead><tr><th>#</th><th>Prodotto</th><th>SKU</th><th>Magazzino</th><th>Qta Disponibile</th><th>Riservata</th><th>Pt. Riordino</th><th>Stato</th></tr></thead>
  <tbody>
    ${filtered.map((item, i) => {
      const isOut = item.on_hand <= 0;
      const isLow = !isOut && item.on_hand < (item.reorder_point || 5);
      const badge = isOut ? 'badge-err' : isLow ? 'badge-warn' : 'badge-ok';
      const label = isOut ? 'Esaurito' : isLow ? 'Basso' : 'OK';
      return `<tr>
        <td style="color:#aaa;font-size:11px">${i+1}</td>
        <td><strong>${item.product_name || ''}</strong>${item.flavor ? ' <span style="color:#888">— '+item.flavor+'</span>' : ''}</td>
        <td style="font-family:monospace;font-size:11px">${item.sku || '—'}</td>
        <td style="color:#666">${item.warehouse_name || '—'}</td>
        <td style="font-weight:700;font-size:15px">${item.available ?? item.on_hand}</td>
        <td style="color:#666">${item.reserved || 0}</td>
        <td style="color:#666">${item.reorder_point || '—'}</td>
        <td><span class="badge ${badge}">${label}</span></td>
      </tr>`;
    }).join('')}
  </tbody>
</table>
<div class="totals">
  <div class="total-item"><span>Totale Referenze</span><strong>${filtered.length}</strong></div>
  <div class="total-item"><span>⚠ Stock Basso</span><strong style="color:#d97706">${filtered.filter(i => i.on_hand < (i.reorder_point||5) && i.on_hand > 0).length}</strong></div>
  <div class="total-item"><span>🔴 Esaurito</span><strong style="color:#dc2626">${filtered.filter(i => i.on_hand <= 0).length}</strong></div>
  <div class="total-item"><span>✅ In Ordine</span><strong style="color:#16a34a">${filtered.filter(i => i.on_hand >= (i.reorder_point||5)).length}</strong></div>
</div>
<div class="footer">
  <div class="sign-box">Firma Responsabile</div>
  <div style="font-size:10px;color:#aaa">Stampato il ${new Date().toLocaleString('it-IT')}</div>
  <div class="sign-box">Firma Operatore</div>
</div>
</body></html>`);
    w.document.close(); w.print();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
    </div>
  );

  return (
    <div className="sp-animate-in">
      {/* Page header */}
      <div className="sp-page-header">
        <div>
          <h1 className="sp-page-title">Magazzino</h1>
          <p className="sp-page-subtitle">
            {stock.length} referenze{selectedStore ? ` — ${selectedStore.name}` : ''}
          </p>
        </div>
        <div className="sp-page-actions">
          {canAdjust && (
            <>
              <button className="sp-btn sp-btn-ghost" onClick={printBollaScarico} title="Stampa Bolla di Scarico">
                🖨 Bolla di Scarico
              </button>
              <button className="sp-btn sp-btn-primary" onClick={() => setShowMovementModal(true)}>
                <Plus size={16} /> Nuovo Movimento
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="sp-alert sp-alert-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={fetchData} style={{ marginLeft: 'auto' }}>Riprova</button>
        </div>
      )}

      {/* Stats */}
      <div className="sp-stats-grid">
        <div className="sp-stat-card">
          <div className="sp-stat-label">Totale Referenze</div>
          <div className="sp-stat-value">{stock.length}</div>
        </div>
        <div className="sp-stat-card" style={{ cursor:'pointer' }} onClick={() => setFilterLowStock(v => !v)}>
          <div className="sp-stat-label">Stock Basso</div>
          <div className="sp-stat-value" style={{ color: lowCount > 0 ? 'var(--color-warning)' : 'inherit' }}>{lowCount}</div>
          {filterLowStock && <div style={{ fontSize:10, color:'var(--color-warning)', marginTop:2 }}>● filtro attivo</div>}
        </div>
        <div className="sp-stat-card" style={{ cursor: 'pointer' }} onClick={() => { setFilterOutStock(v => !v); setFilterLowStock(false); }}>
          <div className="sp-stat-label">Esaurito</div>
          <div className="sp-stat-value" style={{ color: outCount > 0 ? 'var(--color-error)' : 'inherit' }}>{outCount}</div>
          {filterOutStock && <div style={{ fontSize:10, color:'var(--color-error)', marginTop:2 }}>● filtro attivo</div>}
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">Movimenti Recenti</div>
          <div className="sp-stat-value">{movements.length}</div>
        </div>
        <div className="sp-stat-card" title="Giorni medi all'esaurimento, basati sulle vendite degli ultimi 30gg">
          <div className="sp-stat-label">Rotazione Media</div>
          <div className="sp-stat-value" style={{ color: avgRotation === null ? 'var(--color-text-tertiary)' : avgRotation <= 7 ? 'var(--color-error)' : avgRotation <= 30 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {avgRotation === null ? '—' : `${avgRotation} gg`}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>est. giorni stock</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sp-tabs">
        <button className={`sp-tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>Giacenze</button>
        <button className={`sp-tab ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>Movimenti</button>

        {isSuperAdmin && (
          <button className={`sp-tab ${activeTab === 'by_store' ? 'active' : ''}`} onClick={() => setActiveTab('by_store')}>
            <Store size={13} style={{ marginRight: 5 }} />Per Negozio (Admin)
          </button>
        )}
      </div>

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <div className="sp-table-wrap">
          <div className="sp-table-toolbar">
            <div className="sp-search-box" style={{ flex: 1, maxWidth: 300 }}>
              <Search size={14} />
              <input className="sp-input" placeholder="Cerca prodotto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button 
              className={`sp-chip ${filterLowStock ? 'active' : ''}`}
              onClick={() => setFilterLowStock(v => !v)}
            >
              <AlertTriangle size={12} /> Solo stock basso
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {filtered.length} risultati
            </span>
          </div>
          <table className="sp-table">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Magazzino</th>
                <th>Ubicazione</th>
                <th>Store (locale)</th>
                <th title="Somma su tutti i magazzini del tenant — stesso dato del POS">Tot. Tenant (POS)</th>
                <th>Riservato</th>
                <th>Pt. Riordino</th>
                <th title="Giorni stimati all'esaurimento scorte (ultimi 30 gg)">Rotazione (gg)</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(item => {
                const isLow = item.on_hand < (item.reorder_point || 5);
                const isOut = item.on_hand <= 0;
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="sp-cell-primary">{item.product_name}</span>
                      {item.flavor && <span className="sp-cell-secondary" style={{ marginLeft: 6 }}>— {item.flavor}</span>}
                      <button onClick={() => setInventoryProduct({ variant_id: item.product_variant_id, id: item.product_id || item.id, name: item.product_name })} 
                              style={{ marginLeft: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: 'var(--color-accent)' }}>
                        <MapPin size={9} style={{ display: 'inline', marginRight: 4 }}/>Giacenze Locali
                      </button>
                    </td>
                    <td className="sp-cell-secondary">{item.warehouse_name}</td>
                    <td>
                      {item.location ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          <MapPin size={12} /> {item.location}
                        </span>
                      ) : <span className="sp-cell-secondary">—</span>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: isOut ? 'var(--color-error)' : isLow ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {item.available ?? item.on_hand}
                      </span>
                    </td>
                    <td>
                      {item.total_on_hand != null ? (
                        <span style={{ fontWeight: 700, fontSize: 13, color: item.total_on_hand > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                          {item.total_on_hand}
                          {item.total_on_hand > (item.available ?? item.on_hand) && (
                            <span title="Stock presente in altri magazzini" style={{ marginLeft: 5, fontSize: 10, color: '#6366f1', fontWeight: 600 }}>📦 +altri</span>
                          )}
                        </span>
                      ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                    </td>
                    <td className="sp-cell-secondary sp-font-mono">{item.reserved || 0}</td>
                    <td className="sp-cell-secondary sp-font-mono">{item.reorder_point || '—'}</td>
                    <td>
                      {(() => {
                        const rot = calcRotation(item);
                        if (rot === null) return <span className="sp-cell-secondary" title="Nessuna vendita registrata negli ultimi 30 giorni">—</span>;
                        if (rot === 0) return <span style={{ color: 'var(--color-error)', fontWeight: 700, fontSize: 13 }}>Esaurito</span>;
                        const color = rot <= 7 ? 'var(--color-error)' : rot <= 30 ? 'var(--color-warning)' : 'var(--color-success)';
                        return (
                          <span title={`A questo ritmo di vendita, le scorte si esauriranno in circa ${rot} giorni`} style={{ fontWeight: 700, color, fontSize: 13 }}>
                            {rot} gg
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      {isOut ? (
                        <span className="sp-badge sp-badge-error"><span className="sp-badge-dot" /> Esaurito</span>
                      ) : isLow ? (
                        <span className="sp-badge sp-badge-warning"><span className="sp-badge-dot" /> Basso</span>
                      ) : (
                        <span className="sp-badge sp-badge-success"><span className="sp-badge-dot" /> OK</span>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" className="sp-table-empty">Nessun articolo trovato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Prodotto</th>
                <th>Magazzino</th>
                <th>Causale</th>
                <th>Quantità</th>
                <th>Operatore</th>
              </tr>
            </thead>
            <tbody>
              {movements.length > 0 ? movements.map(item => (
                <tr key={item.id}>
                  <td className="sp-cell-secondary">{fmt(item.occurred_at)}</td>
                  <td className="sp-cell-primary">
                    {item.product_name}
                    {item.flavor && <span className="sp-cell-secondary"> — {item.flavor}</span>}
                  </td>
                  <td className="sp-cell-secondary">{item.warehouse_name}</td>
                  <td><span className="sp-badge sp-badge-neutral">{item.movement_type}</span></td>
                  <td>
                    <span className="sp-font-mono" style={{ fontWeight: 700, color: item.qty < 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {item.qty > 0 ? `+${item.qty}` : item.qty}
                    </span>
                  </td>
                  <td className="sp-cell-secondary">{item.actor_name || 'Sistema'}</td>
                </tr>
              )) : (
                <tr><td colSpan="6" className="sp-table-empty">Nessun movimento trovato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Cross-Store Tab — tutti i negozi */}
      {activeTab === 'cross_store' && (
        <div className="sp-table-wrap">
          <div className="sp-table-toolbar" style={{ padding: '16px 20px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: 'var(--color-text)' }}>🔍 Giacenze Locali (Ricerca Multi-Store)</h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
                Cerca un prodotto per vedere le giacenze disponibili in tutti i negozi.
              </p>
            </div>
            <div className="sp-search-box" style={{ width: 280 }}>
              <Search size={14} />
              <input
                autoFocus
                placeholder="Cerca prodotto, gusto, SKU..."
                value={crossStoreSearch}
                onChange={e => setCrossStoreSearch(e.target.value)}
                className="sp-search-input"
              />
            </div>
          </div>

          {crossStoreLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', margin: '0 auto' }} className="sp-spin" />
            </div>
          ) : crossStoreData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-tertiary)' }}>
              <MapPin size={40} style={{ opacity: 0.15, margin: '0 auto 12px', display: 'block' }} />
              {crossStoreSearch
                ? <p>Nessun risultato per "<strong>{crossStoreSearch}</strong>"</p>
                : <p>Inserisci un termine di ricerca o vedi i prodotti con stock basso.</p>
              }
            </div>
          ) : (
            <div style={{ padding: '0 0 16px' }}>
              {crossStoreData.map(product => (
                <div key={product.product_variant_id} style={{ borderBottom: '1px solid var(--color-border)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>
                        {product.product_name}
                        {product.flavor && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> — {product.flavor}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        SKU: {product.sku || '—'} · €{parseFloat(product.sale_price || 0).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: product.total_available > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      Totale: {product.total_available}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {product.stores.map(s => {
                      const avail = parseInt(s.available || 0);
                      const isLow = avail <= (s.reorder_point || 5) && avail > 0;
                      const isOut = avail <= 0;
                      return (
                        <div key={s.store_id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                          borderRadius: 100, border: '1px solid var(--color-border)',
                          background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#ecfdf5',
                          fontSize: 12, fontWeight: 700,
                        }}>
                          <MapPin size={11} color={isOut ? '#ef4444' : isLow ? '#f59e0b' : '#10b981'} />
                          <span style={{ color: 'var(--color-text)' }}>{s.store_name}</span>
                          {s.store_city && <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{s.store_city}</span>}
                          <span style={{
                            background: isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#d1fae5',
                            color: isOut ? '#991b1b' : isLow ? '#92400e' : '#065f46',
                            padding: '1px 8px', borderRadius: 100, fontSize: 11, fontWeight: 800,
                          }}>
                            {avail > 0 ? `${avail} disp.` : 'Esaurito'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* By Store Tab — superadmin only */}
      {activeTab === 'by_store' && isSuperAdmin && (() => {

        // Raggruppa stock per warehouse_id → store
        const stockByWarehouse = {};
        allStoresStock.forEach(item => {
          const key = item.warehouse_name || `Magazzino #${item.warehouse_id}`;
          if (!stockByWarehouse[key]) stockByWarehouse[key] = { name: key, items: [] };
          stockByWarehouse[key].items.push(item);
        });

        // Filtra per search
        const groups = Object.values(stockByWarehouse).map(g => ({
          ...g,
          items: byStoreSearch
            ? g.items.filter(i => i.product_name?.toLowerCase().includes(byStoreSearch.toLowerCase()) || i.sku?.toLowerCase().includes(byStoreSearch.toLowerCase()))
            : g.items,
        })).filter(g => g.items.length > 0);

        return (
          <div className="sp-table-wrap">
            <div className="sp-table-toolbar">
              <div className="sp-search-box" style={{ flex: 1, maxWidth: 300 }}>
                <Search size={14} />
                <input className="sp-input" placeholder="Filtra prodotto..." value={byStoreSearch} onChange={e => setByStoreSearch(e.target.value)} />
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                {storesList.length} negozi · {allStoresStock.length} referenze totali
              </span>
            </div>

            {groups.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>Nessun dato trovato.</div>}

            {groups.map(group => {
              const isOpen = expandedStores[group.name] !== false; // default espanso
              const lowItems = group.items.filter(i => i.on_hand < (i.reorder_point || 5)).length;
              return (
                <div key={group.name} style={{ marginBottom: 16, border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Store header */}
                  <button
                    onClick={() => setExpandedStores(p => ({ ...p, [group.name]: !isOpen }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'var(--color-surface-secondary)', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Store size={16} color="var(--color-accent)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{group.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {group.items.length} prodotti
                        {lowItems > 0 && <span style={{ marginLeft: 8, color: 'var(--color-warning)', fontWeight: 600 }}>⚠ {lowItems} in esaurimento</span>}
                      </div>
                    </div>
                    {isOpen ? <ChevronDown size={16} color="var(--color-text-tertiary)" /> : <ChevronRight size={16} color="var(--color-text-tertiary)" />}
                  </button>

                  {/* Products table */}
                  {isOpen && (
                    <table className="sp-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Prodotto</th>
                          <th>SKU</th>
                          <th>Disponibile</th>
                          <th>Riservato</th>
                          <th>Pt. Riordino</th>
                          <th>Stato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => {
                          const isLow = item.on_hand < (item.reorder_point || 5);
                          const isOut = item.on_hand <= 0;
                          return (
                            <tr key={item.id}>
                              <td>
                                <span className="sp-cell-primary">{item.product_name}</span>
                                {item.flavor && <span className="sp-cell-secondary" style={{ marginLeft: 6 }}>— {item.flavor}</span>}
                              </td>
                              <td className="sp-cell-secondary sp-font-mono">{item.sku || '—'}</td>
                              <td>
                                <span style={{ fontWeight: 700, color: isOut ? 'var(--color-error)' : isLow ? 'var(--color-warning)' : 'var(--color-success)', fontSize: 15 }}>
                                  {item.available ?? item.on_hand}
                                </span>
                              </td>
                              <td className="sp-cell-secondary sp-font-mono">{item.reserved || 0}</td>
                              <td className="sp-cell-secondary sp-font-mono">{item.reorder_point || '—'}</td>
                              <td>
                                {isOut ? <span className="sp-badge sp-badge-error"><span className="sp-badge-dot"/> Esaurito</span>
                                  : isLow ? <span className="sp-badge sp-badge-warning"><span className="sp-badge-dot"/> Basso</span>
                                  : <span className="sp-badge sp-badge-success"><span className="sp-badge-dot"/> OK</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}


      {showMovementModal && (
        <InventoryMovementModal
          stock={stock}
          storeId={selectedStoreId}
          onClose={() => setShowMovementModal(false)}
          onSaved={async () => { await fetchData(); setShowMovementModal(false); }}
        />
      )}

      {inventoryProduct && (
        <ProductInventoryModal product={inventoryProduct} onClose={() => setInventoryProduct(null)} />
      )}
    </div>
  );
}
