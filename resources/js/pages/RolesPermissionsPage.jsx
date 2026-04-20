import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { rolesPermissions, clearApiCache } from '../api.jsx';
import { Shield, RefreshCw, CheckCircle2, XCircle, Loader2, Plus, Edit2, Trash2 } from 'lucide-react';

const roleColors = {
  superadmin:    { bg: 'linear-gradient(135deg,#4F46E5,#7B6FD0)', text: '#fff', badge: '#4F46E5' },
  admin_cliente: { bg: 'linear-gradient(135deg,#0891B2,#06b6d4)', text: '#fff', badge: '#0891B2' },
  dipendente:    { bg: 'linear-gradient(135deg,#16A34A,#22c55e)', text: '#fff', badge: '#16A34A' },
  cliente_finale:{ bg: 'linear-gradient(135deg,#F59E0B,#fbbf24)', text: '#fff', badge: '#F59E0B' },
};

function getRole(code) {
  // If it's a custom role, give it a sleek default purple/dark layout
  return roleColors[code] || { bg: 'linear-gradient(135deg,#4338CA,#6366F1)', text: '#fff', badge: '#4338CA' };
}

export default function RolesPermissionsPage() {
  const { user } = useOutletContext() || {};
  const isSuperAdminUser = (user?.roles || []).includes('superadmin');

  const [roles, setRoles]           = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [toggling, setToggling]     = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // ID del ruolo evidenziato

  // CRUD Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [roleInput, setRoleInput]             = useState('');
  const [processing, setProcessing]           = useState(false);

  useEffect(() => { fetchMatrix(); }, []);

  const fetchMatrix = async () => {
    try {
      setLoading(true); setError('');
      const res = await rolesPermissions.getMatrix();
      const r = res.data?.roles || [];
      const p = res.data?.permissions || [];
      const m = res.data?.matrix || [];
      setRoles(r);
      setPermissions(p);
      setMatrix(m);
      if (r.length > 0 && !selectedRole) setSelectedRole(r[0].id);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento');
    } finally { setLoading(false); }
  };

  const handleToggle = async (roleId, permissionId) => {
    const key = `${roleId}-${permissionId}`;
    setToggling(key);
    try {
      await rolesPermissions.toggle(roleId, permissionId);
      clearApiCache();
      setMatrix(prev => prev.map(row => {
        if (row.role_id !== roleId) return row;
        const has = row.permission_ids.includes(permissionId);
        return {
          ...row,
          permission_ids: has
            ? row.permission_ids.filter(id => id !== permissionId)
            : [...row.permission_ids, permissionId],
        };
      }));
    } catch (err) {
      setError(err.message || 'Errore nel toggle');
    } finally { setToggling(null); }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!roleInput.trim()) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.createRole({ name: roleInput });
      setShowCreateModal(false);
      setRoleInput('');
      await fetchMatrix();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore creazione ruolo');
    } finally { setProcessing(false); }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!roleInput.trim() || !selectedRole) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.updateRole(selectedRole, { name: roleInput });
      setShowEditModal(false);
      setRoleInput('');
      fetchMatrix(); // Refresh without strict await loader to avoid full flicker
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore aggiornamento ruolo');
    } finally { setProcessing(false); }
  };

  const handleDeleteRole = async (e) => {
    e.preventDefault();
    if (!selectedRole || !window.confirm('Eliminare definitivamente questo ruolo? Gli utenti associati perderanno ogni suo permesso.')) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.deleteRole(selectedRole);
      setSelectedRole(null);
      await fetchMatrix();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Errore eliminazione ruolo');
    } finally { setProcessing(false); }
  };

  const openEditModal = () => {
    const r = roles.find(x => x.id === selectedRole);
    if (r) {
      setRoleInput(r.name);
      setShowEditModal(true);
    }
  };

  const isGranted = (roleId, permId) => {
    const row = matrix.find(r => r.role_id === roleId);
    return row ? row.permission_ids.includes(permId) : false;
  };

  const selectedRow = matrix.find(r => r.role_id === selectedRole);
  const isSelectedRoleSuperAdmin = selectedRow?.role_code === 'superadmin';
  const isProtectedRole = ['superadmin', 'admin_cliente', 'dipendente', 'cliente_finale'].includes(selectedRow?.role_code);

  const permGroups = permissions.reduce((acc, p) => {
    const group = p.name?.split('.')[0] || 'Altro';
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--muted)' }}>
      <Loader2 size={22} style={{ animation: 'spin .7s linear infinite' }} />
      Caricamento matrice...
    </div>
  );

  return (
    <div className="sp-animate-in relative">

      {/* Header */}
      <div className="sp-page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="sp-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} style={{ color: 'var(--color-accent)' }} /> Gestione Ruoli e Permessi
          </h1>
          <p className="sp-page-subtitle">{roles.length} ruoli · {permissions.length} permessi configurabili nel sistema</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {isSuperAdminUser && (
            <button 
              className="sp-btn" 
              style={{ background: 'var(--color-accent)', color: '#fff', border: 'none' }}
              onClick={() => { setRoleInput(''); setShowCreateModal(true); }}
            >
              <Plus size={16} /> Nuovo Ruolo
            </button>
          )}
          <button className="sp-btn sp-btn-secondary" onClick={fetchMatrix}>
            <RefreshCw size={14} /> Aggiorna
          </button>
        </div>
      </div>

      {error && (
        <div className="sp-alert sp-alert-error" style={{ marginBottom: 16 }}>
          ⚠ {error}
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setError('')} style={{ marginLeft: 'auto' }}>Chiudi</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Colonna sinistra — Lista Ruoli */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Ruoli Disponibili
          </div>
          {roles.map(role => {
            const pal = getRole(role.code);
            const row = matrix.find(r => r.role_id === role.id);
            const grantedCount = row?.permission_ids?.length ?? 0;
            const isSelected = selectedRole === role.id;
            return (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                style={{
                  padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                  background: isSelected ? pal.bg : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'transparent' : 'var(--color-border)'}`,
                  boxShadow: isSelected ? '0 12px 32px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s',
                  transform: isSelected ? 'scale(1.02)' : 'none',
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 15, color: isSelected ? pal.text : 'var(--color-text)', marginBottom: 3 }}>
                  {role.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                    color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--color-text-tertiary)',
                  }}>
                    #{role.code}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 800,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--color-bg)',
                    color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                    padding: '3px 10px', borderRadius: 20,
                  }}>
                    {grantedCount} permessi
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Colonna destra — Permessi del ruolo selezionato */}
        <div>
          {selectedRow ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              {/* Header ruolo selezionato */}
              <div style={{
                padding: '20px 24px', borderRadius: '16px 16px 0 0', 
                background: getRole(selectedRow.role_code).bg,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ padding: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 14 }}>
                  <Shield size={28} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-0.02em' }}>{selectedRow.role_name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', marginTop: 2 }}>{selectedRow.role_code}</div>
                </div>
                
                {/* Actions per ruoli custom */}
                {isSuperAdminUser && !isProtectedRole && (
                  <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.1)', padding: 6, borderRadius: 12 }}>
                    <button 
                      onClick={openEditModal}
                      style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                    >
                      <Edit2 size={14} /> Rinomina
                    </button>
                    <button 
                      onClick={handleDeleteRole}
                      style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.8)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
                    >
                      <Trash2 size={14} /> Elimina
                    </button>
                  </div>
                )}

                {isSelectedRoleSuperAdmin && (
                  <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '6px 16px', borderRadius: 20 }}>
                    🔓 Accesso Completo Predefinito
                  </span>
                )}
              </div>
              
              {/* Info Bar */}
              <div style={{ background: 'var(--color-surface)', padding: '12px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                    Usa questa griglia per assegnare le competenze avanzate a questo ruolo.
                 </div>
                 <span style={{ background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>
                   {selectedRow.permission_ids?.length ?? 0} / {permissions.length} abbinati
                 </span>
              </div>

              {/* Permessi raggruppati */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
                {Object.entries(permGroups).map(([group, perms]) => (
                  <div key={group} className="sp-table-wrap" style={{ overflow: 'visible', margin: 0 }}>
                    {/* Group header */}
                    <div style={{
                      padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
                      fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--color-text-tertiary)', background: 'var(--color-bg)',
                      borderRadius: '12px 12px 0 0',
                    }}>
                      {group} &mdash; Moduli
                    </div>

                    {/* Permessi */}
                    {perms.map((perm, idx) => {
                      const granted = isGranted(selectedRow.role_id, perm.id);
                      const key = `${selectedRow.role_id}-${perm.id}`;
                      const isTogg = toggling === key;
                      const last = idx === perms.length - 1;

                      return (
                        <div
                          key={perm.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '14px 20px',
                            borderBottom: last ? 'none' : '1px solid var(--color-border)',
                            background: granted ? 'rgba(34,197,94,0.02)' : 'var(--color-surface)',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { if (!isSelectedRoleSuperAdmin) e.currentTarget.style.background = granted ? 'rgba(34,197,94,0.05)' : 'var(--color-bg)'; }}
                          onMouseLeave={e => e.currentTarget.style.background = granted ? 'rgba(34,197,94,0.02)' : 'var(--color-surface)'}
                        >
                          {/* Nome permesso */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: granted ? '#16a34a' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isSelectedRoleSuperAdmin || granted ? <CheckCircle2 size={16} /> : <XCircle size={16} style={{ color: 'var(--color-border)' }} />}
                              {perm.name}
                            </div>
                            {perm.description && (
                              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2, marginLeft: 24 }}>
                                {perm.description}
                              </div>
                            )}
                          </div>

                          {/* Toggle button */}
                          {!isSelectedRoleSuperAdmin && (
                            <button
                              onClick={() => handleToggle(selectedRow.role_id, perm.id)}
                              disabled={!!isTogg}
                              style={{
                                flexShrink: 0, padding: '8px 20px', borderRadius: 10, border: 'none',
                                fontSize: 12, fontWeight: 800, cursor: isTogg ? 'wait' : 'pointer',
                                background: granted
                                  ? 'rgba(239,68,68,0.1)' : 'var(--color-text)',
                                color: granted ? '#ef4444' : 'var(--color-surface)',
                                transition: 'all 0.15s',
                                minWidth: 100, textAlign: 'center',
                                boxShadow: granted ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            >
                              {isTogg ? <Loader2 size={14} className="animate-spin inline" /> : granted ? 'Revoca Accesso' : 'Concedi Accesso'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)', borderRadius: 20, border: '1px dashed var(--color-border)' }}>
              <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>Gestore Accessi Attivo</div>
              <p>Seleziona o crea un ruolo dalla lista per gestirne i permessi</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALI (Portals-like) */}
      {(showCreateModal || showEditModal) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="animate-in zoom-in-95" style={{
            background: 'var(--color-surface)', width: 400, borderRadius: 24,
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)', padding: 32,
            border: '1px solid var(--color-border)'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>
               {showCreateModal ? 'Crea Nuovo Ruolo' : 'Rinomina Ruolo'}
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
               {showCreateModal 
                 ? 'Gli utenti assegnati a questo ruolo riceveranno i permessi che sceglierai.' 
                 : 'Cambia il nome display del ruolo. I permessi non verranno alterati.'}
            </p>

            <form onSubmit={showCreateModal ? handleCreateRole : handleUpdateRole}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 800, color: 'var(--color-text-tertiary)' }}>NOME DEL RUOLO</label>
                <input 
                  autoFocus
                  required
                  placeholder="Es: Manager Negozio"
                  value={roleInput}
                  onChange={e => setRoleInput(e.target.value)}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12, 
                    border: '2px solid var(--color-border)', background: 'var(--color-bg)',
                    fontSize: 15, fontWeight: 700, color: 'var(--color-text)',
                    outline: 'none', transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                  style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontWeight: 800, cursor: 'pointer' }}
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  disabled={processing}
                  style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 800, cursor: processing ? 'wait' : 'pointer', boxShadow: '0 8px 16px rgba(79,70,229,0.3)' }}
                >
                  {processing ? 'Salvataggio...' : 'Conferma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
