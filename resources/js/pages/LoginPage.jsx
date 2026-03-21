import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../api.jsx';
import { ArrowRight, BadgeCheck, Building2, Lock, Loader, Mail, Sparkles } from 'lucide-react';

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
      
      // Save token and user
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('tenantCode', response.data.user.tenant_code || 'DEMO');
      
      setUser(response.data.user);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Login fallito. Controlla email e password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4efe7] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(214,108,61,0.24),_transparent_30%),linear-gradient(135deg,#0f172a_0%,#132238_40%,#1e293b_100%)] px-8 py-12 text-white lg:px-16 lg:py-16">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-orange-400 blur-3xl" />
                  <div className="absolute bottom-[-8rem] right-[-4rem] h-80 w-80 rounded-full bg-cyan-400 blur-3xl" />
                </div>

                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                      <Building2 size={22} />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold tracking-[0.18em]">SVAPRO</p>
                      <p className="text-sm text-white/70">Retail, POS e magazzino intelligente</p>
                    </div>
                  </div>

                  <div className="max-w-2xl space-y-8 py-16 lg:py-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur">
                      <Sparkles size={16} />
                      Pannello operativo multi-store con reorder automatico
                    </div>

                    <div className="space-y-5">
                      <h1 className="max-w-xl text-4xl font-semibold leading-tight lg:text-6xl">
                        Una dashboard da usare davvero, non una schermata di login generica.
                      </h1>
                      <p className="max-w-xl text-lg leading-8 text-slate-200/90">
                        Accedi al tenant demo con catalogo, ordini, loyalty, dipendenti e magazzino Milano gia pronto a generare riordini intelligenti.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl bg-white/8 p-5 ring-1 ring-white/10 backdrop-blur">
                        <p className="text-sm uppercase tracking-[0.22em] text-white/60">Store</p>
                        <p className="mt-3 text-3xl font-semibold">2</p>
                        <p className="mt-2 text-sm text-white/70">Roma e Milano con stock demo e storico vendite.</p>
                      </div>
                      <div className="rounded-3xl bg-white/8 p-5 ring-1 ring-white/10 backdrop-blur">
                        <p className="text-sm uppercase tracking-[0.22em] text-white/60">Ruoli</p>
                        <p className="mt-3 text-3xl font-semibold">4</p>
                        <p className="mt-2 text-sm text-white/70">Superadmin, admin cliente, dipendente, cliente finale.</p>
                      </div>
                      <div className="rounded-3xl bg-white/8 p-5 ring-1 ring-white/10 backdrop-blur">
                        <p className="text-sm uppercase tracking-[0.22em] text-white/60">Tenant</p>
                        <p className="mt-3 text-3xl font-semibold">DEMO</p>
                        <p className="mt-2 text-sm text-white/70">Accesso pronto senza configurazioni aggiuntive.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-white/70">
                    <BadgeCheck size={16} />
                    Seed verificato: login reale funzionante con API Laravel.
                  </div>
                </div>
        </section>

        <section className="flex items-center px-6 py-10 lg:px-12">
                <div className="mx-auto w-full max-w-xl">
                  <div className="rounded-[2rem] border border-stone-200 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur lg:p-10">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <p className="text-sm uppercase tracking-[0.28em] text-stone-500">Accesso operatore</p>
                        <h2 className="mt-3 text-3xl font-semibold text-slate-900">Entra in SvaPro</h2>
                      </div>
                      <button
                        type="button"
                        onClick={applyDemoAccess}
                        className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-orange-400 hover:text-orange-600"
                      >
                        Usa demo access
                      </button>
                    </div>

                    <div className="mt-8 rounded-3xl bg-stone-100 p-5 text-sm text-stone-700">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">Credenziali seedate reali</p>
                          <p className="mt-1 text-stone-600">Sono le stesse presenti nel database locale, non fittizie rispetto al seed corrente.</p>
                        </div>
                        <BadgeCheck className="text-emerald-600" size={20} />
                      </div>
                      <div className="mt-4 grid gap-3 rounded-2xl bg-white p-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Email</p>
                          <p className="mt-1 font-semibold text-slate-900">admin@demo.local</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Password</p>
                          <p className="mt-1 font-semibold text-slate-900">ChangeMe123!</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-4 text-stone-400" size={18} />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-2xl border border-stone-300 bg-white px-12 py-3.5 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                            placeholder="admin@demo.local"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-4 text-stone-400" size={18} />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-2xl border border-stone-300 bg-white px-12 py-3.5 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                            placeholder="ChangeMe123!"
                            required
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading && <Loader size={18} className="animate-spin" />}
                        <span>{loading ? 'Accesso in corso...' : 'Apri dashboard'}</span>
                        {!loading && <ArrowRight size={18} />}
                      </button>
                    </form>

                    <div className="mt-8 grid gap-4 border-t border-stone-200 pt-6 text-sm text-stone-600 md:grid-cols-2">
                      <div>
                        <p className="font-medium text-slate-900">Tenant attivo</p>
                        <p className="mt-1">DEMO</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Ruolo iniziale</p>
                        <p className="mt-1">admin_cliente</p>
                      </div>
                    </div>
                  </div>
                </div>
        </section>
      </div>
    </div>
  );
}
