import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../api.jsx';

export default function LoginPage({ setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const applyDemoAccess = () => {
    setEmail('admin@demo.local');
    setPassword('ChangeMe123!');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await auth.login(email, password);
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('tenantCode', response.data.user.tenant_code || 'DEMO');
      setUser(response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login fallito. Controlla email e password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* â”€â”€ LEFT BRAND PANEL â”€â”€ */}
      <div className="login-left">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />

        {/* Logo */}
        <div className="login-brand">
          <div className="login-brand-icon">S</div>
          <div>
            <div className="login-brand-name">Sva<span>Pro</span></div>
            <div className="login-brand-sub">Retail Intelligence Suite</div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="login-hero">
          <div className="login-pill">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Pannello operativo multi-store
          </div>
          <div className="login-headline">
            Gestionale<br />progettato per<br /><span>chi vende davvero</span>
          </div>
          <div className="login-sub">
            Catalogo, ordini, loyalty, dipendenti e magazzino intelligente in un'unica interfaccia â€”
            con reorder automatico basato sullo storico vendite.
          </div>
        </div>

        {/* Stats */}
        <div className="login-stats">
          <div className="login-stat">
            <div className="login-stat-label">Store</div>
            <div className="login-stat-value">2</div>
            <div className="login-stat-desc">Roma e Milano con stock demo</div>
          </div>
          <div className="login-stat">
            <div className="login-stat-label">Ruoli</div>
            <div className="login-stat-value">4</div>
            <div className="login-stat-desc">Superadmin, admin, dipendente, cliente</div>
          </div>
          <div className="login-stat">
            <div className="login-stat-label">Tenant</div>
            <div className="login-stat-value">DEMO</div>
            <div className="login-stat-desc">Accesso pronto senza config</div>
          </div>
        </div>

        {/* Footer badge */}
        <div className="login-badge">
          <span className="login-badge-dot" />
          Seed verificato â€” login reale con API Laravel
        </div>
      </div>

      {/* â”€â”€ RIGHT FORM PANEL â”€â”€ */}
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-card">
            <div className="login-card-eyebrow">Accesso Operatore</div>
            <div className="login-card-title">Entra in SvaPro</div>
            <div className="login-card-sub">Inserisci le credenziali del tuo account</div>

            {/* Demo box */}
            <div className="login-demo-box">
              <div className="login-demo-info">
                <div className="login-demo-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',marginRight:5,verticalAlign:'middle'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Credenziali Demo
                </div>
                <div className="login-demo-creds">
                  <div>
                    <div className="login-demo-cred-label">Email</div>
                    <div className="login-demo-cred-value">admin@demo.local</div>
                  </div>
                  <div>
                    <div className="login-demo-cred-label">Password</div>
                    <div className="login-demo-cred-value">ChangeMe123!</div>
                  </div>
                </div>
              </div>
              <button className="login-submit-ghost" onClick={applyDemoAccess} type="button">
                Usa demo
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="banner banner-error" style={{marginBottom: 16}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="banner-text">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="login-input-wrap">
                <label className="login-label">Email</label>
                <div style={{position:'relative'}}>
                  <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <input
                    className="login-input"
                    type="email"
                    placeholder="nome@azienda.it"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="login-input-wrap">
                <label className="login-label">Password</label>
                <div style={{position:'relative'}}>
                  <svg className="login-input-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input
                    className="login-input"
                    type="password"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 1s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Accesso in corso...
                  </>
                ) : (
                  <>
                    Accedi
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </>
                )}
              </button>
            </form>

            <div className="login-footer-grid">
              <div>
                <div className="login-footer-key">Versione</div>
                <div className="login-footer-val">Laravel 11 + React</div>
              </div>
              <div>
                <div className="login-footer-key">Ambiente</div>
                <div className="login-footer-val">Demo Tenant</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

