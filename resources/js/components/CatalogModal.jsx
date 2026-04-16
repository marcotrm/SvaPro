import React, { useEffect, useState, useMemo, useRef } from 'react';
import { X, Loader, Plus, Trash2, Barcode, MapPin, Package, Tag, DollarSign, Settings2, AlertTriangle, Upload, ImageIcon } from 'lucide-react';
import { catalog, getImageUrl } from '../api.jsx';

/* â”€â”€â”€ Componente Upload Foto Prodotto â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ProductImageUpload({ currentImageUrl, onFileChange }) {
  const [preview, setPreview] = useState(currentImageUrl ? getImageUrl(currentImageUrl) : null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  // Aggiorna preview se arriva un prodotto esistente con foto
  useEffect(() => { setPreview(currentImageUrl ? getImageUrl(currentImageUrl) : null); }, [currentImageUrl]);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { alert('Foto troppo grande. Massimo 2MB.'); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onFileChange(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreview(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />
      {preview ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={preview} alt="Anteprima prodotto"
              style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '2px solid var(--color-border)', display: 'block' }} />
            <button type="button" onClick={handleRemove}
              style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              ×
            </button>
          </div>
          <div style={{ paddingTop: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Foto caricata âœ“</p>
            <button type="button" onClick={() => inputRef.current?.click()}
              style={{ fontSize: 12, color: 'var(--color-accent)', background: 'none', border: '1px solid var(--color-accent)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
              Cambia foto
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'rgba(155,143,212,0.08)' : 'var(--color-bg)',
            transition: 'all 0.15s', minHeight: 100, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <ImageIcon size={28} style={{ color: 'var(--color-text-tertiary)' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Trascina una foto o <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>clicca per caricare</span></p>
          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>JPG, PNG, WebP. Max 2MB.</p>
        </div>
      )}
    </div>
  );
}

// product_type viene derivato automaticamente dalla categoria, non esposto all'utente

const TAX_CLASSES = [
  { value: '', label: 'Seleziona IVA...', rate: 0 },
  { value: '1', label: '22% — Standard',  rate: 22 },
  { value: '2', label: '10% — Ridotta',   rate: 10 },
  { value: '3', label: '4% — Agevolata',  rate: 4  },
];

// Dato prezzo netto e aliquota IVA, restituisce il prezzo ivato
const withVat = (net, rate) => {
  const n = parseFloat(net);
  if (!n || !rate) return '';
  return (n * (1 + rate / 100)).toFixed(2);
};
// Dato prezzo ivato e aliquota, restituisce il netto
const withoutVat = (gross, rate) => {
  const g = parseFloat(gross);
  if (!g || !rate) return '';
  return (g / (1 + rate / 100)).toFixed(4);
};

const createEmptyVariant = () => ({
  sku: '',
  sale_price: '',
  cost_price: '',
  price_list_2: '',
  price_list_3: '',
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
  cli_code: '',
});

const normalizeVariant = (v = {}) => ({
  id: v.id,
  sku: v.sku ?? '',
  sale_price: v.sale_price ?? '',
  cost_price: v.cost_price ?? '',
  price_list_2: v.price_list_2 ?? '',
  price_list_3: v.price_list_3 ?? '',
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
  cli_code: v.cli_code ?? '',
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
    product_type: product?.product_type || 'other',
    category_id: product?.category_id ?? '',
    subcategory_id: '',
    barcode: product?.barcode || '',
    pli_code: product?.pli_code || '',
    denominazione_prodotto: product?.denominazione_prodotto || '',
    numero_confezioni: product?.numero_confezioni ?? '',
    default_supplier_id: product?.default_supplier_id ?? '',
    nicotine_mg: product?.nicotine_mg ?? '',
    volume_ml: product?.volume_ml ?? '',
    reorder_days: product?.reorder_days ?? 30,
    min_stock_qty: product?.min_stock_qty ?? 0,
    auto_reorder_enabled: product?.auto_reorder_enabled ?? true,
    description: product?.description || '',
    qscare_price: product?.qscare_price ?? '',
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
  const [imageFile, setImageFile] = useState(null); // foto prodotto da caricare

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
        // subcategory_id non è un campo backend: lo usiamo per sovrascrivere category_id se valorizzato
        if (k === 'subcategory_id') return;
        if (k === 'category_id') {
          // Se l'utente ha scelto una sottocategoria, quella vince
          const finalCatId = formData.subcategory_id || v;
          appendValue(fd, 'category_id', finalCatId);
          return;
        }
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

      // Allega foto prodotto se selezionata
      if (imageFile) {
        fd.append('image', imageFile);
      }

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
        // Vai sul tab con il primo errore
        const firstKey = Object.keys(serverErrors)[0];
        if (firstKey?.startsWith('variants')) setActiveTab('variants');
        else setActiveTab('info');
        setError('Controlla i campi evidenziati in rosso.');
      } else {
        setError(err.response?.data?.message || err.message || 'Errore salvataggio');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper: errore per campo prodotto
  const fe = (field) => {
    const e = fieldErrors[field];
    return Array.isArray(e) ? e[0] : e || null;
  };

  // Helper: stile input con errore
  const inputStyle = (field) => fe(field) ? { borderColor: 'var(--color-error)', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {};

  // Helper: errore per variante
  const fv = (idx, field) => {
    const k = `variants.${idx}.${field}`;
    const e = fieldErrors[k];
    return Array.isArray(e) ? e[0] : e || null;
  };
  const inputStyleV = (idx, field) => fv(idx, field) ? { borderColor: 'var(--color-error)', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {};


  // Categorie padre (senza parent_id)
  const parentCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);

  // Sottocategorie filtrate in base alla categoria padre selezionata
  const subCategories = useMemo(() => {
    if (!formData.category_id) return [];
    return categories.filter(c => c.parent_id === Number(formData.category_id));
  }, [categories, formData.category_id]);

  // Quando l'utente cambia la categoria padre, resetta la sottocategoria
  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    // Deriva product_type dal nome della categoria (fallback 'other')
    const cat = categories.find(c => String(c.id) === String(catId));
    const derivedType = cat
      ? (cat.name.toLowerCase().includes('liquid') ? 'liquid'
        : cat.name.toLowerCase().includes('device') || cat.name.toLowerCase().includes('disposit') || cat.name.toLowerCase().includes('hardware') || cat.name.toLowerCase().includes('mod') ? 'device'
        : cat.name.toLowerCase().includes('access') ? 'accessory'
        : cat.name.toLowerCase().includes('coil') || cat.name.toLowerCase().includes('cotton') ? 'consumable'
        : 'other')
      : 'other';
    setFormData(prev => ({ ...prev, category_id: catId, subcategory_id: '', product_type: derivedType }));
  };

  const handleSubCategoryChange = (e) => {
    const subId = e.target.value;
    // La sottocategoria diventa il category_id finale inviato al backend
    setFormData(prev => ({ ...prev, subcategory_id: subId }));
  };

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
                <input className="sp-input" name="name" value={formData.name} onChange={handleChange} required placeholder="Es: Liquido 10ml Menta Ghiaccio" style={inputStyle('name')} />
                {fe('name') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>{fe('name')}</p>}
              </div>
              <div>
                <label className="sp-label">SKU Master *</label>
                <input className="sp-input" name="sku" value={formData.sku} onChange={handleChange} required placeholder="Es: LIQ-MENTA-10ML" style={inputStyle('sku')} />
                {fe('sku') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>{fe('sku')}</p>}
              </div>
              <div>
                <label className="sp-label">Barcode Prodotto (EAN / GTIN)</label>
                <div style={{ position: 'relative' }}>
                  <Barcode size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                  <input className="sp-input" name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Es: 8001234567890" style={{ paddingLeft: 36 }} />
                </div>
              </div>
              <div>
                <label className="sp-label">Categoria</label>
                <select className="sp-select" name="category_id" value={formData.category_id} onChange={handleCategoryChange}>
                  <option value="">— Seleziona Categoria —</option>
                  {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Sottocategoria</label>
                <select
                  className="sp-select"
                  name="subcategory_id"
                  value={formData.subcategory_id}
                  onChange={handleSubCategoryChange}
                  disabled={subCategories.length === 0}
                >
                  <option value="">{subCategories.length === 0 ? '— Nessuna sottocategoria —' : '— Seleziona Sottocategoria —'}</option>
                  {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="sp-label">Fornitore Predefinito</label>
                <select className="sp-select" name="default_supplier_id" value={formData.default_supplier_id} onChange={handleChange}>
                  <option value="">— Seleziona Fornitore —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {(formData.product_type === 'device' || (() => {
                const cat = categories.find(c => String(c.id) === String(formData.subcategory_id || formData.category_id));
                const n = cat?.name?.toLowerCase() || '';
                return n.includes('hardware') || n.includes('device') || n.includes('disposit') || n.includes('mod');
              })()) && (
                <div style={{ gridColumn: '1/-1', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))', border: '1.5px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>🛡️</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>QScare — Garanzia Hardware</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Prezzo assicurazione per questo hardware (solo prodotti di tipo dispositivo)</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', marginLeft: 'auto' }}>
                      <input type="checkbox"
                        checked={formData.qscare_price !== '' && formData.qscare_price !== null}
                        onChange={(e) => {
                          setFormData(p => ({ ...p, qscare_price: e.target.checked ? '9.90' : '' }));
                        }}
                      />
                      Abilita QScare
                    </label>
                  </div>
                  {formData.qscare_price !== '' && formData.qscare_price !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(99,102,241,0.1)' }}>
                      <div style={{ position: 'relative', maxWidth: 200 }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: 14 }}>€</span>
                        <input
                          className="sp-input"
                          type="number"
                          step="0.01"
                          min="0"
                          name="qscare_price"
                          value={formData.qscare_price}
                          onChange={handleChange}
                          placeholder="Es: 9.90"
                          style={{ paddingLeft: 28, fontWeight: 700 }}
                        />
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>Imposta il prezzo della garanzia. Il toggle apparirà nel POS durante la vendita.</p>
                    </div>
                  )}
                </div>
              )}
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label">Foto Prodotto</label>
                <ProductImageUpload
                  currentImageUrl={product?.image_url}
                  onFileChange={(file) => setImageFile(file)}
                />
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
                      <label className="sp-label">SKU Variante</label>
                      <input className="sp-input" value={v.sku} onChange={e => handleVariantChange(idx, 'sku', e.target.value)} placeholder="Es: KWI-BLU" style={{ fontFamily: 'monospace' }} />
                    </div>
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
                      <label className="sp-label">💰 Listino 1 — Prezzo Vendita IVA incl. (€) *</label>
                      <div style={{ position: 'relative' }}>
                        <input className="sp-input" type="number" step="0.01"
                          value={(() => {
                            const tc = TAX_CLASSES.find(t => String(t.value) === String(v.tax_class_id));
                            return tc?.rate ? withVat(v.sale_price, tc.rate) : v.sale_price;
                          })()}
                          onChange={e => {
                            const tc = TAX_CLASSES.find(t => String(t.value) === String(v.tax_class_id));
                            // Salvo sempre il netto nel form
                            const net = tc?.rate ? withoutVat(e.target.value, tc.rate) : e.target.value;
                            handleVariantChange(idx, 'sale_price', net);
                          }}
                          placeholder="0.00" style={{ fontWeight: 700, paddingRight: 90, ...inputStyleV(idx, 'sale_price') }} />
                        <span style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          fontSize: 10, fontWeight: 700, color: '#10b981',
                          background: 'rgba(16,185,129,0.1)', borderRadius: 5, padding: '2px 6px',
                        }}>IVA incl.</span>
                      </div>
                      {v.sale_price && (() => {
                        const tc = TAX_CLASSES.find(t => String(t.value) === String(v.tax_class_id));
                        return tc?.rate ? (
                          <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>
                            Imponibile (netto): €{parseFloat(v.sale_price).toFixed(2)} · IVA {tc.rate}%: €{(parseFloat(v.sale_price) * tc.rate / 100).toFixed(2)}
                          </p>
                        ) : (
                          <p style={{ fontSize: 11, color: '#F59E0B', marginTop: 3 }}>⚠ Seleziona la Classe IVA per calcolare il prezzo ivato</p>
                        );
                      })()}
                      {fv(idx, 'sale_price') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{fv(idx, 'sale_price')}</p>}
                    </div>
                    <div>
                      <label className="sp-label">💰 Listino 2 (es. Ingrosso) (€)</label>
                      <input className="sp-input" type="number" step="0.01" value={v.price_list_2}
                        onChange={e => handleVariantChange(idx, 'price_list_2', e.target.value)}
                        placeholder="0.00" />
                    </div>
                    <div>
                      <label className="sp-label">💰 Listino 3 (es. Promo/Staff) (€)</label>
                      <input className="sp-input" type="number" step="0.01" value={v.price_list_3}
                        onChange={e => handleVariantChange(idx, 'price_list_3', e.target.value)}
                        placeholder="0.00" />
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
                <label className="sp-label">Codice PLI (Accise)</label>
                <input className="sp-input" name="pli_code" value={formData.pli_code} onChange={handleChange} placeholder="Es: 9041" style={{ fontFamily: 'monospace' }} />
              </div>
              <div>
                <label className="sp-label">Denominazione Prodotto</label>
                <input className="sp-input" name="denominazione_prodotto" value={formData.denominazione_prodotto} onChange={handleChange} placeholder="Es: Preparazione per sigaretta elettronica" />
              </div>
              <div>
                <label className="sp-label">Nicotina (mg/ml)</label>
                <input className="sp-input" type="number" step="0.1" name="nicotine_mg" value={formData.nicotine_mg} onChange={handleChange} placeholder="Es: 3" />
              </div>
              <div>
                <label className="sp-label">Capacità della confezione (ml)</label>
                <input className="sp-input" type="number" step="1" name="volume_ml" value={formData.volume_ml} onChange={handleChange} placeholder="Es: 10" />
              </div>
              <div>
                <label className="sp-label">Numero Confezioni</label>
                <input className="sp-input" type="number" step="1" min="0" name="numero_confezioni" value={formData.numero_confezioni} onChange={handleChange} placeholder="Es: 10" />
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '3px 0 0' }}>Numero di confezioni per unità di vendita</p>
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
                        <label className="sp-label">ðŸ”‘ Codice CLI (Accise Doganali)</label>
                        <input
                          className="sp-input"
                          value={v.cli_code}
                          onChange={e => handleVariantChange(idx, 'cli_code', e.target.value)}
                          placeholder="Es: CLI-IT-00123"
                          style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: 0 }}>Codice identificativo per la liquidazione accise doganali.</p>
                        </div>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label className="sp-label">Prevalenza Tabaccosa</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          {[
                            { val: 'PREVALENZA_SI', label: 'Sì — Prevalenza tabaccosa' },
                            { val: '',              label: 'No — Non applicabile' },
                          ].map(opt => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => { handleVariantChange(idx, 'prevalenza_code', opt.val); handleVariantChange(idx, 'prevalenza_label', opt.val ? 'Tabacco prevalente' : ''); }}
                              style={{
                                flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                                fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                                border: v.prevalenza_code === opt.val ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
                                background: v.prevalenza_code === opt.val ? 'var(--color-accent-light)' : 'var(--color-surface)',
                                color: v.prevalenza_code === opt.val ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
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
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Quantità minima sotto cui scatta l'allerta riassortimento.</p>
              </div>
              <div>
                <label className="sp-label">Giorni Riordino</label>
                <input className="sp-input" type="number" min="1" name="reorder_days" value={formData.reorder_days} onChange={handleChange} />
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Giorni stimati per ricevere un nuovo riordino dal fornitore.</p>
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
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>Se abilitato, genera automaticamente un ordine di riassortimento al raggiungimento dello stock minimo.</p>
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
