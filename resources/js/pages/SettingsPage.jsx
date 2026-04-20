import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import {
  User, Shield, Save, Lock, Mail, Building2, Landmark, Clock,
  Globe, Layout, Eye, Smartphone, CheckCircle2, AlertCircle,
  Wifi, Database, Bell, Palette, ChevronRight
} from 'lucide-react';

// ─────────────────────────────────
// Design tokens locali
// ─────────────────────────────────
const C = {
  accent: '#4F46E5',
  accentLight: 'rgba(79,70,229,0.08)',
  green: '#22c55e',
  red: '#ef4444',
};

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)', borderRadius: '16px 16px 0 0' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent, flexShrink: 0 }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function FieldGroup({ children }) {
  return <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{hint}</p>}
    </div>
  );
}

function Input({ icon: Icon, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused ? C.accent : 'var(--color-text-tertiary)', transition: 'color 0.15s', pointerEvents: 'none' }} />}
      <input
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        style={{
          width: '100%', padding: Icon ? '12px 14px 12px 40px' : '12px 14px',
          borderRadius: 10, border: `2px solid ${focused ? C.accent : 'var(--color-border)'}`,
          background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, fontWeight: 600,
          outline: 'none', transition: 'border-color 0.18s', boxSizing: 'border-box',
          ...props.style,
        }}
      />
    </div>
  );
}

function Select({ icon: Icon, children, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />}
      <select
        {...props}
        style={{
          width: '100%', padding: Icon ? '12px 14px 12px 40px' : '12px 14px',
          borderRadius: 10, border: '2px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, fontWeight: 600,
          outline: 'none', appearance: 'none', cursor: 'pointer', ...props.style,
        }}
      >
        {children}
      </select>
    </div>
  );
}

function StatusBanner({ success, error }) {
  if (!success && !error) return null;
  return (
    <div style={{
      margin: '0 24px 16px', padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 10,
      background: success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      color: success ? '#16a34a' : '#dc2626',
      border: `1px solid ${success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
    }}>
      {success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {success || error}
    </div>
  );
}

function SaveButton({ loading, label = 'Salva Modifiche' }) {
  return (
    <button
      type="submit" disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 10,
        border: 'none', background: C.accent, color: '#fff', fontWeight: 800, fontSize: 14,
        cursor: loading ? 'wait' : 'pointer', boxShadow: '0 6px 18px rgba(79,70,229,0.28)',
        transition: 'all 0.15s',
      }}
    >
      <Save size={16} /> {loading ? 'Salvataggio...' : label}
    </button>
  );
}

// ─────────────────────────────────
// PAGINA
// ─────────────────────────────────
export default function SettingsPage() {
  const { user, setUser, displayMode, setDisplayMode } = useOutletContext();
  const isSuperAdmin = (user?.roles || []).includes('superadmin');
  const isAdmin = isSuperAdmin || (user?.roles || []).includes('admin_cliente');

  // ── Profilo ──
  const [name, setName]                 = useState(user?.name || '');
  const [email, setEmail]               = useState(user?.email || '');
  const [curPw, setCurPw]               = useState('');
  const [newPw, setNewPw]               = useState('');
  const [newPwConf, setNewPwConf]       = useState('');
  const [profileMsg, setProfileMsg]     = useState('');
  const [profileErr, setProfileErr]     = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Tenant ──
  const [tenantName, setTenantName]     = useState('');
  const [tenantVat, setTenantVat]       = useState('');
  const [tenantTz, setTenantTz]         = useState('Europe/Rome');
  const [tenantLicense, setTenantLicense] = useState('');
  const [qscarePrice, setQscarePrice]   = useState('');
  const [wooUrl, setWooUrl]             = useState('');
  const [wooKey, setWooKey]             = useState('');
  const [wooSecret, setWooSecret]       = useState('');
  const [tenantMsg, setTenantMsg]       = useState('');
  const [tenantErr, setTenantErr]       = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      stores.getTenantSettings().then(res => {
        const t = res.data?.data;
        if (t) {
          setTenantName(t.name || '');
          setTenantVat(t.vat_number || '');
          setTenantTz(t.timezone || 'Europe/Rome');
          setTenantLicense(t.license_code || '');
          const sj = t.settings_json;
          if (sj?.qscare_price != null) setQscarePrice(String(sj.qscare_price));
          if (sj?.woocommerce_api_url) setWooUrl(sj.woocommerce_api_url);
          if (sj?.woocommerce_consumer_key) setWooKey(sj.woocommerce_consumer_key);
          if (sj?.woocommerce_consumer_secret) setWooSecret(sj.woocommerce_consumer_secret);
        }
      }).catch(() => {});
    }
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true); setProfileMsg(''); setProfileErr('');
    try {
      const payload = { name, email };
      if (newPw) { payload.current_password = curPw; payload.new_password = newPw; payload.new_password_confirmation = newPwConf; }
      const res = await auth.updateProfile(payload);
      clearApiCache();
      const updated = res.data.user;
      localStorage.setItem('user', JSON.stringify(updated));
      if (setUser) setUser(updated);
      setProfileMsg('Profilo aggiornato con successo.');
      setCurPw(''); setNewPw(''); setNewPwConf('');
    } catch (err) {
      setProfileErr(err.response?.data?.message || err.message || 'Errore nel salvataggio.');
    } finally { setSavingProfile(false); }
  };

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    setSavingTenant(true); setTenantMsg(''); setTenantErr('');
    try {
      await stores.updateTenantSettings({
        name: tenantName, vat_number: tenantVat, timezone: tenantTz, license_code: tenantLicense,
        settings_json: {
          qscare_price: qscarePrice !== '' ? parseFloat(qscarePrice) : null,
          woocommerce_api_url: wooUrl,
          woocommerce_consumer_key: wooKey,
          woocommerce_consumer_secret: wooSecret,
        },
      });
      clearApiCache();
      setTenantMsg('Impostazioni azienda aggiornate.');
    } catch (err) {
      setTenantErr(err.response?.data?.message || err.message || 'Errore nel salvataggio.');
    } finally { setSavingTenant(false); }
  };

  // ─────────────────────────────────
  // RENDER
  // ─────────────────────────────────
  return (
    <div className="sp-animate-in" style={{ maxWidth: 1080 }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
          Impostazioni
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-text-secondary)' }}>
          Profilo, azienda, integrazioni e preferenze di visualizzazione
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* ─────────────────────────────── LEFT COLUMN ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── PROFILO ── */}
          <Card>
            <SectionTitle icon={User} title="Profilo Personale" subtitle="Dati di accesso e sicurezza account" />
            <form onSubmit={handleSaveProfile}>
              <FieldGroup>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Nome Completo">
                    <Input icon={User} value={name} onChange={e => setName(e.target.value)} required />
                  </Field>
                  <Field label="Email">
                    <Input icon={Mail} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                  </Field>
                </div>

                {/* Cambio password */}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                    <Lock size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Cambia Password
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <Field label="Password attuale">
                      <Input icon={Lock} type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" />
                    </Field>
                    <Field label="Nuova password">
                      <Input icon={Lock} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
                    </Field>
                    <Field label="Conferma nuova">
                      <Input icon={Lock} type="password" value={newPwConf} onChange={e => setNewPwConf(e.target.value)} placeholder="••••••••" />
                    </Field>
                  </div>
                </div>
              </FieldGroup>

              <StatusBanner success={profileMsg} error={profileErr} />

              <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                <SaveButton loading={savingProfile} label="Salva Profilo" />
              </div>
            </form>
          </Card>

          {/* ── AZIENDA (solo admin) ── */}
          {isAdmin && (
            <Card>
              <SectionTitle icon={Building2} title="Configurazione Azienda" subtitle="Ragione sociale, P.IVA e fuso orario" />
              <form onSubmit={handleSaveTenant}>
                <FieldGroup>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Ragione Sociale">
                      <Input icon={Building2} value={tenantName} onChange={e => setTenantName(e.target.value)} required />
                    </Field>
                    <Field label="Partita IVA / Tax ID">
                      <Input icon={Landmark} value={tenantVat} onChange={e => setTenantVat(e.target.value)} />
                    </Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Fuso Orario">
                      <Select icon={Clock} value={tenantTz} onChange={e => setTenantTz(e.target.value)}>
                        <option value="Europe/Rome">Europe/Rome (Italia)</option>
                        <option value="Europe/London">Europe/London (UK)</option>
                        <option value="UTC">UTC</option>
                      </Select>
                    </Field>
                    <Field label="Codice Licenza" hint="Fornito da SvaPro per attivare funzioni premium.">
                      <Input icon={Shield} value={tenantLicense} onChange={e => setTenantLicense(e.target.value.toUpperCase())} placeholder="SVAPRO-XXXX-XXXX-XXXX" style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }} />
                    </Field>
                  </div>
                </FieldGroup>

                {/* QScare */}
                <div style={{ margin: '0 24px 20px', padding: 20, borderRadius: 12, background: C.accentLight, border: '1px solid rgba(79,70,229,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>🛡</span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--color-text)' }}>QScare — Assicurazione Dispositivo</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Toggle disponibile nel POS per ogni vendita</div>
                    </div>
                  </div>
                  <Field label="Prezzo Assicurazione (€)" hint="Lascia vuoto per disabilitare QScare nel POS.">
                    <Input type="number" min="0" step="0.01" value={qscarePrice} onChange={e => setQscarePrice(e.target.value)} placeholder="Es: 4.99" style={{ maxWidth: 200 }} />
                  </Field>
                </div>

                {/* WooCommerce */}
                <div style={{ margin: '0 24px 20px', padding: 20, borderRadius: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 22 }}>🛍</span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--color-text)' }}>Integrazione WooCommerce</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Sincronizza prodotti e magazzino con il tuo negozio online</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="URL Negozio Online">
                      <Input icon={Wifi} type="url" value={wooUrl} onChange={e => setWooUrl(e.target.value)} placeholder="https://www.ilmiosito.it" />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="Consumer Key (ck_...)">
                        <Input type="text" value={wooKey} onChange={e => setWooKey(e.target.value)} placeholder="ck_xxx" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                      </Field>
                      <Field label="Consumer Secret (cs_...)">
                        <Input type="password" value={wooSecret} onChange={e => setWooSecret(e.target.value)} placeholder="cs_xxx" />
                      </Field>
                    </div>
                  </div>
                </div>

                <StatusBanner success={tenantMsg} error={tenantErr} />
                <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <SaveButton loading={savingTenant} label="Salva Impostazioni Azienda" />
                </div>
              </form>
            </Card>
          )}
        </div>

        {/* ─────────────────────────────── RIGHT SIDEBAR ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Visualizzazione */}
          <Card>
            <SectionTitle icon={Layout} title="Visualizzazione" subtitle="Modalità di presentazione dati" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'name', icon: Eye, label: 'Nomi Prodotto', desc: 'Mostra i nomi completi' },
                { value: 'sku', icon: Smartphone, label: 'Codici SKU', desc: 'Mostra i codici identificativi' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <button key={value} onClick={() => setDisplayMode(value)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
                  border: `2px solid ${displayMode === value ? C.accent : 'var(--color-border)'}`,
                  background: displayMode === value ? C.accentLight : 'var(--color-bg)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}>
                  <Icon size={20} style={{ color: displayMode === value ? C.accent : 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: displayMode === value ? C.accent : 'var(--color-text)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{desc}</div>
                  </div>
                  {displayMode === value && <CheckCircle2 size={16} style={{ color: C.accent, flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </Card>

          {/* Info sistema */}
          <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', borderRadius: 18, padding: 24, color: '#fff' }}>
            <Shield size={28} style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 12 }} />
            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 6, letterSpacing: '-0.01em' }}>Sistema Sicuro</div>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px' }}>
              Tutte le modifiche alle impostazioni vengono registrate nell'Audit Log. Ogni azione è tracciata e protetta.
            </p>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
              v{new Date().getFullYear()} · SvaPro
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
