import React, { useMemo, useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { inventory, catalog } from '../api.jsx';

const MOVEMENT_TYPES = [
  { value: 'manual_adjustment', label: 'Rettifica manuale' },
  { value: 'inventory_count', label: 'Inventario / Conteggio' },
  { value: 'transfer_in', label: 'Trasferimento in ingresso' },
  { value: 'transfer_out', label: 'Trasferimento in uscita' },
  { value: 'return_customer', label: 'Reso cliente' },
  { value: 'damaged', label: 'Danneggiato / Scarto' },
];

export default function InventoryMovementModal({ stock = [], storeId, onClose, onSaved }) {
  // Warehouse dall'elenco stock già caricato
  const warehouses = useMemo(
    () => Array.from(new Map(stock.map((item) => [item.warehouse_id, { id: item.warehouse_id, name: item.warehouse_name }])).values()),
    [stock]
  );

  // Varianti dalla lista stock oppure dal catalogo (se stock è vuoto)
  const stockVariants = useMemo(
    () => Array.from(
      new Map(stock.map((item) => [
        item.product_variant_id,
        {
          id: item.product_variant_id,
          label: item.flavor ? `${item.product_name} - ${item.flavor}` : item.product_name,
        },
      ])).values()
    ),
    [stock]
  );

  const [catalogVariants, setCatalogVariants] = useState([]);
  const noStock = warehouses.length === 0;

  // Se non ci sono stock_items (magazzino vuoto) carica le varianti dal catalogo
  useEffect(() => {
    if (!noStock) return;
    const params = storeId ? { store_id: storeId, limit: 500 } : { limit: 500 };
    catalog.getProducts(params)
      .then(res => {
        const pvs = [];
        (res.data?.data || []).forEach(p =>
          (p.variants || []).forEach(v =>
            pvs.push({ id: v.id, label: v.flavor ? `${p.name} - ${v.flavor}` : p.name })
          )
        );
        setCatalogVariants(pvs);
      })
      .catch(() => {});
  }, [noStock, storeId]);

  const variants = noStock ? catalogVariants : stockVariants;

  const [formData, setFormData] = useState({
    warehouse_id: warehouses[0]?.id || '',
    product_variant_id: variants[0]?.id || '',
    direction: 'in',
    qty: '',
    movement_type: 'manual_adjustment',
    reference_type: '',
    reference_id: '',
    unit_cost: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const baseQty = Number(formData.qty);
    if (!Number.isFinite(baseQty) || baseQty <= 0) {
      setError('Inserisci una quantita valida maggiore di zero.');
      return;
    }

    const pvId = Number(formData.product_variant_id);
    if (!pvId) {
      setError('Seleziona un prodotto.');
      return;
    }

    // Costruisce il payload: usa warehouse_id se disponibile, altrimenti
    // manda store_id e il backend auto-crea/risolve il magazzino
    const warehouseId = Number(formData.warehouse_id) || null;
    const payload = {
      product_variant_id: pvId,
      qty: formData.direction === 'out' ? -Math.abs(baseQty) : Math.abs(baseQty),
      movement_type: formData.movement_type,
      reference_type: formData.reference_type || null,
      reference_id: formData.reference_id ? Number(formData.reference_id) : null,
      unit_cost: formData.unit_cost ? Number(formData.unit_cost) : null,
    };
    if (warehouseId) {
      payload.warehouse_id = warehouseId;
    } else if (storeId) {
      payload.store_id = storeId;
    }

    try {
      setLoading(true);
      setError('');
      await inventory.adjustStock(payload);
      onSaved();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setError('Errore validazione: ' + Object.values(serverErrors).flat().join(' | '));
      } else {
        setError(err.response?.data?.message || err.userFriendlyMessage || err.message || 'Errore sconosciuto.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white modal-light rounded-lg shadow-xl w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Nuovo Movimento Magazzino</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Mostra dropdown warehouse solo se disponibili */}
            {warehouses.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Magazzino</label>
                <select
                  name="warehouse_id"
                  value={formData.warehouse_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Seleziona magazzino</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Magazzino</label>
                <div className="px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg text-sm text-blue-700">
                  Il magazzino verrà associato automaticamente al negozio selezionato.
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prodotto / Variante</label>
              <select
                name="product_variant_id"
                value={formData.product_variant_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Seleziona variante</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direzione</label>
              <select
                name="direction"
                value={formData.direction}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="in">Entrata (+)</option>
                <option value="out">Uscita (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantita</label>
              <input
                type="number"
                min="1"
                step="1"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Causale</label>
              <select
                name="movement_type"
                value={formData.movement_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo unitario (opzionale)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                name="unit_cost"
                value={formData.unit_cost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Riferimento tipo</label>
              <input
                type="text"
                name="reference_type"
                value={formData.reference_type}
                onChange={handleChange}
                placeholder="es. cycle_count, transfer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Riferimento ID</label>
              <input
                type="number"
                min="1"
                step="1"
                name="reference_id"
                value={formData.reference_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

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
              Registra movimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}