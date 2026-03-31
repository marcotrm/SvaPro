import React, { useEffect, useState } from 'react';
import { X, Loader } from 'lucide-react';
import { catalog } from '../api.jsx';

const PRODUCT_TYPES = [
  { value: 'liquid', label: 'Liquido' },
  { value: 'device', label: 'Device' },
  { value: 'accessory', label: 'Accessorio' },
  { value: 'consumable', label: 'Consumabile' },
  { value: 'other', label: 'Altro' },
];

const createEmptyVariant = () => ({
  sale_price: '',
  cost_price: '',
  pack_size: 1,
  flavor: '',
  resistance_ohm: '',
  tax_class_id: '',
  excise_profile_code: '',
  excise_unit_amount_override: '',
  prevalenza_code: '',
  prevalenza_label: '',
});

const normalizeVariant = (variant = {}) => ({
  id: variant.id,
  sale_price: variant.sale_price ?? '',
  cost_price: variant.cost_price ?? '',
  pack_size: variant.pack_size ?? 1,
  flavor: variant.flavor ?? '',
  resistance_ohm: variant.resistance_ohm ?? '',
  tax_class_id: variant.tax_class_id ?? '',
  excise_profile_code: variant.excise_profile_code ?? '',
  excise_unit_amount_override: variant.excise_unit_amount_override ?? '',
  prevalenza_code: variant.prevalenza_code ?? '',
  prevalenza_label: variant.prevalenza_label ?? '',
});

const normalizeProduct = (product, storesList, selectedStoreId = '') => {
  const storeIds = Array.from(new Set((product?.variants || []).flatMap((variant) =>
    (variant.assigned_stores || []).map((store) => Number(store.store_id))
  )));

  const selectedStoreNumericId = selectedStoreId ? Number(selectedStoreId) : null;
  const defaultStoreIds = selectedStoreNumericId ? [selectedStoreNumericId] : storesList.map((store) => Number(store.id));

  return {
    sku: product?.sku || '',
    name: product?.name || '',
    product_type: product?.product_type || 'liquid',
    pli_code: product?.pli_code || '',
    barcode: product?.barcode || '',
    default_supplier_id: product?.default_supplier_id ?? '',
    nicotine_mg: product?.nicotine_mg ?? '',
    volume_ml: product?.volume_ml ?? '',
    reorder_days: product?.reorder_days ?? 30,
    min_stock_qty: product?.min_stock_qty ?? 0,
    auto_reorder_enabled: product?.auto_reorder_enabled ?? true,
    store_ids: storeIds.length > 0 ? storeIds : defaultStoreIds,
    image_url: product?.image_url || null,
    image: null,
    variants: product?.variants?.length ? product.variants.map(normalizeVariant) : [createEmptyVariant()],
  };
};

export default function CatalogModal({ product, storesList = [], suppliers = [], selectedStoreId = '', onClose, onSave }) {
  const [formData, setFormData] = useState(() => normalizeProduct(product, storesList, selectedStoreId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // imagePreview state for local file selection
  const [imagePreview, setImagePreview] = useState(product?.image_url || null);

  useEffect(() => {
    setFormData(normalizeProduct(product, storesList, selectedStoreId));
    setImagePreview(product?.image_url || null);
  }, [product, storesList, selectedStoreId]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, image: file }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData(prev => ({ ...prev, [name]: nextValue }));
  };

  const handleVariantChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, [field]: value } : variant
      )),
    }));
  };

  const handleAddVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, createEmptyVariant()],
    }));
  };

  const handleRemoveVariant = (index) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  };

  const handleStoreToggle = (storeId) => {
    setFormData((prev) => {
      const exists = prev.store_ids.includes(storeId);
      return {
        ...prev,
        store_ids: exists
          ? prev.store_ids.filter((currentId) => currentId !== storeId)
          : [...prev.store_ids, storeId],
      };
    });
  };

  const buildPayload = () => {
    const fd = new FormData();
    fd.append('sku', formData.sku);
    fd.append('name', formData.name);
    fd.append('product_type', formData.product_type);
    if (formData.pli_code) fd.append('pli_code', formData.pli_code);
    if (formData.barcode) fd.append('barcode', formData.barcode);
    if (formData.default_supplier_id !== '') fd.append('default_supplier_id', formData.default_supplier_id);
    if (formData.nicotine_mg !== '') fd.append('nicotine_mg', formData.nicotine_mg);
    if (formData.volume_ml !== '') fd.append('volume_ml', formData.volume_ml);
    fd.append('auto_reorder_enabled', formData.auto_reorder_enabled ? '1' : '0');
    fd.append('reorder_days', formData.reorder_days || 30);
    fd.append('min_stock_qty', formData.min_stock_qty || 0);

    formData.store_ids.forEach(id => fd.append('store_ids[]', id));

    formData.variants.forEach((variant, index) => {
      if (variant.id) fd.append(`variants[${index}][id]`, variant.id);
      fd.append(`variants[${index}][sale_price]`, Number(variant.sale_price || 0));
      fd.append(`variants[${index}][cost_price]`, Number(variant.cost_price || 0));
      fd.append(`variants[${index}][pack_size]`, Number(variant.pack_size || 1));
      if (variant.flavor) fd.append(`variants[${index}][flavor]`, variant.flavor);
      if (variant.resistance_ohm) fd.append(`variants[${index}][resistance_ohm]`, variant.resistance_ohm);
      if (variant.tax_class_id !== '') fd.append(`variants[${index}][tax_class_id]`, variant.tax_class_id);
      if (variant.excise_profile_code) fd.append(`variants[${index}][excise_profile_code]`, variant.excise_profile_code);
      if (variant.excise_unit_amount_override !== '') fd.append(`variants[${index}][excise_unit_amount_override]`, variant.excise_unit_amount_override);
      if (variant.prevalenza_code) fd.append(`variants[${index}][prevalenza_code]`, variant.prevalenza_code);
      if (variant.prevalenza_label) fd.append(`variants[${index}][prevalenza_label]`, variant.prevalenza_label);
    });

    if (formData.image) {
      fd.append('image', formData.image);
    }
    
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (formData.store_ids.length === 0) {
        setError('Seleziona almeno uno store abilitato.');
        setLoading(false);
        return;
      }

      if (formData.variants.length === 0) {
        setError('Inserisci almeno una variante.');
        setLoading(false);
        return;
      }

      const payload = buildPayload();
      
      if (product?.id) {
        await catalog.updateProduct(product.id, payload);
      } else {
        await catalog.createProduct(payload);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.sku?.[0] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white modal-light rounded-lg shadow-xl w-full max-w-5xl max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {product ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Prodotto *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Prodotto</label>
              <select
                name="product_type"
                value={formData.product_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice a Barre (Barcode)</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Scansiona qui..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PLI Code</label>
              <input
                type="text"
                name="pli_code"
                value={formData.pli_code}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Immagine Prodotto</label>
              <div className="mt-1 flex items-center gap-4 p-3 border-2 border-dashed border-gray-200 rounded-xl">
                {formData.image_url || imagePreview ? (
                  <img src={imagePreview || formData.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow-sm border border-gray-100" />
                ) : (
                  <div className="w-16 h-16 bg-gray-50 flex items-center justify-center rounded-lg text-gray-400">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornitore Predefinito</label>
                <select name="default_supplier_id" value={formData.default_supplier_id} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                  <option value="">Nessuno</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 cursor-pointer">
                <input
                  type="checkbox"
                  name="auto_reorder_enabled"
                  checked={Boolean(formData.auto_reorder_enabled)}
                  onChange={handleChange}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Abilita Riordino Automatico
              </label>
            </div>
          </div>

          <details className="group border-t border-gray-100 pt-4">
            <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-indigo-600 hover:text-indigo-700">
              <span>Caratteristiche Tecniche (Nicotina, Volume, Riordino)</span>
              <span className="transition group-open:rotate-180">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7"/></svg>
              </span>
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nicotina (mg)</label>
                <input type="number" name="nicotine_mg" value={formData.nicotine_mg} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Volume (ml)</label>
                <input type="number" name="volume_ml" value={formData.volume_ml} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Lead Time (Giorni)</label>
                <input type="number" name="reorder_days" value={formData.reorder_days} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Stock</label>
                <input type="number" name="min_stock_qty" value={formData.min_stock_qty} onChange={handleChange} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
          </details>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Store abilitati</label>
              <span className="text-xs text-gray-500">{formData.store_ids.length} selezionati</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {storesList.map((store) => (
                <label key={store.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.store_ids.includes(Number(store.id))}
                    onChange={() => handleStoreToggle(Number(store.id))}
                  />
                  <span>{store.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Varianti</div>
                <div className="text-xs text-gray-500">Prezzi, accise e metadati prevalenza</div>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
              >
                Aggiungi variante
              </button>
            </div>

            {formData.variants.map((variant, index) => (
              <div key={variant.id || index} className="rounded-xl border border-gray-200 p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800">Variante {index + 1}</div>
                  {formData.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(index)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo vendita</label>
                    <input type="number" min="0" step="0.01" value={variant.sale_price} onChange={(e) => handleVariantChange(index, 'sale_price', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo</label>
                    <input type="number" min="0" step="0.01" value={variant.cost_price} onChange={(e) => handleVariantChange(index, 'cost_price', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pack size</label>
                    <input type="number" min="1" value={variant.pack_size} onChange={(e) => handleVariantChange(index, 'pack_size', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Flavor</label>
                    <input type="text" value={variant.flavor} onChange={(e) => handleVariantChange(index, 'flavor', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resistenza ohm</label>
                    <input type="text" value={variant.resistance_ohm} onChange={(e) => handleVariantChange(index, 'resistance_ohm', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax class ID</label>
                    <input type="number" min="1" value={variant.tax_class_id} onChange={(e) => handleVariantChange(index, 'tax_class_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profilo accisa</label>
                    <input type="text" value={variant.excise_profile_code} onChange={(e) => handleVariantChange(index, 'excise_profile_code', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="LIQUID-IT" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Override accisa unitario</label>
                    <input type="number" min="0" step="0.01" value={variant.excise_unit_amount_override} onChange={(e) => handleVariantChange(index, 'excise_unit_amount_override', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Codice prevalenza</label>
                    <input type="text" value={variant.prevalenza_code} onChange={(e) => handleVariantChange(index, 'prevalenza_code', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="PV-LIQ" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione prevalenza</label>
                  <input type="text" value={variant.prevalenza_label} onChange={(e) => handleVariantChange(index, 'prevalenza_label', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Liquidi pronta vendita" />
                </div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
