import React, { useState, useEffect } from 'react';
import { catalog } from '../api.jsx';
import { Plus, Trash2, FolderTree, ChevronRight, Loader } from 'lucide-react';
import ErrorAlert from '../components/ErrorAlert.jsx';

export default function CategoryPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState({ name: '', parent_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await catalog.getCategories();
      setCategories(res.data.data || []);
    } catch (err) {
      setError('Errore caricamento categorie');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newCat.name) return;
    try {
      setSaving(true);
      await catalog.createCategory(newCat);
      setNewCat({ name: '', parent_id: '' });
      await fetchCategories();
    } catch (err) {
      setError('Errore salvataggio categoria');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questa categoria?')) return;
    try {
      await catalog.deleteCategory(id);
      await fetchCategories();
    } catch (err) {
      setError('Errore eliminazione');
    }
  };

  const mainCategories = categories.filter(c => !c.parent_id);
  const getSubcategories = (parentId) => categories.filter(c => c.parent_id === parentId);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader className="animate-spin text-indigo-500" size={32} />
    </div>
  );

  return (
    <div className="space-y-8 animate-v3">
      
      {error && <ErrorAlert message={error} onRetry={fetchCategories} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORM SIDE */}
        <div className="lg:col-span-1">
          <div className="card-v3 sticky top-8">
             <h3 className="text-lg font-black text-slate-900 mb-6">Nuova Categoria</h3>
             <form onSubmit={handleSave} className="space-y-4">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Nome</label>
                   <input 
                     value={newCat.name}
                     onChange={e => setNewCat({...newCat, name: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-200 transition-all outline-none"
                     placeholder="Es. Hardware, Liquidi..."
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Categoria Padre (Opzionale)</label>
                   <select 
                     value={newCat.parent_id}
                     onChange={e => setNewCat({...newCat, parent_id: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-indigo-200 transition-all outline-none appearance-none"
                   >
                     <option value="">Nessuna (Top Level)</option>
                     {mainCategories.map(c => (
                       <option key={c.id} value={c.id}>{c.name}</option>
                     ))}
                   </select>
                </div>
                <button 
                  disabled={saving || !newCat.name}
                  className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  {saving ? <Loader className="animate-spin" size={18} /> : <Plus size={18} />}
                  Salva Categoria
                </button>
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
           ) : mainCategories.map(cat => (
             <div key={cat.id} className="card-v3 !p-4 hover:border-indigo-100 group transition-all">
                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-500">
                         <FolderTree size={20} />
                      </div>
                      <div>
                         <div className="font-black text-slate-900">{cat.name}</div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Main Category</div>
                      </div>
                   </div>
                   <button onClick={() => handleDelete(cat.id)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Trash2 size={16} />
                   </button>
                </div>

                {/* Subcategories */}
                <div className="mt-4 pl-12 space-y-2">
                   {getSubcategories(cat.id).map(sub => (
                     <div key={sub.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 group/sub">
                        <div className="flex items-center gap-3">
                           <ChevronRight size={14} className="text-slate-200 group-hover/sub:text-indigo-400 transition-colors" />
                           <span className="text-sm font-bold text-slate-700">{sub.name}</span>
                        </div>
                        <button onClick={() => handleDelete(sub.id)} className="p-1 opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                           <Trash2 size={14} />
                        </button>
                     </div>
                   ))}
                </div>
             </div>
           ))}
        </div>

      </div>
    </div>
  );
}
