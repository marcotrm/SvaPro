import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import { useTranslation } from '../i18n/index.jsx';
import { 
  User, Settings, Globe, Shield, Save, 
  Lock, Mail, Building2, Landmark, Clock, 
  Layout, Eye, Smartphone, AlertCircle, CheckCircle2
} from 'lucide-react';

export default function SettingsPage() {
  const { user, setUser, displayMode, setDisplayMode } = useOutletContext();
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
  const [tenantLicense, setTenantLicense] = useState('');
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
          setTenantLicense(t.license_code || '');
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
        license_code: tenantLicense,
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
    <div className="animate-v3 space-y-12 px-2 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Impostazioni Sistema</h1>
          <p className="text-slate-400 font-bold flex items-center gap-2">
            <Settings size={16} className="text-indigo-500" />
            Configurazione globale e preferenze profilo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        {/* Left Column: Forms */}
        <div className="xl:col-span-8 space-y-10">
          
          {/* Profile Card */}
          <section className="card-v3 overflow-hidden shadow-xl shadow-indigo-900/5">
             <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
                <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-indigo-500">
                   <User size={20} />
                </div>
                <div>
                   <h3 className="font-black text-slate-900 tracking-tight text-lg">Profilo Personale</h3>
                   <p className="text-xs font-bold text-slate-400">Identità utente e credenziali di accesso</p>
                </div>
             </div>
             
             <div className="p-8">
               <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <div className="relative group">
                           <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                           <input 
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                             value={name} onChange={e => setName(e.target.value)} required 
                           />
                        </div>
                     </div>

                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Aziendale</label>
                        <div className="relative group">
                           <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                           <input 
                             type="email"
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                             value={email} onChange={e => setEmail(e.target.value)} required 
                           />
                        </div>
                     </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-6">
                       <Lock size={14} className="text-amber-500" />
                       <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Sicurezza Account</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  
                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Corrente</label>
                          <input 
                            type="password"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                            value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                          />
                       </div>
  
                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nuova Password</label>
                          <input 
                            type="password"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                            value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          />
                       </div>
  
                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conferma Nuova</label>
                          <input 
                            type="password"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                            value={newPasswordConfirmation} onChange={e => setNewPasswordConfirmation(e.target.value)}
                          />
                       </div>
                    </div>
                  </div>

                  {profileMsg && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl font-bold flex items-center gap-2"><CheckCircle2 size={16} /> {profileMsg}</div>}
                  {profileErr && <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold flex items-center gap-2"><AlertCircle size={16} /> {profileErr}</div>}

                  <button className="btn-v3-primary px-8 py-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center gap-2" type="submit" disabled={savingProfile}>
                    <Save size={18} /> {savingProfile ? 'Sincronizzazione...' : 'Salva Profilo'}
                  </button>
               </form>
             </div>
          </section>

          {/* Tenant Settings Card */}
          {isAdmin && (
            <section className="card-v3 overflow-hidden shadow-xl shadow-indigo-900/5">
               <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center text-indigo-500">
                     <Building2 size={20} />
                  </div>
                  <div>
                     <h3 className="font-black text-slate-900 tracking-tight text-lg">Configurazione Aziendale</h3>
                     <p className="text-xs font-bold text-slate-400">Dati fiscali e impostazioni regionali</p>
                  </div>
               </div>

               <div className="p-8">
                 <form onSubmit={handleSaveTenant} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  
                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ragione Sociale</label>
                          <div className="relative group">
                             <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                             <input 
                               className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                               value={tenantName} onChange={e => setTenantName(e.target.value)} required 
                             />
                          </div>
                       </div>
  
                     {/* Codice Licenza */}
                     <div className="space-y-2" style={{ gridColumn: '1/-1' }}>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">?? Codice Licenza</label>
                        <div className="relative group">
                           <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                           <input
                             className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none font-mono tracking-widest"
                             value={tenantLicense}
                             onChange={e => setTenantLicense(e.target.value.toUpperCase())}
                             placeholder="Es: SVAPRO-XXXX-XXXX-XXXX"
                             maxLength={32}
                           />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 ml-1">Inserisci il codice di licenza fornito da SvaPro per attivare funzioni premium.</p>
                     </div>
                     <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Partita IVA / Tax ID</label>
                          <div className="relative group">
                             <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                             <input 
                               className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                               value={tenantVat} onChange={e => setTenantVat(e.target.value)}
                             />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fuso Orario Locale</label>
                       <div className="relative group max-w-sm">
                          <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <select 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-10 py-3.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none appearance-none cursor-pointer"
                            value={tenantTimezone} onChange={e => setTenantTimezone(e.target.value)}
                          >
                             <option value="Europe/Rome">Europe/Rome (Italia)</option>
                             <option value="Europe/London">Europe/London (UK)</option>
                             <option value="UTC">UTC (Universal)</option>
                          </select>
                       </div>
                    </div>

                    {tenantMsg && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl font-bold flex items-center gap-2"><CheckCircle2 size={16} /> {tenantMsg}</div>}
                    {tenantErr && <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold flex items-center gap-2"><AlertCircle size={16} /> {tenantErr}</div>}

                    <button className="btn-v3-primary px-8 py-4 rounded-2xl shadow-lg shadow-indigo-100 flex items-center gap-2" type="submit" disabled={savingTenant}>
                       <Save size={18} /> {savingTenant ? 'Salvataggio...' : 'Salva Impostazioni Azienda'}
                    </button>
                 </form>
               </div>
            </section>
          )}
        </div>

        {/* Right Column: Preferences & UI */}
        <div className="xl:col-span-4 space-y-10">
          
          {/* Display Mode Card (REQUESTED) */}
          <section className="card-v3 p-8 space-y-6 bg-gradient-to-br from-white to-slate-50 border-slate-100">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                   <Layout size={20} />
                </div>
                <div>
                   <h3 className="font-black text-slate-900 tracking-tight">Visualizzazione</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface Preferences</p>
                </div>
             </div>

             <div className="space-y-4">
                <button 
                  onClick={() => setDisplayMode('name')}
                  className={`w-full p-6 rounded-2xl border-2 flex items-center gap-6 transition-all group ${displayMode === 'name' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100'}`}
                >
                   <Eye size={24} className={displayMode === 'name' ? 'text-white' : 'text-slate-300 group-hover:text-indigo-400'} />
                   <div className="text-left">
                      <div className="font-black tracking-tight uppercase text-xs">Visualizza Nomi</div>
                      <div className={`text-[10px] font-bold ${displayMode === 'name' ? 'text-indigo-100' : 'text-slate-400'}`}>Mostra i nomi completi dei prodotti nelle liste</div>
                   </div>
                   {displayMode === 'name' && <CheckCircle2 size={18} className="ml-auto" />}
                </button>

                <button 
                  onClick={() => setDisplayMode('sku')}
                  className={`w-full p-6 rounded-2xl border-2 flex items-center gap-6 transition-all group ${displayMode === 'sku' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100'}`}
                >
                   <Smartphone size={24} className={displayMode === 'sku' ? 'text-white' : 'text-slate-300 group-hover:text-indigo-400'} />
                   <div className="text-left">
                      <div className="font-black tracking-tight uppercase text-xs">Visualizza SKU</div>
                      <div className={`text-[10px] font-bold ${displayMode === 'sku' ? 'text-indigo-100' : 'text-slate-400'}`}>Mostra i codici identificativi per un uso tattico veloce</div>
                   </div>
                   {displayMode === 'sku' && <CheckCircle2 size={18} className="ml-auto" />}
                </button>
             </div>
          </section>

          {/* Localization Card */}
          <section className="card-v3 p-8 space-y-6 border-slate-100">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                   <Globe size={20} />
                </div>
                <div>
                   <h3 className="font-black text-slate-900 tracking-tight">Localizzazione</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Language & Region</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <button 
                   className={`p-4 rounded-xl border-2 font-black text-xs transition-all ${lang === 'it' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-50 text-slate-400 hover:border-slate-100'}`}
                   onClick={() => setLang('it')}
                >
                  ITALIANO
                </button>
                <button 
                   className={`p-4 rounded-xl border-2 font-black text-xs transition-all ${lang === 'en' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-50 text-slate-400 hover:border-slate-100'}`}
                   onClick={() => setLang('en')}
                >
                  ENGLISH
                </button>
             </div>
          </section>

          {/* Support / Info */}
          <section className="p-8 bg-indigo-900 rounded-[32px] text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden">
             <div className="relative z-10">
                <Shield size={32} className="text-indigo-400 mb-4" />
                <h4 className="text-xl font-black tracking-tight mb-2">Sistema Sicuro</h4>
                <p className="text-indigo-200 text-xs font-bold leading-relaxed mb-6">
                   Tutte le modifiche alle impostazioni tenant vengono registrate negli audit log. Ogni azione è crittografata e monitorata.
                </p>
                <button className="w-full py-4 bg-white/10 hover:bg-white/20 transition-all rounded-2xl text-xs font-black uppercase tracking-widest backdrop-blur-md border border-white/10">
                   Contatta Assistenza
                </button>
             </div>
             {/* Decorative Background Orbs */}
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
             <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400/10 rounded-full blur-3xl" />
          </section>
        </div>
      </div>
    </div>
  );
}
