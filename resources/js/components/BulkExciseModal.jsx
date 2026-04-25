import React, { useState } from 'react';
import { X, Loader, DollarSign, AlertTriangle } from 'lucide-react';
import { catalog } from '../api.jsx';

export default function BulkExciseModal({ categories, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ category_id: '', search: '', excise_tax: '' });

  const parentCategories = categories.filter(c => !c.parent_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await catalog.bulkExcise(formData);
      onSave(); // The caller will show a success toast and fetch data
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante l\'aggiornamento massivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 16, width: '100%',
        maxWidth: 500, display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.15)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: 8, borderRadius: 10 }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Accise Massive</h2>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>Applica un'accisa fissa a pi??prodotti contemporaneamente.</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--color-bg)', border: 'none', borderRadius: 10,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
          }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid #fca5a5', borderRadius: 8, color: 'var(--color-error)', fontSize: 13, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="sp-label">Filtra per Categoria (Opzionale)</label>
              <select className="sp-select" value={formData.category_id} onChange={e => setFormData(p => ({ ...p, category_id: e.target.value }))}>
                <option value="">— Nessun filtro (Tutte le categorie) —</option>
                {parentCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Applica solo ai prodotti in questa categoria padre e alle sue sottocategorie dirette.</p>
            </div>

            <div>
              <label className="sp-label">Filtra per Nome / SKU (Opzionale)</label>
              <input className="sp-input" value={formData.search} onChange={e => setFormData(p => ({ ...p, search: e.target.value }))} placeholder="Es: Aroma Menta" />
              <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Se vuoi limitare l'accisa solo ai prodotti che contengono questa parola.</p>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
              <label className="sp-label" style={{ color: '#047857' }}>Nuova Accisa (EUR/ml) *</label>
              <input className="sp-input" type="number" step="0.001" value={formData.excise_tax} onChange={e => setFormData(p => ({ ...p, excise_tax: e.target.value }))} placeholder="Es: 0.13" required style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }} />
              <p style={{ fontSize: 11, color: '#047857', marginTop: 4 }}>Questa cifra sovrascriverà l'accisa di TUTTI i prodotti che corrispondono ai filtri scelti qui sopra.</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32 }}>
            <button type="button" className="sp-btn sp-btn-ghost" onClick={onClose} disabled={loading}>Annulla</button>
            <button type="submit" className="sp-btn sp-btn-primary" disabled={loading || !formData.excise_tax} style={{ background: '#10B981' }}>
              {loading ? <><Loader size={14} className="sp-spin" /> Elaborazione...</> : 'Conferma e Applica'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
