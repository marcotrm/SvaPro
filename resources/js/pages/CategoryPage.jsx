import React, { useState, useEffect } from 'react';
import { catalog } from '../api.jsx';
import { Plus, Trash2, FolderTree, ChevronRight, Loader, Pencil, X } from 'lucide-react';
import ErrorAlert from '../components/ErrorAlert.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

export default function CategoryPage() {
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [confirmToDelete, setConfirmToDelete] = useState(null); // id | null

  // Modalità: 'create' | 'edit'
  const [mode, setMode]       = useState('create');
  const [editTarget, setEditTarget] = useState(null); // { id, name, parent_id }
  const [form, setForm]       = useState({ name: '', parent_id: '' });

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await catalog.getCategories();
      setCategories(res.data.data || []);
    } catch {
      setError('Errore caricamento categorie');
    } finally {
      setLoading(false);
    }
  };

  // Entra in modalità modifica
  const startEdit = (cat) => {
    setMode('edit');
    setEditTarget(cat);
    setForm({ name: cat.name, parent_id: cat.parent_id ? String(cat.parent_id) : '' });
  };

  // Torna in modalità creazione
  const cancelEdit = () => {
    setMode('create');
    setEditTarget(null);
    setForm({ name: '', parent_id: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      setSaving(true);
      if (mode === 'edit') {
        await catalog.updateCategory(editTarget.id, {
          name:      form.name,
          parent_id: form.parent_id || null,
        });
        cancelEdit();
      } else {
        await catalog.createCategory(form);
        setForm({ name: '', parent_id: '' });
      }
      await fetchCategories();
    } catch {
      setError(mode === 'edit' ? 'Errore aggiornamento categoria' : 'Errore salvataggio categoria');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmToDelete(id);
  };

  const doDelete = async () => {
    const id = confirmToDelete;
    if (!id) return;
    setConfirmToDelete(null);
    try {
      await catalog.deleteCategory(id);
      if (editTarget?.id === id) cancelEdit();
      await fetchCategories();
    } catch {
      setError('Errore eliminazione');
    }
  };

  const mainCategories  = categories.filter(c => !c.parent_id);
  const getSubcategories = (parentId) => categories.filter(c => c.parent_id === parentId);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  const isEdit = mode === 'edit';

  return (
    <>
    <div className="space-y-8 animate-v3">

      {error && <ErrorAlert message={error} onRetry={fetchCategories} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* FORM SIDE */}
        <div className="lg:col-span-1">
          <div className="card-v3 sticky top-8">
            {/* Header pannello */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">
                {isEdit ? `Modifica: ${editTarget?.name}` : 'Nuova Categoria'}
              </h3>
              {isEdit && (
                <button
                  onClick={cancelEdit}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                  title="Annulla modifica"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {isEdit && (
              <div className="mb-4 px-3 py-2 bg-indigo-50 rounded-xl text-xs font-bold text-indigo-600 border border-indigo-100">
                ✏️ Stai modificando una categoria esistente
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Nome</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-200 transition-all outline-none"
                  placeholder="Es. Hardware, Liquidi..."
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Categoria Padre (Opzionale)</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-200 transition-all outline-none appearance-none"
                >
                  <option value="">Nessuna (Top Level)</option>
                  {mainCategories
                    .filter(c => !isEdit || c.id !== editTarget?.id) // evita di essere padre di se stessa
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>
              </div>
              <button
                disabled={saving || !form.name}
                className={`w-full text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 ${
                  isEdit
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {saving ? <Loader className="animate-spin" size={18} /> : isEdit ? <Pencil size={18} /> : <Plus size={18} />}
                {isEdit ? 'Aggiorna Categoria' : 'Salva Categoria'}
              </button>

              {isEdit && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-full bg-slate-100 text-slate-500 rounded-2xl py-3 font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Annulla
                </button>
              )}
            </form>
          </div>
        </div>

        {/* LIST SIDE */}
        <div className="lg:col-span-2 space-y-4">
          {mainCategories.length === 0 ? (
            <div className="card-v3 flex flex-col items-center justify-center py-20 text-center opacity-40">
              <FolderTree size={48} className="mb-4" />
              <p className="font-bold">Nessuna categoria configurata</p>
            </div>
          ) : mainCategories.map(cat => {
            const isEditing = isEdit && editTarget?.id === cat.id;
            return (
              <div
                key={cat.id}
                className={`card-v3 !p-4 transition-all ${isEditing ? 'border-amber-300 ring-2 ring-amber-100' : 'hover:border-indigo-100 group'}`}
              >
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-500">
                      <FolderTree size={20} />
                    </div>
                    <div>
                      <div className="font-black text-slate-900">{cat.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {getSubcategories(cat.id).length} sottocategorie
                      </div>
                    </div>
                  </div>
                  {/* Azioni categoria principale */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(cat)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-all"
                      title="Modifica categoria"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Elimina categoria"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Subcategories */}
                <div className="mt-4 pl-12 space-y-2">
                  {getSubcategories(cat.id).map(sub => {
                    const subEditing = isEdit && editTarget?.id === sub.id;
                    return (
                      <div
                        key={sub.id}
                        className={`flex items-center justify-between p-3 border-b border-slate-50 last:border-0 group/sub rounded-xl transition-all ${subEditing ? 'bg-amber-50' : 'hover:bg-slate-50/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <ChevronRight size={14} className="text-slate-200 group-hover/sub:text-indigo-400 transition-colors" />
                          <span className="text-sm font-bold text-slate-700">{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-all">
                          <button
                            onClick={() => startEdit(sub)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-all"
                            title="Modifica"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            title="Elimina"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
    <ConfirmModal
      isOpen={confirmToDelete !== null}
      title="Elimina categoria"
      message="Vuoi eliminare questa categoria? Le sottocategorie collegate potrebbero essere rimosse o diventare orfane."
      onConfirm={doDelete}
      onCancel={() => setConfirmToDelete(null)}
    />
    </>
  );
}
