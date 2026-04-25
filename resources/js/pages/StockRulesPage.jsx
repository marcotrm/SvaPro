import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { catalog, inventory, suppliers, stockRules } from '../api.jsx';
import { Package, Layers, Plus, Save, Server, Building2, Store, AlertTriangle, ArrowRight, Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StockRulesPage() {
  const { user, selectedStoreId } = useOutletContext();
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'groups'
  const [loading, setLoading] = useState(false);
  
  // Data
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [storeGroups, setStoreGroups] = useState([]);
  const [rules, setRules] = useState([]);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, brandRes, whRes, groupRes, ruleRes] = await Promise.all([
        catalog.getCategories(),
        catalog.getBrands(),
        inventory.getWarehouses(),
        stockRules.getStoreGroups(),
        stockRules.getRules()
      ]);
      setCategories(catRes.data?.data || []);
      setBrands(brandRes.data?.data || []);
      setWarehouses(whRes.data?.data || []);
      setStoreGroups(groupRes.data?.data || []);
      setRules(ruleRes.data?.data || []);
    } catch (err) {
      toast.error('Errore nel caricamento dei dati base');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !categories.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
      </div>
    );
  }

  return (
    <div className="sp-animate-in">
      <div className="sp-page-header">
        <div>
          <h1 className="sp-page-title">Regole di Stock & Gruppi</h1>
          <p className="sp-page-subtitle">Configurazione massiva delle soglie di magazzino</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setActiveTab('rules')}
          style={{
            background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            color: activeTab === 'rules' ? 'var(--color-text)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'rules' ? '2px solid var(--color-text)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Layers size={16} /> Regole di Riordino
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          style={{
            background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            color: activeTab === 'groups' ? 'var(--color-text)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'groups' ? '2px solid var(--color-text)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          <Building2 size={16} /> Gruppi Negozi
        </button>
      </div>

      {activeTab === 'rules' && (
        <RulesEngineTab 
          categories={categories} 
          brands={brands} 
          warehouses={warehouses} 
          storeGroups={storeGroups}
          rules={rules}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'groups' && (
        <StoreGroupsTab 
          storeGroups={storeGroups} 
          warehouses={warehouses} 
          onRefresh={fetchData} 
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Rules Engine Tab
// ─────────────────────────────────────────────────────────────────────────────
function RulesEngineTab({ categories, brands, warehouses, storeGroups, rules, onRefresh }) {
  const [formData, setFormData] = useState({
    category_id: '',
    brand_id: '',
    target_type: 'all_stores',
    target_id: '',
    min_stock: 0,
    max_stock: 0
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.target_type !== 'all_stores' && !formData.target_id) {
      toast.error('Seleziona un target specifico');
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        brand_id: formData.brand_id ? parseInt(formData.brand_id) : null,
        target_type: formData.target_type,
        target_id: formData.target_id ? parseInt(formData.target_id) : null,
        min_stock: parseInt(formData.min_stock) || 0,
        max_stock: parseInt(formData.max_stock) || 0,
      };

      const res = await stockRules.applyRule(payload);
      toast.success(res.data.message || 'Regola applicata!');
      toast(`Aggiornati ${res.data.applied_count} record di magazzino.`, { icon: '📊' });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore nell\'applicazione della regola');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24, alignItems: 'start' }}>
      {/* WIZARD FORM */}
      <div className="sp-card" style={{ position: 'sticky', top: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Nuova Regola
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* STEP 1 */}
          <div style={{ padding: 16, background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--color-text)' }}>1. Filtro Prodotti (Scope)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="sp-label">Categoria (Opzionale)</label>
                <select className="sp-select" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  <option value="">Tutte le categorie</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Marchio (Opzionale)</label>
                <select className="sp-select" value={formData.brand_id} onChange={e => setFormData({...formData, brand_id: e.target.value})}>
                  <option value="">Tutti i marchi</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* STEP 2 */}
          <div style={{ padding: 16, background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--color-text)' }}>2. Destinatari (Target)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label className="sp-label">Si applica a:</label>
                <select className="sp-select" value={formData.target_type} onChange={e => setFormData({...formData, target_type: e.target.value, target_id: ''})}>
                  <option value="all_stores">Tutti i Negozi Retail (esclude depositi)</option>
                  <option value="store_group">Gruppo di Negozi</option>
                  <option value="warehouse">Singolo Magazzino / Deposito Centrale</option>
                </select>
              </div>
              
              {formData.target_type === 'store_group' && (
                <div>
                  <label className="sp-label">Seleziona Gruppo</label>
                  <select className="sp-select" required value={formData.target_id} onChange={e => setFormData({...formData, target_id: e.target.value})}>
                    <option value="">-- Seleziona --</option>
                    {storeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}

              {formData.target_type === 'warehouse' && (
                <div>
                  <label className="sp-label">Seleziona Magazzino</label>
                  <select className="sp-select" required value={formData.target_id} onChange={e => setFormData({...formData, target_id: e.target.value})}>
                    <option value="">-- Seleziona --</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.type})</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3 */}
          <div style={{ padding: 16, background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--color-text)' }}>3. Soglie di Stock</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="sp-label" style={{ color: 'var(--color-warning)' }}>Scorta Minima</label>
                <input type="number" min="0" className="sp-input" required value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: e.target.value})} placeholder="Es. 2" />
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Soglia per far scattare il riordino</div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="sp-label" style={{ color: '#10b981' }}>Scorta Massima</label>
                <input type="number" min="0" className="sp-input" required value={formData.max_stock} onChange={e => setFormData({...formData, max_stock: e.target.value})} placeholder="Es. 5" />
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Target di giacenza ideale</div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting} 
            className="sp-btn sp-btn-primary" 
            style={{ width: '100%', justifyContent: 'center', height: 48, fontSize: 14 }}
          >
            {submitting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            Applica e Sovrascrivi
          </button>
        </form>
      </div>

      {/* HISTORY */}
      <div className="sp-card">
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Storico Regole Applicate</h3>
        {rules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>Nessuna regola salvata finora.</div>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Target</th>
                <th>Filtri</th>
                <th>Soglie</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td style={{ fontSize: 12 }}>{new Date(rule.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>
                    <span className={`sp-badge sp-badge-${rule.target_type === 'warehouse' ? 'warning' : rule.target_type === 'store_group' ? 'primary' : 'neutral'}`}>
                      {rule.target_name}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {rule.category_name && <div><Layers size={10}/> {rule.category_name}</div>}
                    {rule.brand_name && <div><Package size={10}/> {rule.brand_name}</div>}
                    {!rule.category_name && !rule.brand_name && <i>Tutto il catalogo</i>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight: 700 }}>
                      <span style={{ color: 'var(--color-warning)' }}>MIN: {rule.min_stock}</span>
                      <span style={{ color: '#10b981' }}>MAX: {rule.max_stock}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Store Groups Tab
// ─────────────────────────────────────────────────────────────────────────────
function StoreGroupsTab({ storeGroups, warehouses, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [saving, setSaving] = useState(false);

  // Filtreremo solo i negozi retail (type='store') per semplificare, dato che le regole "Gruppo Negozi" di solito non hanno i depositi.
  const retailWarehouses = warehouses.filter(w => w.type === 'store' && w.store_id);

  const startEdit = (group = null) => {
    if (group) {
      setEditingId(group.id);
      setName(group.name);
      setSelectedStores(group.store_ids || []);
    } else {
      setEditingId('new');
      setName('');
      setSelectedStores([]);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const toggleStore = (storeId) => {
    setSelectedStores(prev => 
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await stockRules.saveStoreGroup({
        id: editingId === 'new' ? null : editingId,
        name: name,
        store_ids: selectedStores
      });
      toast.success('Gruppo salvato!');
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error('Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo gruppo? Le regole già applicate NON verranno modificate.')) return;
    try {
      await stockRules.deleteStoreGroup(id);
      toast.success('Gruppo eliminato');
      onRefresh();
    } catch (err) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24, alignItems: 'start' }}>
      {/* LISTA GRUPPI */}
      <div className="sp-card">
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Gruppi Esistenti</span>
          <button className="sp-btn sp-btn-sm sp-btn-secondary" onClick={() => startEdit(null)}>
            <Plus size={14} /> Crea Gruppo
          </button>
        </h3>

        {storeGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}>Nessun gruppo configurato.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {storeGroups.map(group => (
              <div key={group.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{group.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    {(group.store_ids || []).length} negozi assegnati
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="sp-btn sp-btn-sm sp-btn-secondary" onClick={() => startEdit(group)}>Modifica</button>
                  <button className="sp-btn sp-btn-sm sp-btn-ghost" onClick={() => handleDelete(group.id)} style={{ color: 'var(--color-error)' }}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDITOR */}
      {editingId && (
        <div className="sp-card" style={{ position: 'sticky', top: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
            {editingId === 'new' ? 'Nuovo Gruppo' : 'Modifica Gruppo'}
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="sp-label">Nome Gruppo</label>
              <input 
                type="text" 
                className="sp-input" 
                placeholder="es: Negozi Campania" 
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
            </div>

            <div>
              <label className="sp-label">Negozi (Retail)</label>
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {retailWarehouses.map(wh => {
                  const checked = selectedStores.includes(wh.store_id);
                  return (
                    <label key={wh.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: checked ? 'rgba(var(--accent-rgb),0.05)' : 'transparent', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={checked} 
                        onChange={() => toggleStore(wh.store_id)} 
                        style={{ accentColor: 'var(--color-accent)', width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: 'var(--color-text)' }}>
                        {wh.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="sp-btn sp-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={cancelEdit}>Annulla</button>
              <button className="sp-btn sp-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving || !name.trim()}>
                {saving ? <Loader2 size={14} className="sp-spin"/> : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
