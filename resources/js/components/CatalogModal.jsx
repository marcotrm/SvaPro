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

const normalizeProduct = (product, storesList) => {
  const storeIds = Array.from(new Set((product?.variants || []).flatMap((variant) =>
    (variant.assigned_stores || []).map((store) => Number(store.store_id))
  )));

  return {
    sku: product?.sku || '',
    name: product?.name || '',
    product_type: product?.product_type || 'liquid',
    barcode: product?.barcode || '',
    default_supplier_id: product?.default_supplier_id ?? '',
    nicotine_mg: product?.nicotine_mg ?? '',
    volume_ml: product?.volume_ml ?? '',
    reorder_days: product?.reorder_days ?? 30,
    min_stock_qty: product?.min_stock_qty ?? 0,
    auto_reorder_enabled: product?.auto_reorder_enabled ?? true,
    store_ids: storeIds.length > 0 ? storeIds : storesList.map((store) => Number(store.id)),
    variants: product?.variants?.length ? product.variants.map(normalizeVariant) : [createEmptyVariant()],
  };
};

export default function CatalogModal({ product, storesList = [], onClose, onSave }) {
  const [formData, setFormData] = useState(() => normalizeProduct(product, storesList));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(normalizeProduct(product, storesList));
  }, [product, storesList]);

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

  const buildPayload = () => ({
    sku: formData.sku,
    name: formData.name,
    product_type: formData.product_type,
    barcode: formData.barcode || null,
    default_supplier_id: formData.default_supplier_id === '' ? null : Number(formData.default_supplier_id),
    nicotine_mg: formData.nicotine_mg === '' ? null : Number(formData.nicotine_mg),
    volume_ml: formData.volume_ml === '' ? null : Number(formData.volume_ml),
    auto_reorder_enabled: Boolean(formData.auto_reorder_enabled),
    reorder_days: Number(formData.reorder_days || 30),
    min_stock_qty: Number(formData.min_stock_qty || 0),
    store_ids: formData.store_ids,
    variants: formData.variants.map((variant) => ({
      ...(variant.id ? { id: variant.id } : {}),
      sale_price: Number(variant.sale_price || 0),
      cost_price: Number(variant.cost_price || 0),
      pack_size: Number(variant.pack_size || 1),
      flavor: variant.flavor || null,
      resistance_ohm: variant.resistance_ohm || null,
      tax_class_id: variant.tax_class_id === '' ? null : Number(variant.tax_class_id),
      excise_profile_code: variant.excise_profile_code || null,
      excise_unit_amount_override: variant.excise_unit_amount_override === '' ? null : Number(variant.excise_unit_amount_override),
      prevalenza_code: variant.prevalenza_code || null,
      prevalenza_label: variant.prevalenza_label || null,
    })),
  });

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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-screen overflow-y-auto">
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo prodotto</label>
              <select
                name="product_type"
                value={formData.product_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PRODUCT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
              <input
                type="number"
                min="1"
                name="default_supplier_id"
                value={formData.default_supplier_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume ml</label>
              <input
                type="number"
                min="0"
                name="volume_ml"
                value={formData.volume_ml}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nicotina mg</label>
              <input
                type="number"
                min="0"
                name="nicotine_mg"
                value={formData.nicotine_mg}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giorni riordino</label>
              <input
                type="number"
                min="1"
                name="reorder_days"
                value={formData.reorder_days}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock minimo</label>
              <input
                type="number"
                min="0"
                name="min_stock_qty"
                value={formData.min_stock_qty}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="auto_reorder_enabled"
              checked={Boolean(formData.auto_reorder_enabled)}
              onChange={handleChange}
            />
            Riordino automatico abilitato
          </label>

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
