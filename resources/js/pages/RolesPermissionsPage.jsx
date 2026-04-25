import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { rolesPermissions, clearApiCache } from '../api.jsx';
import {
  Shield, RefreshCw, CheckCircle2, XCircle, Loader2,
  Plus, Edit2, Trash2, Users, Lock, ChevronRight, X, Eye, EyeOff
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// COSTANTI DI STILE
// ─────────────────────────────────────────────────────────────────
const ROLE_GRADIENT = {
  superadmin:    'linear-gradient(135deg,#4F46E5,#7B6FD0)',
  admin_cliente: 'linear-gradient(135deg,#0891B2,#06b6d4)',
  dipendente:    'linear-gradient(135deg,#16A34A,#22c55e)',
  cliente_finale:'linear-gradient(135deg,#F59E0B,#fbbf24)',
};
const PROTECTED = ['superadmin','admin_cliente','dipendente','cliente_finale'];
const getRoleGradient = (code) =>
  ROLE_GRADIENT[code] || 'linear-gradient(135deg,#4338CA,#6366F1)';

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: MODAL
// ─────────────────────────────────────────────────────────────────
function Modal({ title, subtitle, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 24, width: 460, maxWidth: '95vw',
        boxShadow: '0 32px 64px rgba(0,0,0,0.25)', border: '1px solid var(--color-border)',
        padding: 32, position: 'relative',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'var(--color-bg)',
          border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: 'var(--color-text-tertiary)',
        }}><X size={16} /></button>
        <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>{title}</h3>
        {subtitle && <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'permissions', label: 'Permessi per Ruolo', icon: Lock },
  { id: 'users', label: 'Utenti e Ruoli', icon: Users },
];

// ─────────────────────────────────────────────────────────────────
// PAGINA PRINCIPALE
// ─────────────────────────────────────────────────────────────────
export default function RolesPermissionsPage() {
  const { user } = useOutletContext() || {};
  const isSuperAdminUser = (user?.roles || []).includes('superadmin');

  const [tab, setTab] = useState('permissions');

  // ── Matrice ruoli / permessi ──
  const [roles, setRoles]       = useState([]);
  const [permissions, setPerms] = useState([]);
  const [matrix, setMatrix]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toggling, setToggling] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  // ── Utenti ──
  const [users, setUsers]         = useState([]);
  const [usersLoading, setUL]     = useState(false);
  const [selectedUserId, setSelU] = useState(null);

  // ── Modali ──
  // modalType: 'createRole'|'editRole'|'createPermission'|'createUser'|'editUser'
  const [modalType, setModalType] = useState(null);
  const [roleInput, setRoleInput] = useState('');
  const [processing, setProcessing] = useState(false);
  // form stati per nuovi modali
  const [permName, setPermName]   = useState('');
  const [permCode, setPermCode]   = useState('');
  const [newUserName, setNewUserName]   = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPw, setNewUserPw]       = useState('');
  const [newUserRole, setNewUserRole]   = useState('');
  // edit utente
  const [editUserId, setEditUserId]     = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPw, setEditUserPw]     = useState('');
  const [showEditPw, setShowEditPw]     = useState(false);

  // ─ fetch matrice ─────────────────────────────────────────────
  const fetchMatrix = useCallback(async (selectId = null) => {
    try {
      setLoading(true); setError('');
      clearApiCache();
      const res = await rolesPermissions.getMatrix();
      const r = res.data?.roles || [];
      const p = res.data?.permissions || [];
      const m = res.data?.matrix || [];
      setRoles(r); setPerms(p); setMatrix(m);
      // Seleziona il nuovo ruolo se passato, altrimenti mantieni selezione corrente o primo
      if (selectId) setSelectedRoleId(selectId);
      else if (!selectedRoleId && r.length > 0) setSelectedRoleId(r[0].id);
    } catch (err) {
      setError(err.userFriendlyMessage || err.message || 'Errore nel caricamento');
    } finally { setLoading(false); }
  }, [selectedRoleId]);

  useEffect(() => { fetchMatrix(); }, []);

  // ─ fetch utenti ───────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      setUL(true);
      const res = await rolesPermissions.listUsers();
      setUsers(res.data?.data || []);
    } catch (err) {
      setError(err.userFriendlyMessage || err.message || 'Errore caricamento utenti');
    } finally { setUL(false); }
  }, []);

  useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab]);

  // ─ toggle permesso ─────────────────────────────────────────
  const handleToggle = async (roleId, permId) => {
    const key = `${roleId}-${permId}`;
    setToggling(key);
    try {
      await rolesPermissions.toggle(roleId, permId);
      clearApiCache();
      setMatrix(prev => prev.map(row => {
        if (row.role_id !== roleId) return row;
        const has = row.permission_ids.includes(permId);
        return { ...row, permission_ids: has ? row.permission_ids.filter(x => x !== permId) : [...row.permission_ids, permId] };
      }));
    } catch (err) {
      setError(err.userFriendlyMessage || err.message || 'Errore');
    } finally { setToggling(null); }
  };

  // ─ CRUD ruoli ─────────────────────────────────────────────
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleInput.trim()) return;
    setProcessing(true); setError('');
    try {
      if (modalType === 'createRole') {
        const res = await rolesPermissions.createRole({ name: roleInput });
        const newId = res.data?.role?.id;
        setModalType(null); setRoleInput('');
        await fetchMatrix(newId); // passa l'ID del nuovo ruolo per selezionarlo
      } else if (modalType === 'editRole') {
        await rolesPermissions.updateRole(selectedRoleId, { name: roleInput });
        setModalType(null); setRoleInput('');
        await fetchMatrix(selectedRoleId);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.userFriendlyMessage || 'Errore');
    } finally { setProcessing(false); }
  };

  const handleDeleteRole = async () => {
    if (!selectedRoleId) return;
    if (!window.confirm('Eliminare definitivamente questo ruolo? Gli utenti con solo questo ruolo perderanno ogni accesso.')) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.deleteRole(selectedRoleId);
      setSelectedRoleId(null);
      await fetchMatrix();
    } catch (err) {
      setError(err.response?.data?.message || 'Errore eliminazione');
    } finally { setProcessing(false); }
  };

  // ─ assegna/revoca ruolo ad utente ─────────────────────────
  const handleToggleUserRole = async (userId, roleId, hasRole) => {
    setProcessing(true); setError('');
    try {
      if (hasRole) await rolesPermissions.revokeRole(userId, roleId);
      else await rolesPermissions.assignRole(userId, roleId);
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || err.userFriendlyMessage || 'Errore');
    } finally { setProcessing(false); }
  };

  // ─ elimina permesso ────────────────────────────────────────
  const handleDeletePermission = async (permId, permName) => {
    if (!window.confirm(`Eliminare definitivamente il permesso "${permName}"?\nVerrà rimosso da tutti i ruoli che lo hanno assegnato.`)) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.deletePermission(permId);
      setPerms(prev => prev.filter(p => p.id !== permId));
      setMatrix(prev => prev.map(row => ({
        ...row,
        permission_ids: row.permission_ids.filter(id => id !== permId),
      })));
    } catch (err) {
      setError(err.response?.data?.message || 'Errore eliminazione permesso');
    } finally { setProcessing(false); }
  };

  // ─ crea permesso ────────────────────────────────────────────
  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!permName.trim()) return;
    setProcessing(true); setError('');
    try {
      const res = await rolesPermissions.createPermission({ name: permName, code: permCode });
      const newPerm = res.data?.permission;
      if (newPerm) setPerms(prev => [...prev, newPerm]);
      setModalType(null); setPermName(''); setPermCode('');
    } catch (err) {
      setError(err.response?.data?.message || 'Errore creazione permesso');
    } finally { setProcessing(false); }
  };

  // ─ crea utente ──────────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPw.trim()) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.createUser({
        name: newUserName, email: newUserEmail, password: newUserPw,
        role_id: newUserRole || undefined,
      });
      setModalType(null); setNewUserName(''); setNewUserEmail(''); setNewUserPw(''); setNewUserRole('');
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Errore creazione utente');
    } finally { setProcessing(false); }
  };

  // ─ apre modal modifica utente (solo superadmin) ────────────
  const openEditUser = async (u) => {
    setEditUserId(u.id);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserPw('');
    setShowEditPw(false);
    // Tenta di caricare password_hint dal backend
    try {
      const res = await rolesPermissions.getUser(u.id);
      const hint = res.data?.data?.password_hint || '';
      setEditUserPw(hint);
    } catch { /* ignora */ }
    setModalType('editUser');
  };

  // ─ salva modifiche utente ────────────────────────────────────
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editUserId) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.updateUser(editUserId, {
        name:  editUserName,
        email: editUserEmail,
        ...(editUserPw.trim() ? { password: editUserPw } : {}),
      });
      setModalType(null);
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors ? Object.values(err.response?.data?.errors || {}).flat().join(' · ') : 'Errore salvataggio');
    } finally { setProcessing(false); }
  };

  // ─ elimina utente ───────────────────────────────────────────
  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Eliminare definitivamente l'utente "${userName}"?\nQuesta azione non ??reversibile.`)) return;
    setProcessing(true); setError('');
    try {
      await rolesPermissions.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (selectedUserId === userId) setSelU(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Errore eliminazione utente');
    } finally { setProcessing(false); }
  };

  // ─ helpers ─────────────────────────────────────────────────
  const isGranted = (roleId, permId) => {
    const row = matrix.find(r => r.role_id === roleId);
    return row ? row.permission_ids.includes(permId) : false;
  };

  const selectedRow = matrix.find(r => r.role_id === selectedRoleId);
  const selectedRoleIsProtected = PROTECTED.includes(selectedRow?.role_code);
  const selectedRoleIsSuperAdmin = selectedRow?.role_code === 'superadmin';

  const permGroups = permissions.reduce((acc, p) => {
    const group = p.name?.split('.')[0] || 'altro';
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  const selectedUser = users.find(u => u.id === selectedUserId);

  // ─ render loading ──────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--color-text-tertiary)' }}>
      <Loader2 size={22} style={{ animation: 'spin .7s linear infinite' }} />
      Caricamento in corso...
    </div>
  );

  return (
    <div className="sp-animate-in">

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={24} style={{ color: 'var(--color-accent)' }} /> Gestione Ruoli & Permessi
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {roles.length} ruoli · {permissions.length} permessi · {users.length} utenti nel tenant
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isSuperAdminUser && tab === 'permissions' && (
            <>
              <button className="sp-btn" style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', fontWeight: 800 }}
                onClick={() => { setRoleInput(''); setModalType('createRole'); }}>
                <Plus size={15} /> Nuovo Ruolo
              </button>
              <button className="sp-btn" style={{ background: '#0891b2', color: '#fff', border: 'none', fontWeight: 800 }}
                onClick={() => { setPermName(''); setPermCode(''); setModalType('createPermission'); }}>
                <Plus size={15} /> Nuovo Modulo
              </button>
            </>
          )}
          {isSuperAdminUser && tab === 'users' && (
            <button className="sp-btn" style={{ background: '#16a34a', color: '#fff', border: 'none', fontWeight: 800 }}
              onClick={() => { setNewUserName(''); setNewUserEmail(''); setNewUserPw(''); setNewUserRole(''); setModalType('createUser'); }}>
              <Plus size={15} /> Nuovo Utente
            </button>
          )}
          <button className="sp-btn sp-btn-secondary" onClick={() => { fetchMatrix(); if (tab === 'users') fetchUsers(); }}>
            <RefreshCw size={14} /> Aggiorna
          </button>
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div className="sp-alert sp-alert-error" style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
          ?? {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--color-bg)', borderRadius: 14, padding: 4, width: 'fit-content', border: '1px solid var(--color-border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
            border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
            background: tab === id ? 'var(--color-accent)' : 'transparent',
            color: tab === id ? '#fff' : 'var(--color-text-secondary)',
            transition: 'all 0.16s',
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: PERMESSI PER RUOLO
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'permissions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 24, alignItems: 'start' }}>

          {/* LISTA RUOLI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Ruoli disponibili
            </div>
            {roles.map(role => {
              const row = matrix.find(r => r.role_id === role.id);
              const count = row?.permission_ids?.length ?? 0;
              const isSelected = selectedRoleId === role.id;
              const grad = getRoleGradient(role.code);
              return (
                <div key={role.id} onClick={() => setSelectedRoleId(role.id)} style={{
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: isSelected ? grad : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'transparent' : 'var(--color-border)'}`,
                  boxShadow: isSelected ? '0 10px 28px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transform: isSelected ? 'scale(1.02)' : 'none',
                  transition: 'all 0.18s',
                }}>
                  <div style={{ fontWeight: 900, fontSize: 14, color: isSelected ? '#fff' : 'var(--color-text)', marginBottom: 4 }}>
                    {role.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.65)' : 'var(--color-text-tertiary)' }}>{role.code}</code>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 16,
                      background: isSelected ? 'rgba(255,255,255,0.22)' : 'var(--color-bg)',
                      color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                    }}>{count} perm.</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PANNELLO PERMESSI */}
          <div>
            {selectedRow ? (
              <>
                {/* Header ruolo con azioni */}
                <div style={{
                  padding: '20px 24px', borderRadius: '16px 16px 0 0',
                  background: getRoleGradient(selectedRow.role_code),
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ padding: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 12 }}>
                    <Shield size={26} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 21, color: '#fff', letterSpacing: '-0.02em' }}>{selectedRow.role_name}</div>
                    <code style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{selectedRow.role_code}</code>
                  </div>
                  {isSuperAdminUser && !selectedRoleIsProtected && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setRoleInput(roles.find(x => x.id === selectedRoleId)?.name || ''); setModalType('editRole'); }} style={{
                        padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <Edit2 size={13} /> Rinomina
                      </button>
                      <button onClick={handleDeleteRole} disabled={processing} style={{
                        padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'rgba(239,68,68,0.75)', color: '#fff', fontWeight: 700, fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <Trash2 size={13} /> Elimina
                      </button>
                    </div>
                  )}
                  {selectedRoleIsSuperAdmin && (
                    <span style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 20 }}>
                      🔓 Accesso Completo
                    </span>
                  )}
                </div>

                {/* Barra info */}
                <div style={{ background: 'var(--color-surface)', padding: '10px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Attiva o disattiva i singoli moduli per questo ruolo.</span>
                  <span style={{ fontSize: 12, fontWeight: 800, background: 'var(--color-bg)', color: 'var(--color-text)', padding: '3px 12px', borderRadius: 16 }}>
                    {selectedRow.permission_ids?.length ?? 0} / {permissions.length}
                  </span>
                </div>

                {/* Permessi a gruppi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 20 }}>
                  {Object.entries(permGroups).map(([group, perms]) => (
                    <div key={group} className="sp-table-wrap" style={{ overflow: 'visible', margin: 0 }}>
                      <div style={{
                        padding: '10px 20px', fontSize: 11, fontWeight: 900, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', background: 'var(--color-bg)',
                        borderBottom: '1px solid var(--color-border)', borderRadius: '12px 12px 0 0',
                      }}>
                        📁 {group}
                      </div>
                      {perms.map((perm, idx) => {
                        const granted = isGranted(selectedRow.role_id, perm.id);
                        const key = `${selectedRow.role_id}-${perm.id}`;
                        const isTogg = toggling === key;
                        const last = idx === perms.length - 1;
                        return (
                          <div key={perm.id} style={{
                            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                            borderBottom: last ? 'none' : '1px solid var(--color-border)',
                            background: granted ? 'rgba(34,197,94,0.03)' : 'var(--color-surface)',
                            transition: 'background 0.12s', borderRadius: last ? '0 0 12px 12px' : 0,
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: granted ? '#16a34a' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                {(selectedRoleIsSuperAdmin || granted)
                                  ? <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                                  : <XCircle size={15} style={{ flexShrink: 0, color: 'var(--color-border)' }} />}
                                {perm.name}
                              </div>
                              {perm.description && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1, marginLeft: 22 }}>{perm.description}</div>}
                            </div>
                            {!selectedRoleIsSuperAdmin && (
                              <button
                                onClick={() => handleToggle(selectedRow.role_id, perm.id)}
                                disabled={!!isTogg}
                                style={{
                                  flexShrink: 0, padding: '7px 18px', borderRadius: 9, border: 'none',
                                  fontSize: 12, fontWeight: 800, cursor: isTogg ? 'wait' : 'pointer', minWidth: 110, textAlign: 'center',
                                  background: granted ? 'rgba(239,68,68,0.1)' : 'var(--color-text)',
                                  color: granted ? '#ef4444' : 'var(--color-surface)',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {isTogg ? <Loader2 size={13} className="animate-spin inline" /> : granted ? 'Revoca' : 'Concedi'}
                              </button>
                            )}
                            {isSuperAdminUser && (
                              <button
                                onClick={() => handleDeletePermission(perm.id, perm.name)}
                                disabled={processing}
                                title="Elimina questo permesso dal sistema"
                                style={{
                                  flexShrink: 0, padding: '7px 10px', borderRadius: 9, border: 'none',
                                  background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                  cursor: processing ? 'wait' : 'pointer', transition: 'all 0.15s',
                                  display: 'flex', alignItems: 'center',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)', borderRadius: 20, border: '1px dashed var(--color-border)' }}>
                <Shield size={44} style={{ margin: '0 auto 14px', opacity: 0.15 }} />
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--color-text)', marginBottom: 6 }}>Nessun Ruolo Selezionato</div>
                <p style={{ margin: 0, fontSize: 13 }}>Clicca su un ruolo nella lista a sinistra per gestirne i permessi</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: UTENTI & RUOLI
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>

          {/* LISTA UTENTI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Utenti del sistema
            </div>
            {usersLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                <Loader2 size={18} style={{ animation: 'spin .7s linear infinite', display: 'inline' }} />
              </div>
            ) : users.map(u => {
              const isSelected = selectedUserId === u.id;
              const roleCount = u.roles?.length ?? 0;
              return (
                <div key={u.id} onClick={() => setSelU(u.id)} style={{
                  padding: '13px 15px', borderRadius: 13, cursor: 'pointer',
                  background: isSelected ? 'var(--color-accent)' : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'transparent' : 'var(--color-border)'}`,
                  transform: isSelected ? 'scale(1.02)' : 'none',
                  transition: 'all 0.18s',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: isSelected ? '#fff' : 'var(--color-text)', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {u.name}
                    {isSuperAdminUser && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteUser(u.id, u.name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? 'rgba(255,255,255,0.6)' : '#ef4444', padding: '2px 4px', borderRadius: 6, lineHeight: 1 }}
                        title="Elimina utente"
                      >✕</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.65)' : 'var(--color-text-tertiary)' }}>{u.email}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 16,
                      background: isSelected ? 'rgba(255,255,255,0.22)' : 'var(--color-bg)',
                      color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                    }}>{roleCount} ruoli</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PANNELLO RUOLI UTENTE */}
          <div>
            {selectedUser ? (
              <>
                {/* Header utente */}
                <div style={{
                  padding: '18px 24px', background: 'linear-gradient(135deg,#1e1b4b,#312e81)',
                  borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ padding: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 12 }}>
                    <Users size={26} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 20, color: '#fff' }}>{selectedUser.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{selectedUser.email}</div>
                  </div>
                  <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '5px 14px', borderRadius: 20 }}>
                    {selectedUser.roles?.length ?? 0} ruoli assegnati
                  </span>
                  {isSuperAdminUser && (
                    <button
                      onClick={() => openEditUser(selectedUser)}
                      title="Modifica nome, email o password"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                    >
                      <Edit2 size={13} /> Modifica
                    </button>
                  )}
                </div>

                {/* Info bar */}
                <div style={{ background: 'var(--color-surface)', padding: '10px 24px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    Seleziona quali ruoli assegnare o rimuovere a questo utente.
                  </span>
                </div>

                {/* Lista ruoli con toggle */}
                <div style={{ background: 'var(--color-surface)', borderRadius: '0 0 16px 16px' }}>
                  {roles.map((role, idx) => {
                    const last = idx === roles.length - 1;
                    const userHasRole = (selectedUser.roles || []).some(r => r.role_id === role.id);
                    const grad = getRoleGradient(role.code);
                    return (
                      <div key={role.id} style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px',
                        borderBottom: last ? 'none' : '1px solid var(--color-border)',
                        borderRadius: last ? '0 0 16px 16px' : 0,
                        background: userHasRole ? 'rgba(79,70,229,0.04)' : 'var(--color-surface)',
                        transition: 'background 0.12s',
                      }}>
                        {/* Badge ruolo */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: grad.split(',')[1] || '#999', flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: userHasRole ? '#4F46E5' : 'var(--color-text)' }}>{role.name}</div>
                          <code style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{role.code}</code>
                        </div>
                        {userHasRole
                          ? <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                          : <XCircle size={18} style={{ color: 'var(--color-border)', flexShrink: 0 }} />}
                        {isSuperAdminUser && (
                          <button
                            onClick={() => handleToggleUserRole(selectedUser.id, role.id, userHasRole)}
                            disabled={processing}
                            style={{
                              padding: '7px 18px', borderRadius: 9, border: 'none', minWidth: 110, textAlign: 'center',
                              fontWeight: 800, fontSize: 12, cursor: processing ? 'wait' : 'pointer',
                              background: userHasRole ? 'rgba(239,68,68,0.1)' : 'var(--color-text)',
                              color: userHasRole ? '#ef4444' : 'var(--color-surface)',
                              transition: 'all 0.15s',
                            }}
                          >
                            {userHasRole ? 'Rimuovi' : 'Assegna'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-text-tertiary)', background: 'var(--color-surface)', borderRadius: 20, border: '1px dashed var(--color-border)' }}>
                <Users size={44} style={{ margin: '0 auto 14px', opacity: 0.15 }} />
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--color-text)', marginBottom: 6 }}>Nessun Utente Selezionato</div>
                <p style={{ margin: 0, fontSize: 13 }}>Seleziona un utente dalla lista per gestirne i ruoli</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALI
      ══════════════════════════════════════════════════════════════════ */}
      {(modalType === 'createRole' || modalType === 'editRole') && (
        <Modal
          title={modalType === 'createRole' ? '✦ Crea Nuovo Ruolo' : '✏ Rinomina Ruolo'}
          subtitle={modalType === 'createRole'
            ? 'Definisci il nome del nuovo ruolo. Potrai subito assegnargli i permessi.'
            : 'Cambia il nome del ruolo. I permessi resteranno invariati.'}
          onClose={() => setModalType(null)}
        >
          <form onSubmit={handleSaveRole}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Nome del ruolo
              </label>
              <input
                autoFocus required value={roleInput} onChange={e => setRoleInput(e.target.value)}
                placeholder="Es: Area Manager, Responsabile Magazzino..."
                style={{
                  width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                  border: '2px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
                  outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalType(null)} style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontWeight: 800, cursor: 'pointer' }}>
                Annulla
              </button>
              <button type="submit" disabled={processing} style={{ padding: '11px 24px', borderRadius: 11, border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 800, cursor: processing ? 'wait' : 'pointer', boxShadow: '0 6px 16px rgba(79,70,229,0.28)' }}>
                {processing ? 'Salvataggio...' : 'Conferma'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ MODAL: NUOVO MODULO/PERMESSO ══ */}
      {modalType === 'createPermission' && (
        <Modal title="Nuovo Modulo / Permesso" onClose={() => setModalType(null)}>
          <form onSubmit={handleCreatePermission} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Nome del modulo *</label>
              <input autoFocus className="sp-input" placeholder="Es. Gestione magazzino avanzato" value={permName} onChange={e => setPermName(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>
                Codice univoco <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(opzionale — generato automaticamente)</span>
              </label>
              <input className="sp-input" placeholder="Es. warehouse_advanced.manage" value={permCode} onChange={e => setPermCode(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalType(null)} style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontWeight: 800, cursor: 'pointer' }}>Annulla</button>
              <button type="submit" disabled={processing} style={{ padding: '11px 24px', borderRadius: 11, border: 'none', background: '#0891b2', color: '#fff', fontWeight: 800, cursor: processing ? 'wait' : 'pointer' }}>
                {processing ? 'Creazione...' : '+ Crea Modulo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ MODAL: NUOVO UTENTE ══ */}
      {modalType === 'createUser' && (
        <Modal title="Crea Nuovo Utente" onClose={() => setModalType(null)}>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Nome Completo *</label>
                <input autoFocus className="sp-input" placeholder="Es. Mario Rossi" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Email *</label>
                <input type="email" className="sp-input" placeholder="Es. mario@esempio.it" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Password iniziale *</label>
              <input type="password" className="sp-input" placeholder="Minimo 8 caratteri" value={newUserPw} onChange={e => setNewUserPw(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Ruolo iniziale <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)' }}>(opzionale)</span></label>
              <select className="sp-select" value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={{ width: '100%', minHeight: 42 }}>
                <option value="">— Nessun ruolo —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              💡 L'utente potrà cambiare la password dal pannello Impostazioni al primo accesso.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalType(null)} style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontWeight: 800, cursor: 'pointer' }}>Annulla</button>
              <button type="submit" disabled={processing} style={{ padding: '11px 24px', borderRadius: 11, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 800, cursor: processing ? 'wait' : 'pointer' }}>
                {processing ? 'Creazione...' : '+ Crea Utente'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══ MODAL: MODIFICA UTENTE (solo superadmin) ══ */}
      {modalType === 'editUser' && (
        <Modal
          title="✏ Modifica Utente"
          subtitle="Solo i superadmin possono modificare queste informazioni. La password ??visibile solo in questa schermata."
          onClose={() => setModalType(null)}
        >
          <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Nome */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Nome Completo *</label>
              <input
                autoFocus className="sp-input"
                value={editUserName} onChange={e => setEditUserName(e.target.value)} required
              />
            </div>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>Email *</label>
              <input
                type="email" className="sp-input"
                value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} required
              />
            </div>
            {/* Password con eye toggle */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>
                Password
                <span style={{ fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>(lascia vuoto per non cambiarla)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showEditPw ? 'text' : 'password'}
                  className="sp-input"
                  style={{ paddingRight: 44, fontFamily: showEditPw ? 'monospace' : undefined, letterSpacing: showEditPw ? '0.05em' : undefined }}
                  value={editUserPw} onChange={e => setEditUserPw(e.target.value)}
                  placeholder="Nuova password (min. 6 caratteri)"
                  minLength={editUserPw.length > 0 ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPw(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: showEditPw ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                    display: 'flex', alignItems: 'center', padding: 4,
                  }}
                  title={showEditPw ? 'Nascondi password' : 'Mostra password'}
                >
                  {showEditPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {showEditPw && editUserPw && (
                <div style={{ marginTop: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔑 Password visibile: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }}>{editUserPw}</strong>
                </div>
              )}
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(79,70,229,0.07)', border: '1px solid rgba(79,70,229,0.18)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              🔒 Queste modifiche sono registrate nel log di audit.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalType(null)} style={{ padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontWeight: 800, cursor: 'pointer' }}>Annulla</button>
              <button type="submit" disabled={processing} style={{ padding: '11px 24px', borderRadius: 11, border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 800, cursor: processing ? 'wait' : 'pointer', boxShadow: '0 6px 16px rgba(79,70,229,0.28)' }}>
                {processing ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
