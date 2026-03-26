import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader, Plus, Trash2 } from 'lucide-react';
import { orders } from '../api.jsx';

const createLine = () => ({
  product_variant_id: '',
  qty: 1,
  unit_price: '',
  discount: 0,
});

export default function OrderModal({ order, selectedStoreId = '', onClose, onSave }) {
  const [formData, setFormData] = useState({
    channel: order?.channel || 'pos',
    status: order?.status || 'paid',
    payment_method: order?.payment_method || 'cash',
    customer_id: order?.customer_id || '',
    employee_id: order?.employee_id || '',
    warehouse_id: order?.warehouse_id || '',
    store_id: order?.store_id || selectedStoreId || '',
    lines: [createLine()],
  });

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [options, setOptions] = useState({
    customers: [],
    employees: [],
    warehouses: [],
    variants: [],
  });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setOptionsLoading(true);
        setOptionsError('');
        const params = selectedStoreId ? { store_id: selectedStoreId } : {};
        const res = await orders.getOptions(params);
        setOptions(res.data?.data || { customers: [], employees: [], warehouses: [], variants: [] });
      } catch (err) {
        setOptionsError(err.response?.data?.message || err.message || 'Errore caricamento opzioni ordine');
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, [selectedStoreId]);

  const variantMap = useMemo(() => {
    const map = new Map();
    for (const variant of options.variants || []) {
      map.set(String(variant.id), variant);
    }
    return map;
  }, [options.variants]);

  const handleRootChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const updateLine = (index, next) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...next } : line)),
    }));
  };

  const addLine = () => {
    setFormData((prev) => ({ ...prev, lines: [...prev.lines, createLine()] }));
  };

  const removeLine = (index) => {
    setFormData((prev) => {
      if (prev.lines.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
      };
    });
  };

  const onVariantChange = (index, variantId) => {
    const selected = variantMap.get(String(variantId));
    updateLine(index, {
      product_variant_id: variantId,
      unit_price: selected?.sale_price ?? '',
    });
  };

  const lineTotals = useMemo(() => {
    return formData.lines.map((line) => {
      const qty = Number(line.qty || 0);
      const unitPrice = Number(line.unit_price || 0);
      const discount = Number(line.discount || 0);
      return Math.max(0, qty * unitPrice - discount);
    });
  }, [formData.lines]);

  const subtotal = useMemo(() => {
    return lineTotals.reduce((sum, value) => sum + value, 0);
  }, [lineTotals]);

  const buildPayload = () => {
    const normalizedLines = formData.lines
      .map((line) => ({
        product_variant_id: Number(line.product_variant_id),
        qty: Number(line.qty),
        unit_price: Number(line.unit_price || 0),
        discount: Number(line.discount || 0),
      }))
      .filter((line) => Number.isFinite(line.product_variant_id) && line.product_variant_id > 0 && Number.isFinite(line.qty) && line.qty > 0);

    return {
      channel: formData.channel,
      status: formData.status,
      payment_method: formData.payment_method || 'cash',
      store_id: formData.store_id ? Number(formData.store_id) : null,
      warehouse_id: Number(formData.warehouse_id),
      customer_id: formData.customer_id ? Number(formData.customer_id) : null,
      employee_id: formData.employee_id ? Number(formData.employee_id) : null,
      lines: normalizedLines,
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const payload = buildPayload();

      if (!payload.warehouse_id || Number.isNaN(payload.warehouse_id)) {
        setError('Seleziona un magazzino valido.');
        return;
      }

      if (!payload.lines.length) {
        setError('Inserisci almeno una riga prodotto valida.');
        return;
      }

      const response = await orders.place(payload);
      if (response?.data?.offline_queued) {
        setSuccessMessage(response.data.message || 'Ordine salvato in coda offline.');
      } else {
        setSuccessMessage('Ordine creato con successo.');
      }

      await onSave();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore creazione ordine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white modal-light rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Nuovo Ordine</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" type="button">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {optionsError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {optionsError}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canale</label>
              <select name="channel" value={formData.channel} onChange={handleRootChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="pos">POS</option>
                <option value="web">Web</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select name="status" value={formData.status} onChange={handleRootChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="paid">Pagato</option>
                <option value="draft">Bozza</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metodo pagamento</label>
              <select name="payment_method" value={formData.payment_method} onChange={handleRootChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="cash">Contanti</option>
                <option value="card">Carta</option>
                <option value="bank_transfer">Bonifico</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opzionale)</label>
              <select
                name="customer_id"
                value={formData.customer_id}
                onChange={handleRootChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={optionsLoading}
              >
                <option value="">Nessun cliente</option>
                {options.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.first_name} {customer.last_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dipendente (opzionale)</label>
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={handleRootChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                disabled={optionsLoading}
              >
                <option value="">Nessun dipendente</option>
                {options.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Magazzino</label>
              <select
                name="warehouse_id"
                value={formData.warehouse_id}
                onChange={handleRootChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
                disabled={optionsLoading}
              >
                <option value="">Seleziona magazzino</option>
                {options.warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Righe ordine</h3>
              <button type="button" className="btn btn-light" onClick={addLine}>
                <Plus size={14} />
                Aggiungi riga
              </button>
            </div>

            <div className="space-y-3">
              {formData.lines.map((line, index) => (
                <div key={`line-${index}`} className="grid gap-3 md:grid-cols-12 border border-gray-200 rounded-lg p-3">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prodotto</label>
                    <select
                      value={line.product_variant_id}
                      onChange={(event) => onVariantChange(index, event.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                      disabled={optionsLoading}
                    >
                      <option value="">Seleziona variante</option>
                      {options.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.product_name} ({variant.sku}) {variant.flavor ? `- ${variant.flavor}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Qta</label>
                    <input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(event) => updateLine(index, { qty: event.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prezzo unit.</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(event) => updateLine(index, { unit_price: event.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Sconto</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discount}
                      onChange={(event) => updateLine(index, { discount: event.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="md:col-span-1 flex items-end justify-end">
                    <button type="button" className="btn btn-ghost" onClick={() => removeLine(index)} disabled={formData.lines.length <= 1}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="md:col-span-12 text-right text-sm text-gray-600">
                    Totale riga: <strong>€{lineTotals[index].toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right mt-3 text-base font-semibold text-gray-900">
              Totale stimato: €{subtotal.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={loading || optionsLoading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {loading && <Loader size={18} className="animate-spin" />}
              Crea ordine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
