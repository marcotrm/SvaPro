import React, { useEffect, useState, useMemo } from 'react';
import { X, Loader, Plus, Trash2, Barcode, MapPin, Package, Tag, DollarSign, Settings2, AlertTriangle } from 'lucide-react';
import { catalog } from '../api.jsx';

const PRODUCT_TYPES = [
  { value: 'liquid', label: '💧 Liquido' },
  { value: 'device', label: '🔋 Device/Hardware' },
  { value: 'accessory', label: '🔌 Accessorio' },
  { value: 'consumable', label: '🔄 Consumabile (Coil/Cotton)' },
  { value: 'other', label: '📦 Altro' },
];

const TAX_CLASSES = [
  { value: '', label: 'Seleziona IVA...' },
  { value: '1', label: '22% — Standard' },
  { value: '2', label: '10% — Ridotta' },
  { value: '3', label: '4% — Agevolata' },
];

const createEmptyVariant = () => ({
  sale_price: '',
  cost_price: '',
  pack_size: 1,
  flavor: '',
  resistance_ohm: '',
  nicotine_strength: '',
  volume_ml: '',
  color: '',
  barcode: '',
  location: '',
  tax_class_id: '',
  excise_profile_code: '',
  excise_unit_amount_override: '',
  prevalenza_code: '',
  prevalenza_label: '',
});

const normalizeVariant = (v = {}) => ({
  id: v.id,
  sale_price: v.sale_price ?? '',
  cost_price: v.cost_price ?? '',
  pack_size: v.pack_size ?? 1,
  flavor: v.flavor ?? '',
  resistance_ohm: v.resistance_ohm ?? '',
  nicotine_strength: v.nicotine_strength ?? '',
  volume_ml: v.volume_ml ?? '',
  color: v.color ?? '',
  barcode: v.barcode ?? '',
  location: v.location ?? '',
  tax_class_id: v.tax_class_id ?? '',
  excise_profile_code: v.excise_profile_code ?? '',
  excise_unit_amount_override: v.excise_unit_amount_override ?? '',
  prevalenza_code: v.prevalenza_code ?? '',
  prevalenza_label: v.prevalenza_label ?? '',
});

const normalizeProduct = (product, storesList, selectedStoreId = '') => {
  const storeIds = Array.from(new Set((product?.variants || []).flatMap((v) =>
    (v.assigned_stores || []).map((s) => Number(s.store_id))
  )));
  const selectedStoreNumericId = selectedStoreId ? Number(selectedStoreId) : null;
  const defaultStoreIds = selectedStoreNumericId ? [selectedStoreNumericId] : storesList.map((s) => Number(s.id));

  return {
    sku: product?.sku || '',
    name: product?.name || '',
    product_type: product?.product_type || 'liquid',
    category_id: product?.category_id ?? '',
    barcode: product?.barcode || '',
    pli_code: product?.pli_code || '',
    default_supplier_id: product?.default_supplier_id ?? '',
    nicotine_mg: product?.nicotine_mg ?? '',
    volume_ml: product?.volume_ml ?? '',
    reorder_days: product?.reorder_days ?? 30,
    min_stock_qty: product?.min_stock_qty ?? 0,
    auto_reorder_enabled: product?.auto_reorder_enabled ?? true,
    description: product?.description || '',
    store_ids: storeIds.length > 0 ? storeIds : defaultStoreIds,
    variants: product?.variants?.length ? product.variants.map(normalizeVariant) : [createEmptyVariant()],
  };
};

export default function CatalogModal({ product, storesList = [], suppliers = [], categories = [], selectedStoreId = '', onClose, onSave }) {
  const [formData, setFormData] = useState(() => normalizeProduct(product, storesList, selectedStoreId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'variants' | 'fiscal' | 'inventory'

  useEffect(() => {
    setFormData(normalizeProduct(product, storesList, selectedStoreId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, selectedStoreId]); // deliberately exclude storesList to avoid infinite loop when parent passes a new [] literal each render

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleVariantChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => i === index ? { ...v, [field]: value } : v),
    }));
  };

  const addVariant = () => setFormData(p => ({ ...p, variants: [...p.variants, createEmptyVariant()] }));
  const removeVariant = (idx) => setFormData(p => ({ ...p, variants: p.variants.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});
      const fd = new FormData();

      const appendValue = (fd, key, value) => {
        if (value === null || value === undefined || value === '') return;
        if (typeof value === 'boolean') {
          fd.append(key, value ? '1' : '0');
        } else {
          fd.append(key, value);
        }
      };

      Object.entries(formData).forEach(([k, v]) => {
        if (k === 'variants') {
          v.forEach((variant, index) => {
            Object.entries(variant).forEach(([vk, vv]) => {
              appendValue(fd, `variants[${index}][${vk}]`, vv);
            });
          });
        } else if (k === 'store_ids') {
          v.forEach(id => fd.append('store_ids[]', id));
        } else {
          appendValue(fd, k, v);
        }
      });

      if (product?.id) {
        fd.append('_method', 'PUT');
        await catalog.updateProduct(product.id, fd);
      } else {
        await catalog.createProduct(fd);
      }
      onSave();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setFieldErrors(serverErrors);
        const msgs = Object.values(serverErrors).flat().join(' | ');
        setError('Controlla i campi: ' + msgs);
      } else {
        setError(err.response?.data?.message || err.userFriendlyMessage || err.message || 'Errore salvataggio');
      }
    } finally {
      setLoading(false);
    }
  };


  const categoryOptions = useMemo(() => {
    const mains = categories.filter(c => !c.parent_id);
    const options = [];
    mains.forEach(m => {
      options.push(m);
      categories.filter(c => c.parent_id === m.id).forEach(s => {
        options.push({ ...s, name: `└─ ${s.name}` });
      });
    });
    return options;
  }, [categories]);

  const TABS = [
    { id: 'info', label: 'Informazioni', icon: <Package size={14} /> },
    { id: 'variants', label: 'Varianti & Prezzi', icon: <Tag size={14} /> },
    { id: 'fiscal', label: 'Fiscale & Accise', icon: <DollarSign size={14} /> },
    { id: 'inventory', label: 'Inventario', icon: <Settings2 size={14} /> },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 16, width: '100%',
        maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.15)', border: '1px solid var(--color-border)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              {product ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              {product ? `ID: ${product.id} — SKU: ${product.sku}` : 'Aggiungi un nuovo prodotto al catalogo'}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--color-bg)', border: 'none', borderRadius: 10,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 24px', flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '14px 16px',
                fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid #fca5a5', borderRadius: 8, color: 'var(--color-error)', fontSize: 13, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* TAB: INFO */}
          {activeTab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label">Nome Prodotto *</label>
                <input className="sp-input" name="name" value={formData.name} onChange={handleChange} required placeholder="Es: Liquido 10ml Menta Ghiaccio" />
              </div>
              <div>
                <label className="sp-label">SKU Master *</label>
                <input className="sp-input" name="sku" value={formData.sku} onChange={handleChange} required placeholder="Es: LIQ-MENTA-10ML" />
              </div>
              <div>
                <label className="sp-label">Barcode Prodotto (EAN / GTIN)</label>
                <div style={{ position: 'relative' }}>
                  <Barcode size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                  <input className="sp-input" name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Es: 8001234567890" style={{ paddingLeft: 36 }} />
                </div>
              </div>
              <div>
                <label className="sp-label">Tipo Prodotto *</label>
                <select className="sp-select" name="product_type" value={formData.product_type} onChange={handleChange}>
                  {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Categoria</label>
                <select className="sp-select" name="category_id" value={formData.category_id} onChange={handleChange}>
                  <option value="">— Nessuna Categoria —</option>
                  {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Fornitore Predefinito</label>
                <select className="sp-select" name="default_supplier_id" value={formData.default_supplier_id} onChange={handleChange}>
                  <option value="">— Seleziona Fornitore —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Codice PLI (Accise)</label>
                <input className="sp-input" name="pli_code" value={formData.pli_code} onChange={handleChange} placeholder="Es: 9041" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label">Descrizione</label>
                <textarea className="sp-input" name="description" value={formData.description} onChange={handleChange} placeholder="Descrizione breve del prodotto..." rows={3} style={{ resize: 'vertical' }} />
              </div>
              {/* Stores assignment */}
              {storesList.length > 1 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="sp-label">Negozi assegnati</label>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                    {storesList.map(store => (
                      <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.store_ids.includes(Number(store.id))}
                          onChange={e => {
                            const id = Number(store.id);
                            setFormData(p => ({
                              ...p,
                              store_ids: e.target.checked
                                ? [...p.store_ids, id]
                                : p.store_ids.filter(s => s !== id)
                            }));
                          }}
                        />
                        {store.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: VARIANTI */}
          {activeTab === 'variants' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Varianti Prodotto</h3>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>Ogni variante ha prezzi, barcode e ubicazione propri</p>
                </div>
                <button type="button" className="sp-btn sp-btn-secondary sp-btn-sm" onClick={addVariant}>
                  <Plus size={14} /> Aggiungi Variante
                </button>
              </div>

              {formData.variants.map((v, idx) => (
                <div key={idx} style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Variante #{idx + 1}</span>
                    {formData.variants.length > 1 && (
                      <button type="button" onClick={() => removeVariant(idx)} style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
                        <Trash2 size={12} /> Rimuovi
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <label className="sp-label">Gusto / Flavor</label>
                      <input className="sp-input" value={v.flavor} onChange={e => handleVariantChange(idx, 'flavor', e.target.value)} placeholder="Es: Menta Ghiaccio" />
                    </div>
                    <div>
                      <label className="sp-label">Colore</label>
                      <input className="sp-input" value={v.color} onChange={e => handleVariantChange(idx, 'color', e.target.value)} placeholder="Es: Nero" />
                    </div>
                    <div>
                      <label className="sp-label">Nicotina (mg/ml)</label>
                      <input className="sp-input" type="number" step="0.1" value={v.nicotine_strength} onChange={e => handleVariantChange(idx, 'nicotine_strength', e.target.value)} placeholder="Es: 3" />
                    </div>
                    <div>
                      <label className="sp-label">Volume (ml)</label>
                      <input className="sp-input" type="number" step="1" value={v.volume_ml} onChange={e => handleVariantChange(idx, 'volume_ml', e.target.value)} placeholder="Es: 10" />
                    </div>
                    <div>
                      <label className="sp-label">Resistenza (Ohm)</label>
                      <input className="sp-input" type="number" step="0.01" value={v.resistance_ohm} onChange={e => handleVariantChange(idx, 'resistance_ohm', e.target.value)} placeholder="Es: 0.8" />
                    </div>
                    <div>
                      <label className="sp-label">Pezzi per Pacco</label>
                      <input className="sp-input" type="number" min="1" value={v.pack_size} onChange={e => handleVariantChange(idx, 'pack_size', e.target.value)} />
                    </div>
                    <div>
                      <label className="sp-label">Prezzo Vendita (€) *</label>
                      <input className="sp-input" type="number" step="0.01" value={v.sale_price} onChange={e => handleVariantChange(idx, 'sale_price', e.target.value)} placeholder="0.00" style={{ fontWeight: 700 }} />
                    </div>
                    <div>
                      <label className="sp-label">Costo (€)</label>
                      <input className="sp-input" type="number" step="0.01" value={v.cost_price} onChange={e => handleVariantChange(idx, 'cost_price', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="sp-label">Barcode Variante (EAN)</label>
                      <div style={{ position: 'relative' }}>
                        <Barcode size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                        <input className="sp-input" value={v.barcode} onChange={e => handleVariantChange(idx, 'barcode', e.target.value)} placeholder="Scansiona o inserisci..." style={{ paddingLeft: 34 }} />
                      </div>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="sp-label">Ubicazione in Magazzino</label>
                      <div style={{ position: 'relative' }}>
                        <MapPin size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                        <input className="sp-input" value={v.location} onChange={e => handleVariantChange(idx, 'location', e.target.value)} placeholder="Es: Scaffale A3 - Ripiano 2" style={{ paddingLeft: 34 }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: FISCALE */}
          {activeTab === 'fiscal' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label className="sp-label">Nicotina Prodotto (mg)</label>
                <input className="sp-input" type="number" step="0.1" name="nicotine_mg" value={formData.nicotine_mg} onChange={handleChange} placeholder="Es: 3" />
              </div>
              <div>
                <label className="sp-label">Volume Prodotto (ml)</label>
                <input className="sp-input" type="number" step="1" name="volume_ml" value={formData.volume_ml} onChange={handleChange} placeholder="Es: 10" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 16px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accise per Variante</h4>
              </div>
              {formData.variants.map((v, idx) => (
                <React.Fragment key={idx}>
                  <div style={{ gridColumn: '1/-1', background: 'var(--color-bg)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Variante #{idx + 1} {v.flavor ? `— ${v.flavor}` : ''}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="sp-label">Classe IVA</label>
                        <select className="sp-select" value={v.tax_class_id} onChange={e => handleVariantChange(idx, 'tax_class_id', e.target.value)}>
                          {TAX_CLASSES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="sp-label">Codice Accisa</label>
                        <input className="sp-input" value={v.excise_profile_code} onChange={e => handleVariantChange(idx, 'excise_profile_code', e.target.value)} placeholder="Es: E1" />
                      </div>
                      <div>
                        <label className="sp-label">Accisa Unitaria Override (€)</label>
                        <input className="sp-input" type="number" step="0.001" value={v.excise_unit_amount_override} onChange={e => handleVariantChange(idx, 'excise_unit_amount_override', e.target.value)} placeholder="Auto da regole" />
                      </div>
                      <div>
                        <label className="sp-label">Codice Prevalenza</label>
                        <input className="sp-input" value={v.prevalenza_code} onChange={e => handleVariantChange(idx, 'prevalenza_code', e.target.value)} placeholder="Es: PREVALENZA_1" />
                      </div>
                      <div style={{ gridColumn: '2/-1' }}>
                        <label className="sp-label">Label Prevalenza</label>
                        <input className="sp-input" value={v.prevalenza_label} onChange={e => handleVariantChange(idx, 'prevalenza_label', e.target.value)} placeholder="Es: Tabacco prevalente" />
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* TAB: INVENTARIO */}
          {activeTab === 'inventory' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label className="sp-label">Stock Minimo (Soglia Alert)</label>
                <input className="sp-input" type="number" min="0" name="min_stock_qty" value={formData.min_stock_qty} onChange={handleChange} />
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Sotto questa quantità scatta l'alert di riordino</p>
              </div>
              <div>
                <label className="sp-label">Giorni Riordino</label>
                <input className="sp-input" type="number" min="1" name="reorder_days" value={formData.reorder_days} onChange={handleChange} />
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Tempo medio di approvvigionamento dal fornitore</p>
              </div>
              <div>
                <label className="sp-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="auto_reorder_enabled"
                    checked={!!formData.auto_reorder_enabled}
                    onChange={handleChange}
                    style={{ width: 16, height: 16 }}
                  />
                  Riordino Automatico Abilitato
                </label>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 6 }}>Il sistema proporrà automaticamente l'ordine fornitore quando lo stock scende sotto la soglia</p>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0, background: 'var(--color-surface)' }}>
          <button type="button" className="sp-btn sp-btn-ghost" onClick={onClose}>Annulla</button>
          <button
            className="sp-btn sp-btn-primary"
            style={{ minWidth: 160 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <><Loader size={14} className="sp-spin" /> Salvataggio...</> : `${product ? 'Aggiorna' : 'Crea'} Prodotto`}
          </button>
        </div>
      </div>
    </div>
  );
}
