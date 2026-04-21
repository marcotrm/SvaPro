import React, { useState, useEffect } from 'react';
import { shifts, clearApiCache } from '../api.jsx';
import { X, Plus, Trash2, Clock, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal.jsx';

export default function ShiftTemplateModal({ onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  const [form, setForm] = useState({ name: '', start_time: '09:00', end_time: '18:00', color: '#10B981' });
  const [confirmToDelete, setConfirmToDelete] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const res = await shifts.getTemplates();
      setTemplates(res.data?.data || []);
    } catch {
      toast.error('Errore nel caricamento dei template');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.start_time || !form.end_time) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }
    try {
      setAdding(true);
      await shifts.saveTemplate(form);
      clearApiCache();
      toast.success('Template creato con successo');
      setForm({ name: '', start_time: '09:00', end_time: '18:00', color: '#10B981' });
      await loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore nella creazione');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmToDelete(id);
  };

  const doDelete = async () => {
    const id = confirmToDelete;
    setConfirmToDelete(null);
    try {
      await shifts.deleteTemplate(id);
      clearApiCache();
      toast.success('Template eliminato');
      setTemplates(t => t.filter(x => x.id !== id));
    } catch {
      toast.error("Errore durante l'eliminazione");
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: 500, background: 'var(--color-bg)', borderRadius: 24, padding: 32, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={28} color="var(--color-accent)" /> 
            Modelli Orari
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={24} /></button>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', background: 'var(--color-surface)', padding: 16, borderRadius: 16 }}>
          <div style={{ flex: '1 1 100%' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Nome Modello (es. Mattina)</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none' }} placeholder="Es. Turno Mattina Caivano" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Entrata</label>
            <input type="time" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Uscita</label>
            <input type="time" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none' }} />
          </div>
          <div style={{ flex: '0 0 60px' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Colore</label>
            <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={{ width: '100%', height: 38, border: 'none', padding: 0, borderRadius: 10, cursor: 'pointer', background: 'transparent' }} />
          </div>
          <div style={{ flex: '1 1 100%', marginTop: 8 }}>
            <button type="submit" disabled={adding} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--color-accent)', color: '#fff', border: 'none', padding: '12px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', opacity: adding ? 0.7 : 1 }}>
              {adding ? <Loader size={18} className="animate-spin" /> : <><Plus size={18} /> Aggiungi Modello</>}
            </button>
          </div>
        </form>

        <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Loader size={24} className="animate-spin" style={{ opacity: 0.5 }} /></div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: 30, fontSize: 14 }}>Nessun modello salvato. Creane uno qui sopra.</div>
          ) : (
            templates.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface)', borderRadius: 12, borderLeft: `6px solid ${t.color || '#10B981'}` }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>{t.start_time} - {t.end_time}</div>
                </div>
                <button onClick={() => handleDelete(t.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
      <ConfirmModal
        isOpen={confirmToDelete !== null}
        title="Elimina template turno"
        message="Vuoi eliminare questo modello orario? Non sarà più disponibile per l'assegnazione dei turni."
        onConfirm={doDelete}
        onCancel={() => setConfirmToDelete(null)}
      />
    </div>
  );
}
