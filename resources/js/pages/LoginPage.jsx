import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { auth } from '../api.jsx';

export default function LoginPage({ setUser }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');


    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError('');
            const response = await auth.login(email, password);
            
            if (response.data.token) {
                localStorage.setItem('authToken', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                if (response.data.user?.tenant_code) {
                    localStorage.setItem('tenantCode', response.data.user.tenant_code);
                }
                setUser(response.data.user);
                window.location.href = '/';
            } else {
                setError('Credenziali non valide');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Errore durante il login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sp-login-root">
            <div className="sp-login-card sp-animate-in">
                <div className="sp-login-logo">
                    <h1>Sva<span>Pro</span></h1>
                    <p>Accedi al tuo gestionale</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="sp-alert sp-alert-error sp-mb-4" style={{ borderRadius: 'var(--radius-sm)' }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="sp-form-group">
                        <label className="sp-label">Email</label>
                        <input
                            type="email"
                            className="sp-input sp-input-lg"
                            placeholder="nome@azienda.it"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="sp-form-group">
                        <label className="sp-label">Password</label>
                        <input
                            type="password"
                            className="sp-input sp-input-lg"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="sp-btn sp-btn-primary sp-btn-lg sp-btn-block"
                        disabled={loading}
                        style={{ marginTop: 8 }}
                    >
                        {loading ? (
                            <Loader2 size={20} className="sp-spin" />
                        ) : (
                            'Accedi'
                        )}
                    </button>
                </form>

                <p style={{ 
                    textAlign: 'center', marginTop: 24,
                    fontSize: 11, color: 'var(--color-text-tertiary)' 
                }}>
                    © 2026 SvaPro — Tutti i diritti riservati
                </p>
            </div>
        </div>
    );
}
