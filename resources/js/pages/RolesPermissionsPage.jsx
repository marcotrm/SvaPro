import React, { useState, useEffect } from 'react';
import { rolesPermissions, clearApiCache } from '../api.jsx';
import { SkeletonTable } from '../components/Skeleton.jsx';

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(null); // "roleId-permId"

  useEffect(() => { fetchMatrix(); }, []);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await rolesPermissions.getMatrix();
      setRoles(res.data?.roles || []);
      setPermissions(res.data?.permissions || []);
      setMatrix(res.data?.matrix || []);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
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
    } finally {
      setToggling(null);
    }
  };

  const isGranted = (roleId, permissionId) => {
    const row = matrix.find(r => r.role_id === roleId);
    return row ? row.permission_ids.includes(permissionId) : false;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Ruoli & Permessi</div>
          <div className="page-head-sub">
            Matrice di accesso — {roles.length} ruoli, {permissions.length} permessi
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-banner" style={{ borderColor: 'rgba(230,76,60,.4)' }}>
          <span className="icon">✕</span>
          <span><strong>Errore:</strong> {error}</span>
          <button className="banner-link" onClick={fetchMatrix}>Riprova →</button>
        </div>
      )}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24 }}><SkeletonTable rows={5} cols={7} /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 }}>Ruolo</th>
                  {permissions.map(p => (
                    <th key={p.id} style={{ textAlign: 'center', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(row => (
                  <tr key={row.role_id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {row.role_name}
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{row.role_code}</span>
                    </td>
                    {permissions.map(p => {
                      const granted = isGranted(row.role_id, p.id);
                      const isToggling = toggling === `${row.role_id}-${p.id}`;
                      const isSuperAdmin = row.role_code === 'superadmin';
                      return (
                        <td key={p.id} style={{ textAlign: 'center', padding: '8px 12px' }}>
                          <button
                            onClick={() => !isSuperAdmin && handleToggle(row.role_id, p.id)}
                            disabled={isToggling || isSuperAdmin}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: 'none',
                              cursor: isSuperAdmin ? 'not-allowed' : 'pointer',
                              opacity: isSuperAdmin ? 0.5 : 1,
                              background: granted ? 'var(--gold)' : 'var(--border)',
                              color: granted ? '#fff' : 'var(--muted)',
                              fontWeight: 700,
                              fontSize: 14,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all .15s',
                            }}
                            title={isSuperAdmin ? 'Superadmin ha tutti i permessi' : (granted ? 'Revoca' : 'Assegna')}
                          >
                            {isToggling ? '…' : (granted ? '✓' : '–')}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
