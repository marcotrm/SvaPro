import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { catalog, inventory, stockRules } from '../api.jsx';
import { Package, Layers, Plus, Save, Building2, AlertTriangle, Loader2, Trash2, CheckCircle, Store, Cpu } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Select from 'react-select';

// Theme for react-select matching SvaPro Dark/Light Mode seamlessly
const selectStyles = {
  control: (base, state) => ({
    ...base,
    background: 'var(--color-bg)',
    borderColor: state.isFocused ? '#6366f1' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(99,102,241,0.2)' : 'none',
    borderRadius: '10px',
    minHeight: '42px',
    color: 'var(--color-text)',
    transition: 'all 0.2s ease',
    '&:hover': { borderColor: '#6366f1' }
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    zIndex: 50
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#6366f1' : state.isFocused ? 'rgba(99,102,241,0.1)' : 'transparent',
    color: state.isSelected ? '#fff' : 'var(--color-text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: state.isSelected ? 700 : 500,
    padding: '10px 14px',
    '&:active': { background: '#4f46e5' }
  }),
  singleValue: (base) => ({ ...base, color: 'var(--color-text)', fontWeight: 600, fontSize: '14px' }),
  multiValue: (base) => ({ ...base, background: 'rgba(99,102,241,0.15)', borderRadius: '6px' }),
  multiValueLabel: (base) => ({ ...base, color: '#6366f1', fontWeight: 700, fontSize: '13px' }),
  multiValueRemove: (base) => ({ ...base, color: '#6366f1', '&:hover': { background: '#6366f1', color: '#fff' } }),
  placeholder: (base) => ({ ...base, color: 'var(--color-text-tertiary)', fontSize: '14px' }),
  input: (base) => ({ ...base, color: 'var(--color-text)' })
};

export default function StockRulesPage() {
  const { user } = useOutletContext();
  const [activeTab, setActiveTab] = useState('rules'); 
  const [loading, setLoading] = useState(false);
  
  // Data
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [storeGroups, setStoreGroups] = useState([]);
  const [rules, setRules] = useState([]);
  
  useEffect(() => { fetchData(); }, []);

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <Loader2 size={40} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <div style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>Caricamento ambiente logistico...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }} className="sp-animate-in">
      
      {/* Hero Section */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)', borderRadius: 24, padding: '32px 36px', marginBottom: 30, position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px -10px rgba(15, 23, 42, 0.4)' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 240, height: 240, borderRadius: '50%', background: 'rgba(99,102,241,0.08)' }}/>
        <div style={{ position: 'absolute', right: 80, bottom: -60, width: 180, height: 180, borderRadius: '50%', background: 'rgba(16,185,129,0.06)' }}/>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Cpu size={32} color="#818cf8"/>
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Regole di Stock & Gruppi</h1>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '6px 0 0', fontWeight: 500 }}>
              Motore di configurazione massiva per soglie di riordino, scorte minime e raggruppamenti logici.
            </p>
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 30, background: 'var(--color-surface)', padding: 6, borderRadius: 16, border: '1px solid var(--color-border)', width: 'fit-content', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        {[
          { key: 'rules', label: 'Wizard Regole di Riordino', icon: Layers },
          { key: 'groups', label: 'Gestione Gruppi Negozi', icon: Building2 }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontWeight: isActive ? 800 : 600, fontSize: 14, transition: 'all 0.2s',
                background: isActive ? '#6366f1' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                boxShadow: isActive ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'
              }}
            >
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ animation: 'fade-in 0.3s ease-out' }}>
        {activeTab === 'rules' && (
          <RulesEngineTab 
            categories={categories} brands={brands} warehouses={warehouses} storeGroups={storeGroups} rules={rules} onRefresh={fetchData}
          />
        )}
        {activeTab === 'groups' && (
          <StoreGroupsTab storeGroups={storeGroups} warehouses={warehouses} onRefresh={fetchData} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Rules Engine Tab
// ─────────────────────────────────────────────────────────────────────────────
function RulesEngineTab({ categories, brands, warehouses, storeGroups, rules, onRefresh }) {
  const [formData, setFormData] = useState({
    category_id: null,
    brand_id: null,
    target_type: 'all_stores',
    target_id: null,
    min_stock: '',
    max_stock: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Formatting options for react-select
  const catOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const brandOptions = brands.map(b => ({ value: b.id, label: b.name }));
  const groupOptions = storeGroups.map(g => ({ value: g.id, label: g.name }));
  const whOptions = warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.type})` }));

  const targetTypes = [
    { value: 'all_stores', label: 'Tutti i Negozi Retail (Esclude Centrale)' },
    { value: 'store_group', label: 'Speciale Gruppo Negozi' },
    { value: 'warehouse', label: 'Singolo Deposito / Magazzino' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.target_type !== 'all_stores' && !formData.target_id) {
      toast.error('Seleziona un destinatario specifico (Gruppo o Magazzino).');
      return;
    }
    if (!formData.max_stock || parseInt(formData.min_stock) > parseInt(formData.max_stock)) {
      toast.error('La scorta massima deve essere maggiore o uguale a quella minima.');
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        category_id: formData.category_id?.value || null,
        brand_id: formData.brand_id?.value || null,
        target_type: formData.target_type,
        target_id: formData.target_id?.value || null,
        min_stock: parseInt(formData.min_stock) || 0,
        max_stock: parseInt(formData.max_stock) || 0,
      };

      const res = await stockRules.applyRule(payload);
      toast.success(res.data.message || 'Regola applicata con successo!', { icon: '🚀' });
      toast(`Aggiornate le soglie per ${res.data.applied_count} record di magazzino.`, { icon: '📊' });
      
      // Reset form on success
      setFormData({ ...formData, min_stock: '', max_stock: '' });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore critico durante l\'applicazione della regola');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 30, alignItems: 'start' }}>
      
      {/* GLASSSMORPHIC WIZARD */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, border: '1px solid var(--color-border)', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'sticky', top: 30 }}>
        <div style={{ background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)', padding: '18px 24px', color: '#fff' }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={20} /> Applica Nuova Regola
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8, fontWeight: 500 }}>Gli aggiornamenti sul DB saranno istantanei.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* STEP 1 */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: -34, top: 2, width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>1</div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: 'var(--color-text)' }}>Filtro Prodotti (Scope)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Categoria (Opzionale)</label>
                <Select styles={selectStyles} options={catOptions} value={formData.category_id} onChange={v => setFormData({...formData, category_id: v})} isClearable placeholder="Tutto il catalogo..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Marchio (Opzionale)</label>
                <Select styles={selectStyles} options={brandOptions} value={formData.brand_id} onChange={v => setFormData({...formData, brand_id: v})} isClearable placeholder="Tutti i marchi..." />
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--color-border)', width: '100%' }} />

          {/* STEP 2 */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: -34, top: 2, width: 24, height: 24, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>2</div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: 'var(--color-text)' }}>Destinatari (Target)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Tipologia Destinatario</label>
                <Select 
                  styles={selectStyles} 
                  options={targetTypes} 
                  value={targetTypes.find(t => t.value === formData.target_type)} 
                  onChange={v => setFormData({...formData, target_type: v.value, target_id: null})} 
                  isSearchable={false}
                />
              </div>
              
              {formData.target_type === 'store_group' && (
                <div style={{ animation: 'fade-in 0.2s' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Seleziona Gruppo</label>
                  <Select styles={selectStyles} options={groupOptions} value={formData.target_id} onChange={v => setFormData({...formData, target_id: v})} placeholder="Cerca gruppo..." required />
                </div>
              )}

              {formData.target_type === 'warehouse' && (
                <div style={{ animation: 'fade-in 0.2s' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Seleziona Magazzino</label>
                  <Select styles={selectStyles} options={whOptions} value={formData.target_id} onChange={v => setFormData({...formData, target_id: v})} placeholder="Cerca deposito o negozio..." required />
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--color-border)', width: '100%' }} />

          {/* STEP 3 */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: -34, top: 2, width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>3</div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: 'var(--color-text)' }}>Soglie Logistiche</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#d97706', marginBottom: 6 }}>Scorta Minima (Trigger)</label>
                <input type="number" min="0" required value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: e.target.value})} placeholder="Es. 2" style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 14px', fontSize: 16, fontWeight: 800, color: 'var(--color-text)', outline: 'none', transition: 'all 0.2s' }} />
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6, lineHeight: 1.3 }}>Quantità sotto la quale scatta il bisogno di riordino.</div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#059669', marginBottom: 6 }}>Scorta Massima (Target)</label>
                <input type="number" min="0" required value={formData.max_stock} onChange={e => setFormData({...formData, max_stock: e.target.value})} placeholder="Es. 6" style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid #6ee7b7', borderRadius: 10, padding: '12px 14px', fontSize: 16, fontWeight: 800, color: 'var(--color-text)', outline: 'none', transition: 'all 0.2s' }} />
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6, lineHeight: 1.3 }}>Target da riempire. Ordine = Max - Attuale.</div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting} 
            style={{ 
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: submitting ? '#94a3b8' : 'linear-gradient(to right, #6366f1, #4f46e5)',
              color: '#fff', border: 'none', borderRadius: 12, height: 52, fontSize: 15, fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 8px 20px -6px rgba(99,102,241,0.5)',
              transition: 'all 0.2s', marginTop: 10
            }}
          >
            {submitting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
            {submitting ? 'Applicazione massiva in corso...' : 'Applica e Sovrascrivi DB'}
          </button>
        </form>
      </div>

      {/* HISTORY */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, border: '1px solid var(--color-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 24, borderRadius: 4, background: '#10b981' }} />
          <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: 'var(--color-text)' }}>Storico Regole Attive</h3>
        </div>
        
        {rules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-tertiary)' }}>
            <Layers size={48} opacity={0.2} style={{ margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Nessuna regola salvata finora.</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Usa il wizard qui a lato per generare la tua prima regola.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Creata il</th>
                  <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Destinatari (Target)</th>
                  <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtro Prodotti</th>
                  <th style={{ padding: '14px 24px', fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Min / Max</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      {new Date(rule.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                        background: rule.target_type === 'warehouse' ? 'rgba(245,158,11,0.1)' : rule.target_type === 'store_group' ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                        color: rule.target_type === 'warehouse' ? '#d97706' : rule.target_type === 'store_group' ? '#6366f1' : '#10b981'
                      }}>
                        {rule.target_type === 'warehouse' && <Store size={14}/>}
                        {rule.target_type === 'store_group' && <Building2 size={14}/>}
                        {rule.target_type === 'all_stores' && <Layers size={14}/>}
                        {rule.target_name}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>
                      {rule.category_name && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Layers size={12} color="#94a3b8"/> {rule.category_name}</div>}
                      {rule.brand_name && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Package size={12} color="#94a3b8"/> {rule.brand_name}</div>}
                      {!rule.category_name && !rule.brand_name && <div style={{ opacity: 0.5 }}>Intero Catalogo (All)</div>}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 900 }}>
                        <span style={{ color: '#d97706', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 6 }}>Min: {rule.min_stock}</span>
                        <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 6 }}>Max: {rule.max_stock}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

  const retailWarehouses = warehouses.filter(w => w.type === 'store' && w.store_id);
  const whOptions = retailWarehouses.map(w => ({ value: w.store_id, label: w.name }));

  const startEdit = (group = null) => {
    if (group) {
      setEditingId(group.id);
      setName(group.name);
      setSelectedStores(whOptions.filter(opt => (group.store_ids || []).includes(opt.value)));
    } else {
      setEditingId('new');
      setName('');
      setSelectedStores([]);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || selectedStores.length === 0) {
      toast.error("Inserisci un nome e seleziona almeno un negozio.");
      return;
    }
    setSaving(true);
    try {
      await stockRules.saveStoreGroup({
        id: editingId === 'new' ? null : editingId,
        name: name,
        store_ids: selectedStores.map(s => s.value)
      });
      toast.success('Gruppo salvato con successo!', { icon: '🏢' });
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error('Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo gruppo? Le regole già applicate NON verranno modificate o cancellate.')) return;
    try {
      await stockRules.deleteStoreGroup(id);
      toast.success('Gruppo eliminato');
      onRefresh();
    } catch (err) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: 30, alignItems: 'start' }}>
      
      {/* LISTA GRUPPI */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, border: '1px solid var(--color-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={20} color="#6366f1" /> Raggruppamenti Logici
          </h3>
          <button 
            onClick={() => startEdit(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <Plus size={14} /> Nuovo Gruppo
          </button>
        </div>

        {storeGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-tertiary)' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Nessun gruppo configurato.</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Crea un gruppo per applicare regole a pi??negozi contemporaneamente.</div>
          </div>
        ) : (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {storeGroups.map(group => (
              <div key={group.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>{group.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Store size={14} /> {(group.store_ids || []).length} Negozi associati
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(group)} style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    Gestisci
                  </button>
                  <button onClick={() => handleDelete(group.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: '8px 10px', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDITOR */}
      {editingId && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 20, border: '1px solid var(--color-border)', boxShadow: '0 12px 40px -12px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'sticky', top: 30, animation: 'fade-in 0.2s' }}>
          <div style={{ background: 'var(--color-bg)', padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--color-text)' }}>
              {editingId === 'new' ? '✨ Crea Nuovo Gruppo' : '✏️ Modifica Gruppo'}
            </h3>
          </div>
          
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Nome Gruppo</label>
              <input 
                type="text" 
                placeholder="es. Top Store Campania" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ width: '100%', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Negozi Associati (Multi-Select)</label>
              <Select 
                styles={selectStyles} 
                options={whOptions} 
                value={selectedStores} 
                onChange={setSelectedStores} 
                isMulti 
                closeMenuOnSelect={false}
                placeholder="Cerca e seleziona negozi..." 
              />
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 8, lineHeight: 1.4 }}>
                Seleziona i punti vendita retail da inserire in questo cluster logistico. Non includere i depositi centrali.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button 
                onClick={cancelEdit}
                style={{ flex: 1, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
              >
                Annulla
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || !name.trim()}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}
              >
                {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }}/> : <Save size={16}/>}
                {saving ? 'Salvataggio...' : 'Salva Gruppo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

