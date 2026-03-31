import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Loader } from 'lucide-react';
import { orders } from '../api.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';

const createLine = () => ({
  product_variant_id: '',
  qty: 1,
  unit_price: '',
  discount: 0,
});

export default function EmployeePurchasesPage() {
  const { selectedStoreId, selectedStore } = useOutletContext();
  
  const [formData, setFormData] = useState({
    employee_id: '', // Buyer
    sold_by_employee_id: '', // POS Seller
    warehouse_id: '',
    payment_method: 'cash',
    lines: [],
  });
  
  const [barcodeBuffer, setBarcodeBuffer] = useState('');

  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [options, setOptions] = useState({
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
        setOptions(res.data?.data || { employees: [], warehouses: [], variants: [] });
      } catch (err) {
        setOptionsError(err.response?.data?.message || err.message || 'Errore caricamento opzioni');
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
      if (variant.sku) map.set(variant.sku, variant);
      if (variant.barcode) map.set(variant.barcode, variant);
    }
    return map;
  }, [options.variants]);

  // Barcode Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Logic for barcode scanners (usually ending with Enter)
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
          const found = variantMap.get(barcodeBuffer);
          if (found) {
            addProductByVariant(found);
            setBarcodeBuffer('');
          }
        }
      } else if (e.key.length === 1) {
        setBarcodeBuffer(prev => prev + e.key);
      }
      
      // Clear buffer after 500ms of inactivity
      const timeout = setTimeout(() => setBarcodeBuffer(''), 500);
      return () => clearTimeout(timeout);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeBuffer, variantMap]);

  const addProductByVariant = (variant) => {
    const defaultPrice = variant.sale_price || 0;
    const defaultDiscount = defaultPrice > 0 ? (defaultPrice * 0.5).toFixed(2) : 0;
    
    setFormData(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          product_variant_id: variant.id,
          qty: 1,
          unit_price: defaultPrice,
          discount: defaultDiscount,
        }
      ]
    }));
  };

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
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
      };
    });
  };

  const onVariantChange = (index, variantId) => {
    const selected = variantMap.get(String(variantId));
    // Applica logicamente un default di sconto dipendente, es. prezzo di costo o 50%
    const defaultPrice = selected?.sale_price || 0;
    const defaultDiscount = defaultPrice > 0 ? (defaultPrice * 0.5).toFixed(2) : 0;
    
    updateLine(index, {
      product_variant_id: variantId,
      unit_price: defaultPrice,
      discount: defaultDiscount,
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
      channel: 'pos',
      status: 'paid',
      is_employee_purchase: true,
      payment_method: formData.payment_method || 'cash',
      store_id: selectedStoreId ? Number(selectedStoreId) : null,
      warehouse_id: Number(formData.warehouse_id),
      employee_id: formData.employee_id ? Number(formData.employee_id) : null,
      sold_by_employee_id: formData.sold_by_employee_id ? Number(formData.sold_by_employee_id) : null,
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

      if (!payload.employee_id) {
        setError('Seleziona il dipendente che sta effettuando l\'acquisto.');
        setLoading(false);
        return;
      }

      if (!payload.sold_by_employee_id) {
        setError('Seleziona il dipendente che sta gestendo la vendita (Sold By).');
        setLoading(false);
        return;
      }

      if (!payload.warehouse_id || Number.isNaN(payload.warehouse_id)) {
        setError('Seleziona un magazzino valido.');
        return;
      }

      if (!payload.lines.length) {
        setError('Inserisci almeno una riga prodotto valida.');
        return;
      }

      const response = await orders.place(payload);
      setSuccessMessage('Acquisto dipendente registrato con successo.');
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        lines: [createLine()],
      }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore creazione ordine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Acquisti Dipendenti</div>
          <div className="page-head-sub">
            Registra una vendita interna per un dipendente con sconti applicati
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {optionsError && <ErrorAlert message={optionsError} />}
            {error && <ErrorAlert message={error} />}
            {successMessage && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium">
                {successMessage}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dipendente Acquirente</label>
                <select
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleRootChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  disabled={optionsLoading}
                  required
                >
                  <option value="">Seleziona...</option>
                  {options.employees.map((employee) => (
                    <option key={`buyer-${employee.id}`} value={employee.id}>{employee.first_name} {employee.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1 font-bold">Venduto da (Sold By)</label>
                <select
                  name="sold_by_employee_id"
                  value={formData.sold_by_employee_id}
                  onChange={handleRootChange}
                  className="w-full px-3 py-2 border border-indigo-300 bg-indigo-50 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  disabled={optionsLoading}
                  required
                >
                  <option value="">Seleziona chi vende...</option>
                  {options.employees.map((employee) => (
                    <option key={`seller-${employee.id}`} value={employee.id}>{employee.first_name} {employee.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Magazzino di scarico</label>
                <select
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleRootChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  required
                  disabled={optionsLoading}
                >
                  <option value="">Seleziona magazzino</option>
                  {options.warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metodo di pagamento</label>
                <select name="payment_method" value={formData.payment_method} onChange={handleRootChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="cash">Contanti</option>
                  <option value="card">Carta</option>
                  <option value="bank_transfer">Bonifico</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-800">Prodotti acquistati</h3>
                <button type="button" className="btn btn-light btn-sm" onClick={addLine}>
                  <Plus size={14} /> Aggiungi prodotto
                </button>
              </div>

              <div className="space-y-3">
                {formData.lines.map((line, index) => (
                  <div key={`line-${index}`} className="flex flex-col md:flex-row gap-3 items-end border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Prodotto / Variante</label>
                      <select
                        value={line.product_variant_id}
                        onChange={(event) => onVariantChange(index, event.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm outline-none"
                        required
                        disabled={optionsLoading}
                      >
                        <option value="">Seleziona...</option>
                        {options.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.product_name} ({variant.sku}) {variant.flavor ? `- ${variant.flavor}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full md:w-20">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Qta</label>
                      <input
                        type="number"
                        min="1"
                        value={line.qty}
                        onChange={(event) => updateLine(index, { qty: event.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm outline-none"
                        required
                      />
                    </div>

                    <div className="w-full md:w-28">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Prezzo (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) => updateLine(index, { unit_price: event.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm outline-none"
                        required
                      />
                    </div>

                    <div className="w-full md:w-28">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sconto (€)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(event) => updateLine(index, { discount: event.target.value })}
                        className="w-full px-3 py-2 border border-blue-300 bg-blue-50 text-blue-900 rounded-lg text-sm outline-none"
                      />
                    </div>

                    <div className="w-full md:w-28 text-right pb-2">
                      <span className="text-xs text-gray-500 block">Totale</span>
                      <span className="font-semibold text-gray-900">€{lineTotals[index].toFixed(2)}</span>
                    </div>

                    <div className="pb-1">
                      <button type="button" className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" onClick={() => removeLine(index)} disabled={formData.lines.length <= 1}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <div className="text-xl">
                  <span className="text-gray-500 mr-3">Totale da pagare:</span>
                  <span className="font-bold text-gray-900">€{subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={loading || optionsLoading} 
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
              >
                {loading && <Loader size={18} className="animate-spin" />}
                Registra Acquisto (No Provvigioni)
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </>
  );
}
