import React, { useEffect, useState, useMemo, useRef } from 'react';
import { X, Loader, Plus, Trash2, Barcode, MapPin, Package, Tag, DollarSign, Settings2, AlertTriangle, Upload, ImageIcon, FileText } from 'lucide-react';
import { catalog, getImageUrl } from '../api.jsx';

/* ─── Componente Upload Foto Prodotto ────────────────────── */
function ProductImageUpload({ currentImageUrl, onFileChange }) {
  const [preview, setPreview] = useState(currentImageUrl ? getImageUrl(currentImageUrl) : null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

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
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>Foto caricata ✓</p>
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

const TAX_CLASSES = [
  { value: '', label: 'Seleziona IVA...', rate: 0 },
  { value: '1', label: '22% — Standard',  rate: 22 },
  { value: '2', label: '10% — Ridotta',   rate: 10 },
  { value: '3', label: '4% — Agevolata',  rate: 4  },
];

const withVat = (net, rate) => {
  const n = parseFloat(net);
  if (!n || !rate) return '';
  return (n * (1 + rate / 100)).toFixed(2);
};
const withoutVat = (gross, rate) => {
  const g = parseFloat(gross);
  if (!g || !rate) return '';
  return (g / (1 + rate / 100)).toFixed(4);
};

const normalizeProductFlat = (product, storesList, selectedStoreId = '') => {
  const storeIds = Array.from(new Set((product?.variants || []).flatMap((v) =>
    (v.assigned_stores || []).map((s) => Number(s.store_id))
  )));
  const selectedStoreNumericId = selectedStoreId ? Number(selectedStoreId) : null;
  const defaultStoreIds = selectedStoreNumericId ? [selectedStoreNumericId] : storesList.map((s) => Number(s.id));

  const variant = product?.variants?.[0] || {}; // Utilizziamo e manteniamo solo la prima variante "master"

  return {
    // Info Base
    name: product?.name || '',
    sku: product?.sku || variant.sku || '',
    barcode: product?.barcode || variant.barcode || '',
    flavor: variant.flavor || '',
    
    category_id: product?.category_id ?? '',
    subcategory_id: '',
    product_type: product?.product_type || 'other',
    default_supplier_id: product?.default_supplier_id ?? '',
    
    // Prezzi
    sale_price: variant.sale_price ?? '',
    cost_price: variant.cost_price ?? '',
    tax_class_id: variant.tax_class_id ?? '',
    qscare_price: product?.qscare_price ?? '',

    // Fisco
    fiscal_group: product?.fiscal_group || 'Altro',
    excise_tax: product?.excise_tax ?? '',
    prevalence: product?.prevalence || '',
    
    // Magazzino
    min_stock_qty: product?.min_stock_qty ?? 0,
    reorder_days: product?.reorder_days ?? 30,
    auto_reorder_enabled: product?.auto_reorder_enabled ?? true,
    
    description: product?.description || '',
    store_ids: storeIds.length > 0 ? storeIds : defaultStoreIds,
    variant_id: variant.id || null, // teniamo traccia dell'ID variante per l'aggiornamento
  };
};

export default function CatalogModal({ product, storesList = [], suppliers = [], categories = [], selectedStoreId = '', onClose, onSave, isDipendente = false }) {
  const [formData, setFormData] = useState(() => normalizeProductFlat(product, storesList, selectedStoreId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    setFormData(normalizeProductFlat(product, storesList, selectedStoreId));
  }, [product?.id, selectedStoreId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

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

      // Mappatura Flat -> Struttura Backend
      Object.entries(formData).forEach(([k, v]) => {
        if (['variant_id', 'sale_price', 'cost_price', 'flavor', 'tax_class_id'].includes(k)) return; // gestiti a parte nelle varianti
        if (k === 'subcategory_id') return;
        if (k === 'category_id') {
          const finalCatId = formData.subcategory_id || v;
          appendValue(fd, 'category_id', finalCatId);
          return;
        }
        if (k === 'store_ids') {
          v.forEach(id => fd.append('store_ids[]', id));
          return;
        }
        appendValue(fd, k, v);
      });

      // Avvolge i campi flat specifici della variante 
      if (formData.variant_id) appendValue(fd, 'variants[0][id]', formData.variant_id);
      appendValue(fd, 'variants[0][sku]', formData.sku);
      appendValue(fd, 'variants[0][barcode]', formData.barcode);
      appendValue(fd, 'variants[0][sale_price]', formData.sale_price);
      appendValue(fd, 'variants[0][cost_price]', formData.cost_price);
      appendValue(fd, 'variants[0][tax_class_id]', formData.tax_class_id);
      appendValue(fd, 'variants[0][flavor]', formData.flavor);

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
        setError('Controlla i campi evidenziati in rosso.');
      } else {
        setError(err.response?.data?.message || err.message || 'Errore salvataggio');
      }
    } finally {
      setLoading(false);
    }
  };

  const fe = (field) => {
    const e = fieldErrors[field];
    if (e) return Array.isArray(e) ? e[0] : e || null;
    // Mappa errori varianti -> campi flat
    if (['sale_price', 'cost_price', 'tax_class_id'].includes(field)) {
       const ve = fieldErrors[`variants.0.${field}`];
       return Array.isArray(ve) ? ve[0] : ve || null;
    }
    return null;
  };
  const inputStyle = (field) => fe(field) ? { borderColor: 'var(--color-error)', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {};

  const parentCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const subCategories = useMemo(() => {
    if (!formData.category_id) return [];
    return categories.filter(c => c.parent_id === Number(formData.category_id));
  }, [categories, formData.category_id]);

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const cat = categories.find(c => String(c.id) === String(catId));
    const derivedType = cat
      ? (cat.name.toLowerCase().includes('liquid') ? 'liquid'
        : cat.name.toLowerCase().includes('device') || cat.name.toLowerCase().includes('disposit') || cat.name.toLowerCase().includes('hardware') || cat.name.toLowerCase().includes('mod') ? 'device'
        : 'other')
      : 'other';
    setFormData(prev => ({ ...prev, category_id: catId, subcategory_id: '', product_type: derivedType }));
  };

  const TABS = [{ id: 'info', label: 'Scheda Prodotto (Flat Layout)', icon: <FileText size={14} /> }];

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

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              {product ? 'Dettaglio Referenza' : 'Nuova Referenza Singola'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
              {product ? `ID: ${product.id} — Modifica i dati della referenza e salva per applicarli a database.` : 'Modulo semplificato 1:1 (senza varianti)'}
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

        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 24px', flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '14px 16px',
                fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'default',
                borderBottom: '2px solid var(--color-accent)',
                color: 'var(--color-accent)',
                whiteSpace: 'nowrap',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid #fca5a5', borderRadius: 8, color: 'var(--color-error)', fontSize: 13, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* BOX 1: Informazioni Principali */}
          <div style={{ background: 'var(--color-bg)', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identificazione</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repaeat(3, 1fr)', gap: 16 }}>
              <div style={{ gridColumn: '1 / span 3' }}>
                <label className="sp-label">Nome Referenza *</label>
                <input className="sp-input" name="name" value={formData.name} onChange={handleChange} required placeholder="Es: Liquido 10ml Menta Ghiaccio" style={inputStyle('name')} />
                {fe('name') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>{fe('name')}</p>}
              </div>
              <div style={{ gridColumn: '1 / span 1' }}>
                <label className="sp-label">SKU *</label>
                <input className="sp-input" name="sku" value={formData.sku} onChange={handleChange} required placeholder="Es: LIQ-MENTA-10ML" style={inputStyle('sku')} />
                {fe('sku') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>{fe('sku')}</p>}
              </div>
              <div style={{ gridColumn: '2 / span 1' }}>
                <label className="sp-label">Barcode (EAN / GTIN)</label>
                <div style={{ position: 'relative' }}>
                  <Barcode size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                  <input className="sp-input" name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Es: 8001234567890" style={{ paddingLeft: 36, ...inputStyle('barcode') }} />
                </div>
              </div>
              <div style={{ gridColumn: '3 / span 1' }}>
                <label className="sp-label">Gusto / Sapore / Variante Descrittiva</label>
                <input className="sp-input" name="flavor" value={formData.flavor} onChange={handleChange} placeholder="Es: Fragola e Kiwi" />
              </div>

              <div style={{ gridColumn: '1 / span 1' }}>
                <label className="sp-label">Categoria</label>
                <select className="sp-select" name="category_id" value={formData.category_id} onChange={handleCategoryChange}>
                  <option value="">— Seleziona Categoria —</option>
                  {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '2 / span 1' }}>
                <label className="sp-label">Sottocategoria</label>
                <select className="sp-select" name="subcategory_id" value={formData.subcategory_id} onChange={(e) => setFormData(p => ({ ...p, subcategory_id: e.target.value }))} disabled={subCategories.length === 0}>
                  <option value="">{subCategories.length === 0 ? '— N.A. —' : '— Seleziona —'}</option>
                  {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '3 / span 1' }}>
                <label className="sp-label">Fornitore Predefinito</label>
                <select className="sp-select" name="default_supplier_id" value={formData.default_supplier_id} onChange={handleChange}>
                  <option value="">— Seleziona —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* BOX 2: Prezzi & Magazzino */}
          <div style={{ background: 'var(--color-bg)', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distribuzione & Prezzi</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              
              <div>
                <label className="sp-label">Classe IVA</label>
                <select className="sp-select" name="tax_class_id" value={formData.tax_class_id} onChange={handleChange} style={inputStyle('tax_class_id')}>
                  {TAX_CLASSES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              
              <div>
                <label className="sp-label">Prezzo Consigliato. (EUR) *</label>
                <div style={{ position: 'relative' }}>
                  <input className="sp-input" type="number" step="0.01" name="sale_price" 
                    value={(() => { const tc = TAX_CLASSES.find(t => String(t.value) === String(formData.tax_class_id)); return tc?.rate ? withVat(formData.sale_price, tc.rate) : formData.sale_price; })()} 
                    onChange={e => { const tc = TAX_CLASSES.find(t => String(t.value) === String(formData.tax_class_id)); setFormData(p => ({ ...p, sale_price: tc?.rate ? withoutVat(e.target.value, tc.rate) : e.target.value })); }} 
                    placeholder="0.00" disabled={isDipendente} style={{ fontWeight: 700, paddingRight: 80, ...inputStyle('sale_price') }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', borderRadius: 5, padding: '2px 6px' }}>IVA incl.</span>
                </div>
                {fe('sale_price') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{fe('sale_price')}</p>}
              </div>

              <div>
                <label className="sp-label">Prezzo di Costo (EUR)</label>
                <input className="sp-input" type="number" step="0.01" name="cost_price" value={formData.cost_price} onChange={handleChange} placeholder="0.00" disabled={isDipendente} style={inputStyle('cost_price')} />
              </div>

              <div>
                <label className="sp-label">Stock Min. Alert</label>
                <input className="sp-input" type="number" min="0" name="min_stock_qty" value={formData.min_stock_qty} onChange={handleChange} />
              </div>

            </div>
          </div>

          {/* BOX 3: Fiscale & Accise */}
          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(52, 211, 153, 0.03))', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 16px', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarSign size={16} /> Assetto Fiscale & Stampante
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div>
                <label className="sp-label" style={{ color: '#047857' }}>Gruppo Fiscale (Registratore di cassa)</label>
                <select className="sp-select" name="fiscal_group" value={formData.fiscal_group} onChange={handleChange} style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <option value="Altro">Altro (Nessun Reparto Specifico)</option>
                  <option value="PLN">PLN (Liquidi con Nicotina)</option>
                  <option value="PL0">PL0 (Liquidi senza Nicotina)</option>
                  <option value="Hardware">Hardware e Dispositivi</option>
                </select>
                <p style={{ fontSize: 11, color: '#059669', opacity: 0.8, margin: '4px 0 0' }}>Determina la categoria stampata nello scontrino fiscale.</p>
              </div>
              
              <div>
                <label className="sp-label" style={{ color: '#047857' }}>Accisa (EUR/ml) *Opzionale</label>
                <input className="sp-input" type="number" step="0.001" name="excise_tax" value={formData.excise_tax} onChange={handleChange} placeholder="Es: 0.13" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }} />
                <p style={{ fontSize: 11, color: '#059669', opacity: 0.8, margin: '4px 0 0' }}>Valore fisso accisa. Utile per future azioni massive.</p>
              </div>

              <div>
                <label className="sp-label" style={{ color: '#047857' }}>Prevalenza (Monopolio)</label>
                <input className="sp-input" name="prevalence" value={formData.prevalence} onChange={handleChange} placeholder="Es: Prevalenzata Tabacco" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }} />
                <p style={{ fontSize: 11, color: '#059669', opacity: 0.8, margin: '4px 0 0' }}>Marcatore prevalenza per eventuali comunicazioni.</p>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="sp-label">Foto Prodotto</label>
              <ProductImageUpload currentImageUrl={product?.image_url} onFileChange={(file) => setImageFile(file)} />
            </div>
            
            {/* Stores assignment */}
            {storesList.length > 1 && (
              <div style={{ gridColumn: '1/-1', background: 'var(--color-bg)', padding: 16, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <label className="sp-label" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14}/> Disponibilità Negozi</label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {storesList.map(store => (
                    <label key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', background: 'var(--color-surface)', padding: '6px 12px', border: formData.store_ids.includes(Number(store.id)) ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)', borderRadius: 20, color: formData.store_ids.includes(Number(store.id)) ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontWeight: formData.store_ids.includes(Number(store.id)) ? 700 : 500, transition: 'all 0.15s' }}>
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
                        style={{ display: 'none' }}
                      />
                      {store.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

        </form>

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
