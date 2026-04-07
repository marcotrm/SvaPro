import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { inventory } from '../api.jsx';
import InventoryMovementModal from '../components/InventoryMovementModal.jsx';
import { Search, Plus, AlertTriangle, MapPin, Filter } from 'lucide-react';

export default function InventoryPage() {
  const { user, selectedStoreId, selectedStore } = useOutletContext();
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');

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

  const lowCount = stock.filter(i => i.on_hand < (i.reorder_point || 5)).length;
  const outCount = stock.filter(i => i.on_hand <= 0).length;

  const filtered = stock.filter(i => {
    if (filterLowStock && i.on_hand >= (i.reorder_point || 5)) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return i.product_name?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s);
    }
    return true;
  });

  const fmt = (v) => v ? new Date(v).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—';

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
            <button className="sp-btn sp-btn-primary" onClick={() => setShowMovementModal(true)}>
              <Plus size={16} /> Nuovo Movimento
            </button>
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
        <div className="sp-stat-card">
          <div className="sp-stat-label">Stock Basso</div>
          <div className="sp-stat-value" style={{ color: lowCount > 0 ? 'var(--color-warning)' : 'inherit' }}>{lowCount}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">Esaurito</div>
          <div className="sp-stat-value" style={{ color: outCount > 0 ? 'var(--color-error)' : 'inherit' }}>{outCount}</div>
        </div>
        <div className="sp-stat-card">
          <div className="sp-stat-label">Movimenti Recenti</div>
          <div className="sp-stat-value">{movements.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sp-tabs">
        <button className={`sp-tab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
          Giacenze
        </button>
        <button className={`sp-tab ${activeTab === 'movements' ? 'active' : ''}`} onClick={() => setActiveTab('movements')}>
          Movimenti
        </button>
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
                <th>Disponibile</th>
                <th>Riservato</th>
                <th>Pt. Riordino</th>
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
                    <td className="sp-cell-secondary sp-font-mono">{item.reserved || 0}</td>
                    <td className="sp-cell-secondary sp-font-mono">{item.reorder_point || '—'}</td>
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

      {showMovementModal && (
        <InventoryMovementModal
          stock={stock}
          onClose={() => setShowMovementModal(false)}
          onSaved={async () => { await fetchData(); setShowMovementModal(false); }}
        />
      )}
    </div>
  );
}
