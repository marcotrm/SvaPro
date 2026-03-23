import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import { useTranslation } from '../i18n/index.jsx';

export default function SettingsPage() {
  const { user, setUser } = useOutletContext();
  const { lang, setLang, t } = useTranslation();
  const isSuperAdmin = (user?.roles || []).includes('superadmin');
  const isAdmin = isSuperAdmin || (user?.roles || []).includes('admin_cliente');

  /* ── Profile state ── */
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  /* ── Tenant settings state ── */
  const [tenantName, setTenantName] = useState('');
  const [tenantVat, setTenantVat] = useState('');
  const [tenantTimezone, setTenantTimezone] = useState('Europe/Rome');
  const [tenantMsg, setTenantMsg] = useState('');
  const [tenantErr, setTenantErr] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      stores.getTenantSettings().then(res => {
        const t = res.data?.data;
        if (t) {
          setTenantName(t.name || '');
          setTenantVat(t.vat_number || '');
          setTenantTimezone(t.timezone || 'Europe/Rome');
        }
      }).catch(() => {});
    }
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    setProfileErr('');
    try {
      const payload = { name, email };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
        payload.new_password_confirmation = newPasswordConfirmation;
      }
      const res = await auth.updateProfile(payload);
      clearApiCache();
      const updated = res.data.user;
      localStorage.setItem('user', JSON.stringify(updated));
      if (setUser) setUser(updated);
      setProfileMsg('Profilo aggiornato con successo.');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
    } catch (err) {
      setProfileErr(err.response?.data?.message || err.message || 'Errore nel salvataggio.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    setSavingTenant(true);
    setTenantMsg('');
    setTenantErr('');
    try {
      await stores.updateTenantSettings({
        name: tenantName,
        vat_number: tenantVat,
        timezone: tenantTimezone,
      });
      clearApiCache();
      setTenantMsg('Impostazioni tenant aggiornate.');
    } catch (err) {
      setTenantErr(err.response?.data?.message || err.message || 'Errore nel salvataggio.');
    } finally {
      setSavingTenant(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head-title">Impostazioni</div>
          <div className="page-head-sub">Profilo utente e configurazione tenant</div>
        </div>
      </div>

      {/* ── Profile Card ── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Profilo Utente
        </h3>
        <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: 14, maxWidth: 480 }}>
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0', paddingTop: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted2)' }}>Cambia Password (opzionale)</span>
          </div>

          <div className="form-group">
            <label className="form-label">Password Attuale</label>
            <input className="form-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Nuova Password</label>
            <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Conferma Nuova Password</label>
            <input className="form-input" type="password" value={newPasswordConfirmation} onChange={e => setNewPasswordConfirmation(e.target.value)} autoComplete="new-password" />
          </div>

          {profileMsg && <div style={{ color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>{profileMsg}</div>}
          {profileErr && <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 500 }}>{profileErr}</div>}

          <button className="btn btn-gold" type="submit" disabled={savingProfile} style={{ justifyContent: 'center', width: 'fit-content' }}>
            {savingProfile ? 'Salvataggio...' : 'Salva Profilo'}
          </button>
        </form>
      </div>

      {/* ── Language Card ── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          {t('language')}
        </h3>
        <div style={{ display: 'flex', gap: 10, maxWidth: 480 }}>
          <button
            className={`btn ${lang === 'it' ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => setLang('it')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            🇮🇹 {t('italian')}
          </button>
          <button
            className={`btn ${lang === 'en' ? 'btn-gold' : 'btn-ghost'}`}
            onClick={() => setLang('en')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            🇬🇧 {t('english')}
          </button>
        </div>
      </div>

      {/* ── Tenant Settings Card ── */}
      {isAdmin && (
        <div className="table-card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Impostazioni Tenant
          </h3>
          <form onSubmit={handleSaveTenant} style={{ display: 'grid', gap: 14, maxWidth: 480 }}>
            <div className="form-group">
              <label className="form-label">Nome Azienda</label>
              <input className="form-input" value={tenantName} onChange={e => setTenantName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Partita IVA</label>
              <input className="form-input" value={tenantVat} onChange={e => setTenantVat(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fuso orario</label>
              <select className="form-select" value={tenantTimezone} onChange={e => setTenantTimezone(e.target.value)}>
                <option value="Europe/Rome">Europe/Rome</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            {tenantMsg && <div style={{ color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>{tenantMsg}</div>}
            {tenantErr && <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 500 }}>{tenantErr}</div>}

            <button className="btn btn-gold" type="submit" disabled={savingTenant} style={{ justifyContent: 'center', width: 'fit-content' }}>
              {savingTenant ? 'Salvataggio...' : 'Salva Impostazioni'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
