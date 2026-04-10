import React, { useState, useEffect } from 'react';
import { rolesPermissions, clearApiCache } from '../api.jsx';
import { Shield, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const roleColors = {
  superadmin:    { bg: 'linear-gradient(135deg,#4F46E5,#7B6FD0)', text: '#fff', badge: '#4F46E5' },
  admin_cliente: { bg: 'linear-gradient(135deg,#0891B2,#06b6d4)', text: '#fff', badge: '#0891B2' },
  dipendente:    { bg: 'linear-gradient(135deg,#16A34A,#22c55e)', text: '#fff', badge: '#16A34A' },
  cliente_finale:{ bg: 'linear-gradient(135deg,#F59E0B,#fbbf24)', text: '#fff', badge: '#F59E0B' },
};

function getRole(code) {
  return roleColors[code] || { bg: 'linear-gradient(135deg,#6B7280,#9CA3AF)', text: '#fff', badge: '#6B7280' };
}

export default function RolesPermissionsPage() {
  const [roles, setRoles]           = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [toggling, setToggling]     = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // ID del ruolo evidenziato

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

  const isGranted = (roleId, permId) => {
    const row = matrix.find(r => r.role_id === roleId);
    return row ? row.permission_ids.includes(permId) : false;
  };

  const selectedRow = matrix.find(r => r.role_id === selectedRole);
  const isSuperAdmin = selectedRow?.role_code === 'superadmin';

  // Raggruppa permessi per prefisso
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
    <div className="sp-animate-in">

      {/* Header */}
      <div className="sp-page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="sp-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} style={{ color: 'var(--color-accent)' }} /> Ruoli & Permessi
          </h1>
          <p className="sp-page-subtitle">{roles.length} ruoli · {permissions.length} permessi configurabili</p>
        </div>
        <button className="sp-btn sp-btn-secondary" onClick={fetchMatrix}>
          <RefreshCw size={14} /> Aggiorna
        </button>
      </div>

      {error && (
        <div className="sp-alert sp-alert-error" style={{ marginBottom: 16 }}>
          ⚠ {error}
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={fetchMatrix} style={{ marginLeft: 'auto' }}>Riprova</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Colonna sinistra — Lista Ruoli */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Seleziona Ruolo
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
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: isSelected ? pal.bg : 'var(--color-surface)',
                  border: `2px solid ${isSelected ? 'transparent' : 'var(--color-border)'}`,
                  boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.18s',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: isSelected ? pal.text : 'var(--color-text)', marginBottom: 3 }}>
                  {role.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                    color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--color-text-tertiary)',
                  }}>
                    {role.code}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                    background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-bg)',
                    color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                    padding: '2px 8px', borderRadius: 20,
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
            <>
              {/* Header ruolo selezionato */}
              <div style={{
                padding: '16px 20px', borderRadius: 14, marginBottom: 16,
                background: getRole(selectedRow.role_code).bg,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <Shield size={24} color="rgba(255,255,255,0.8)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>{selectedRow.role_name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', marginTop: 2 }}>{selectedRow.role_code}</div>
                </div>
                {isSuperAdmin && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                    🔓 Accesso Completo
                  </span>
                )}
                {!isSuperAdmin && (
                  <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
                    {selectedRow.permission_ids?.length ?? 0} / {permissions.length} permessi
                  </span>
                )}
              </div>

              {/* Permessi raggruppati */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(permGroups).map(([group, perms]) => (
                  <div key={group} className="sp-table-wrap" style={{ overflow: 'visible' }}>
                    {/* Group header */}
                    <div style={{
                      padding: '10px 16px', borderBottom: '1px solid var(--color-border)',
                      fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--color-text-tertiary)', background: 'var(--color-bg)',
                      borderRadius: '12px 12px 0 0',
                    }}>
                      {group}
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
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '12px 16px',
                            borderBottom: last ? 'none' : '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            borderRadius: last ? '0 0 12px 12px' : 0,
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { if (!isSuperAdmin) e.currentTarget.style.background = 'var(--color-bg)'; }}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface)'}
                        >
                          {/* Stato permesso */}
                          <div style={{ flexShrink: 0 }}>
                            {isSuperAdmin ? (
                              <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
                            ) : granted ? (
                              <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
                            ) : (
                              <XCircle size={20} style={{ color: 'var(--color-border)', opacity: 0.6 }} />
                            )}
                          </div>

                          {/* Nome permesso */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>
                              {perm.name}
                            </div>
                            {perm.description && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                                {perm.description}
                              </div>
                            )}
                          </div>

                          {/* Toggle button */}
                          {!isSuperAdmin && (
                            <button
                              onClick={() => handleToggle(selectedRow.role_id, perm.id)}
                              disabled={!!isTogg}
                              style={{
                                flexShrink: 0, padding: '6px 16px', borderRadius: 8, border: 'none',
                                fontSize: 12, fontWeight: 700, cursor: isTogg ? 'wait' : 'pointer',
                                background: granted
                                  ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                color: granted ? '#ef4444' : '#16a34a',
                                transition: 'all 0.15s',
                                minWidth: 80, textAlign: 'center',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                            >
                              {isTogg ? '...' : granted ? 'Revoca' : 'Assegna'}
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
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              Seleziona un ruolo dalla lista
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
