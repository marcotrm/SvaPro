import React, { useState, useEffect } from 'react';
import { catalog } from '../api.jsx';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ErrorAlert from '../components/ErrorAlert.jsx';
import CatalogModal from '../components/CatalogModal.jsx';

export default function CatalogPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await catalog.getProducts();
      setProducts(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento dei prodotti');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product = null) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  const handleSaveProduct = async () => {
    await fetchProducts();
    handleCloseModal();
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Catalogo</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={20} />
          Nuovo Prodotto
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={fetchProducts} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Cerca per nome o SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Nome</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">SKU</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Brand</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Categoria</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">Prezzo</th>
              <th className="px-6 py-3 text-center font-medium text-gray-700">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{product.name}</td>
                  <td className="px-6 py-3 text-gray-600">{product.sku}</td>
                  <td className="px-6 py-3 text-gray-600">{product.brand?.name || '-'}</td>
                  <td className="px-6 py-3 text-gray-600">{product.category?.name || '-'}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">€{product.price?.toFixed(2)}</td>
                  <td className="px-6 py-3 text-center flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenModal(product)}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button className="text-red-600 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  Nessun prodotto trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <CatalogModal
          product={selectedProduct}
          onClose={handleCloseModal}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}
