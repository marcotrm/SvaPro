import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { stores as storesApi, employees as employeesApi } from '../api.jsx';
import {
  Plus, Edit3, Trash2, Store, MapPin, Phone, Mail, Clock,
  CheckCircle, XCircle, AlertTriangle, Loader, X, Users, ChevronDown, ChevronUp,
  Eye, EyeOff, Building2, GitBranch,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Costanti ──────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Luned�' },
  { key: 'tue', label: 'Marted�' },
  { key: 'wed', label: 'Mercoled�' },
  { key: 'thu', label: 'Gioved�' },
  { key: 'fri', label: 'Venerd�' },
  { key: 'sat', label: 'Sabato' },
  { key: 'sun', label: 'Domenica' },
];

// Ogni giorno: { closed: bool, slots: [{ open, close }] }
// Supporta pausa pranzo con 2 slot: mattina + pomeriggio
const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map(({ key }, i) => [
    key,
    { closed: i >= 5, slots: [{ open: '09:00', close: '19:00' }] },
  ])
);

// Converte il vecchio formato { open, close, closed } al nuovo con slots[]
function normalizeHours(raw) {
  if (!raw) return DEFAULT_HOURS;
  const result = {};
  for (const key of DAYS.map(d => d.key)) {
    const day = raw[key];
    if (!day) { result[key] = { closed: false, slots: [{ open: '09:00', close: '19:00' }] }; continue; }
    if (Array.isArray(day.slots)) {
      result[key] = day;
    } else {
      // Vecchio formato
      result[key] = { closed: !!day.closed, slots: [{ open: day.open || '09:00', close: day.close || '19:00' }] };
    }
  }
  return result;
}

const emptyStore = () => ({
  name: '',
  code: '',
  address: '',
  city: '',
  zip_code: '',
  phone: '',
  email: '',
  timezone: 'Europe/Rome',
  is_main: false,
  opening_hours: DEFAULT_HOURS,
  default_start_time: '09:00',
  late_tolerance_minutes: 10,
  whatsapp_notify_phone: '',
  numero_esercizio: '',
  numero_ordinale: '',
  parent_store_id: '',
  company_group: '',
});

// ─── Griglia orari con supporto pausa pranzo ──────────────────────
function OpeningHoursEditor({ value, onChange }) {
  const hours = normalizeHours(value);

  const updateClosed = (day, closed) => {
    onChange({ ...hours, [day]: { ...hours[day], closed } });
  };

  const updateSlot = (day, idx, field, val) => {
    const slots = [...(hours[day].slots || [{ open: '09:00', close: '19:00' }])];
    slots[idx] = { ...slots[idx], [field]: val };
    onChange({ ...hours, [day]: { ...hours[day], slots } });
  };

  const addSlot = (day) => {
    const slots = [...(hours[day].slots || [])];
    const originalClose = slots[0]?.close || '20:00';
    // Smart default: chiudi mattina alle 13:30, apri pomeriggio alle 15:30
    // e mantieni l'orario di chiusura originale per il pomeriggio
    const morningClose = '13:30';
    const afternoonOpen = '15:30';
    slots[0] = { ...slots[0], close: morningClose };
    slots.push({ open: afternoonOpen, close: originalClose });
    onChange({ ...hours, [day]: { ...hours[day], slots } });
  };

  const removeSlot = (day, idx) => {
    const slots = (hours[day].slots || []).filter((_, i) => i !== idx);
    onChange({ ...hours, [day]: { ...hours[day], slots: slots.length ? slots : [{ open: '09:00', close: '19:00' }] } });
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {DAYS.map(({ key, label }) => {
        const day = hours[key] || { closed: false, slots: [{ open: '09:00', close: '19:00' }] };
        const slots = day.slots || [{ open: '09:00', close: '19:00' }];
        const hasBreak = slots.length > 1;

        return (
          <div key={key} style={{
            padding: '10px 14px',
            background: day.closed ? 'var(--color-bg)' : 'rgba(155,143,212,0.05)',
            borderRadius: 12, border: '1px solid var(--color-border)',
            opacity: day.closed ? 0.6 : 1,
            transition: 'all 0.15s',
          }}>
            {/* Riga principale: toggle giorno + orari */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center' }}>
              {/* Toggle giorno */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" checked={!day.closed}
                  onChange={e => updateClosed(key, !e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--color-accent)', cursor: 'pointer' }} />
                {label}
              </label>

              {/* Slot(s) orari */}
              {!day.closed ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {slots.map((slot, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Badge slot */}
                      {slots.length > 1 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: idx === 0 ? '#6366f1' : '#f59e0b',
                          background: idx === 0 ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
                          border: `1px solid ${idx === 0 ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.2)'}`,
                          borderRadius: 5, padding: '1px 6px', minWidth: 40, textAlign: 'center' }}>
                          {idx === 0 ? 'Mattina' : 'Pomerig.'}
                        </span>
                      )}
                      <input type="time" value={slot.open}
                        onChange={e => updateSlot(key, idx, 'open', e.target.value)}
                        className="sp-input" style={{ width: 100, fontSize: 13 }} />
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>?</span>
                      <input type="time" value={slot.close}
                        onChange={e => updateSlot(key, idx, 'close', e.target.value)}
                        className="sp-input" style={{ width: 100, fontSize: 13 }} />
                      {/* Rimuovi slot secondario */}
                      {idx > 0 && (
                        <button onClick={() => removeSlot(key, idx)}
                          title="Rimuovi slot"
                          style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 }}>
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Chiuso</span>
              )}

              {/* Bottone aggiungi pausa pranzo */}
              {!day.closed && (
                <button
                  onClick={() => hasBreak ? removeSlot(key, 1) : addSlot(key)}
                  title={hasBreak ? 'Rimuovi pausa pranzo' : 'Aggiungi pausa pranzo'}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: 'none',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    background: hasBreak ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
                    color: hasBreak ? '#ef4444' : '#6366f1',
                    transition: 'all 0.15s',
                  }}
                >
                  {hasBreak ? '✕ Pausa' : '+ Pausa'}
                </button>
              )}
            </div>

            {/* Indicatore pausa visivo */}
            {!day.closed && hasBreak && (() => {
              const s0close = slots[0].close;
              const s1open  = slots[1].open;
              const isValid = s0close <= s1open;
              if (!isValid) {
                return (
                  <div style={{ marginTop: 6, paddingLeft: 130, fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                    ??️ Orari sovrapposti — la pausa inizia prima della chiusura mattina
                  </div>
                );
              }
              // Calcola durata pausa in minuti
              const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
              const dur = toMin(s1open) - toMin(s0close);
              const durLabel = dur > 0 ? ` (${dur} min)` : '';
              return (
                <div style={{ marginTop: 6, paddingLeft: 130, fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                  ☕ Pausa: {s0close} – {s1open}{durLabel}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modale crea/modifica negozio ──────────────────────────────────
function StoreModal({ store, onClose, onSaved }) {
  const isEdit = !!store?.id;
  const [form, setForm] = useState(() => store ? {
    name: store.name || '',
    code: store.code || '',
    address: store.address || '',
    city: store.city || '',
    zip_code: store.zip_code || '',
    phone: store.phone || '',
    email: store.email || '',
    timezone: store.timezone || 'Europe/Rome',
    is_main: !!store.is_main,
    opening_hours: store.opening_hours || DEFAULT_HOURS,
    default_start_time: store.default_start_time || '09:00',
    late_tolerance_minutes: store.late_tolerance_minutes ?? 10,
    whatsapp_notify_phone: store.whatsapp_notify_phone || '',
    numero_esercizio: store.numero_esercizio || '',
    numero_ordinale: store.numero_ordinale || '',
    parent_store_id: store.parent_store_id || '',
    company_group: store.company_group || '',
  } : emptyStore());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState('info');
  // Lista negozi disponibili come padre (esclude se stesso)
  const [storesList, setStoresList] = useState([]);
  useEffect(() => {
    storesApi.getStores()
      .then(r => {
        const all = r.data?.data || [];
        setStoresList(store?.id ? all.filter(s => s.id !== store.id) : all);
      })
      .catch(() => {});
  }, [store?.id]);

  const fe = (f) => errors[f]?.[0];
  const errStyle = (f) => fe(f) ? { borderColor: 'var(--color-error)', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {};

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    if (errors[field]) setErrors(p => { const n = { ...p }; delete n[field]; return n; });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true); setErrors({});
      if (isEdit) {
        await storesApi.updateStore(store.id, form);
      } else {
        await storesApi.createStore(form);
      }
      toast.success(isEdit ? 'Negozio aggiornato!' : 'Negozio creato!');
      onSaved();
    } catch (err) {
      const e = err.response?.data?.errors;
      if (e) { setErrors(e); setTab('info'); }
      else toast.error(err.response?.data?.message || 'Errore salvataggio');
    } finally { setLoading(false); }
  };

  const TABS = [
    { id: 'info',       label: '📋 Informazioni' },
    { id: 'hours',      label: '🕐 Orari apertura' },
    { id: 'attendance', label: '⏱ Timbrature' },
    { id: 'access',     label: '🔑 Ruoli e Accessi' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }} className="sp-animate-in">

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Store size={18} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{isEdit ? 'Modifica Negozio' : 'Nuovo Negozio'}</h2>
                {isEdit && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>{store.name}</p>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}><X size={20} /></button>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: tab === t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* TAB INFO */}
          {tab === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label">Nome Negozio *</label>
                <input className="sp-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Es: Negozio Centro Storico" style={errStyle('name')} />
                {fe('name') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{fe('name')}</p>}
              </div>
              <div>
                <label className="sp-label">Codice Negozio *</label>
                <input className="sp-input" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="Es: CENTRO01" style={errStyle('code')} />
                {fe('code') && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{fe('code')}</p>}
              </div>
              <div>
                <label className="sp-label">Fuso Orario</label>
                <select className="sp-select" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                  <option value="Europe/Rome">Europe/Rome (Italia)</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label">Indirizzo</label>
                <input className="sp-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Via Roma 1" />
              </div>
              <div>
                <label className="sp-label">Città</label>
                <input className="sp-input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Milano" />
              </div>
              <div>
                <label className="sp-label">CAP</label>
                <input className="sp-input" value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="20100" />
              </div>
              <div>
                <label className="sp-label">Telefono</label>
                <input className="sp-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+39 02 1234567" />
              </div>
              <div>
                <label className="sp-label">Email</label>
                <input className="sp-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="negozio@esempio.it" style={errStyle('email')} />
              </div>
              <div>
                <label className="sp-label">Numero Esercizio</label>
                <input className="sp-input" value={form.numero_esercizio} onChange={e => set('numero_esercizio', e.target.value)}
                  placeholder="Es: 001" />
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>Numero esercizio fiscale ADM</p>
              </div>
              <div>
                <label className="sp-label">Numero Ordinale</label>
                <input className="sp-input" value={form.numero_ordinale} onChange={e => set('numero_ordinale', e.target.value)}
                  placeholder="Es: 001" />
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>Numero ordinale fiscale ADM</p>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="sp-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitBranch size={13} /> Negozio Madre (Categoria)
                </label>
                <select
                  className="sp-select"
                  value={form.parent_store_id}
                  onChange={e => set('parent_store_id', e.target.value)}
                >
                  <option value="">— Nessun negozio madre (categoria radice) —</option>
                  {storesList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                  Seleziona un negozio padre per creare una gerarchia categoria/sottocategoria.
                </p>
              </div>
              <div>
                <label className="sp-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={13} /> Società / Holding
                </label>
                <input className="sp-input" value={form.company_group} onChange={e => set('company_group', e.target.value)}
                  placeholder="Es: quisvapogroup" />
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                  Gruppo societario per i raggruppamenti in tesoreria.
                </p>
              </div>
              <div>
                <label className="sp-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={form.is_main} onChange={e => set('is_main', e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--color-accent)' }} />
                  Negozio principale
                </label>
              </div>
            </div>
          )}

          {/* TAB ORARI */}
          {tab === 'hours' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                Configura gli orari di apertura del negozio. Verranno usati per mostrare <strong>Aperto/Chiuso</strong> in tempo reale e per il calcolo delle timbrature.
              </p>
              <OpeningHoursEditor
                value={form.opening_hours}
                onChange={(oh) => set('opening_hours', oh)}
              />
            </div>
          )}

          {/* TAB TIMBRATURE */}
          {tab === 'attendance' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--color-border)' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>⏰ Orario previsto apertura (default timbrature)</h4>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Usato per calcolare i ritardi dei dipendenti che non hanno un orario personale impostato.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <label className="sp-label">Orario inizio turno</label>
                    <input type="time" className="sp-input" value={form.default_start_time}
                      onChange={e => set('default_start_time', e.target.value)}
                      style={{ width: 130 }} />
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--color-border)' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>🔔 Soglia notifica ritardo</h4>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Ricevi una notifica WhatsApp se un dipendente arriva con pi??di N minuti di ritardo.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" min="0" max="120" className="sp-input"
                    value={form.late_tolerance_minutes}
                    onChange={e => set('late_tolerance_minutes', parseInt(e.target.value) || 0)}
                    style={{ width: 100 }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>minuti di tolleranza</span>
                </div>
              </div>

              <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--color-border)' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>📲 Numero WhatsApp per Notifiche Ritardo</h4>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  Inserisci il numero internazionale che riceverà le notifiche WhatsApp.
                  Es. <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>+393401234567</code>
                </p>
                <input
                  type="tel"
                  className="sp-input"
                  value={form.whatsapp_notify_phone}
                  onChange={e => set('whatsapp_notify_phone', e.target.value)}
                  placeholder="+39 340 1234567"
                  style={{ maxWidth: 260 }}
                />
                {/* Bottone test notifica */}
                {form.whatsapp_notify_phone && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        // Passa il numero dal form nel body (funziona anche prima di salvare)
                        const res = await employeesApi.testWhatsapp(store.id, { phone: form.whatsapp_notify_phone });
                        toast.success(res.data.message || '? Test inviato!');
                      } catch (err) {
                        const msg = err?.response?.data?.message || 'Errore invio test';
                        toast.error(msg);
                      }
                    }}
                    style={{
                      marginTop: 8, padding: '8px 18px', borderRadius: 8,
                      background: 'rgba(37,211,102,0.15)', color: '#25d366',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      border: '1px solid rgba(37,211,102,0.3)',
                    }}
                  >
                    📲 Invia messaggio di test
                  </button>
                )}
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(155,143,212,0.08)', borderRadius: 10, border: '1px solid rgba(155,143,212,0.2)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <strong>ℹ️ Come funziona:</strong><br />
                1. Il dipendente tocca la sua card sulla pagina <strong>Timbrature</strong><br />
                2. Il sistema confronta l'orario di arrivo con <em>orario inizio turno</em><br />
                3. Se il ritardo supera la <em>soglia</em>, arriva una notifica WhatsApp immediata all'admin
              </div>

            </div>
          )}
          {/* TAB ACCESSI */}
          {tab === 'access' && (
            <StoreAccessTab store={store} />
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="sp-btn sp-btn-ghost" onClick={onClose} disabled={loading}>Chiudi</button>
          {tab !== 'access' && (
            <button className="sp-btn sp-btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : isEdit ? 'Salva modifiche' : 'Crea negozio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente form per accessi nel Tab ──────────────────────────
function StoreAccessTab({ store }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [existingEmail, setExistingEmail] = useState(null);
  const [copied, setCopied] = useState('');
  // Password recuperata dal backend (sempre aggiornata, funziona su qualsiasi dispositivo)
  const [backendPassword, setBackendPassword] = useState(null);

  // Legge il ruolo utente da localStorage (senza bisogno di prop)
  const userFromStorage = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const isSuperAdmin = userFromStorage?.roles?.includes('superadmin');

  // Chiave cache: salva ENTRAMBI email e password
  const CREDS_KEY = store?.id ? `store_creds_${store.id}` : null;

  const saveToCache = (email, password) => {
    if (!CREDS_KEY) return;
    localStorage.setItem(CREDS_KEY, JSON.stringify({ email, password }));
    // Mantieni anche la chiave legacy
    localStorage.setItem(`store_cred_email_${store.id}`, email);
  };

  const loadFromCache = () => {
    if (!CREDS_KEY) return null;
    try { return JSON.parse(localStorage.getItem(CREDS_KEY)); } catch { return null; }
  };

  // Carica credenziali: prima da localStorage (istantaneo), poi verifica dal backend
  useEffect(() => {
    if (!store?.id) return;

    // 1. Carica subito dalla cache locale
    const cached = loadFromCache();
    if (cached?.email) {
      setExistingEmail(cached.email);
      setForm({ email: cached.email, password: cached.password || '' });
    }

    // 2. Verifica/aggiorna email dal backend (e recupera password salvata nei settings)
    setLoadingCreds(true);
    storesApi.getCredentials(store.id)
      .then(res => {
        if (res.data?.has_credentials && res.data?.email) {
          setExistingEmail(res.data.email);
          setForm(p => ({ ...p, email: res.data.email }));
          // Usa la password dal backend se disponibile (priorità massima)
          if (res.data.store_password) {
            setBackendPassword(res.data.store_password);
            saveToCache(res.data.email, res.data.store_password);
            setForm(p => ({ ...p, email: res.data.email }));
          } else {
            // Fallback: usa password dalla cache locale
            const pw = loadFromCache()?.password || '';
            saveToCache(res.data.email, pw);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCreds(false));
  }, [store?.id]);

  if (!store?.id) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <p>Devi prima salvare il negozio per potergli assegnare degli accessi.</p>
      </div>
    );
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async () => {
    try {
      setLoading(true); setErrors({});
      await storesApi.createCredentials(store.id, form);
      setExistingEmail(form.email);
      if (form.password) setBackendPassword(form.password); // mostra subito la nuova password
      saveToCache(form.email, form.password || backendPassword || ''); // salva ENTRAMBI
      toast.success('Credenziali salvate con successo!');
    } catch (err) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors);
      else toast.error(err.response?.data?.message || 'Errore generazione credenziali');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const storedCreds = loadFromCache();

  return (
    <div style={{ background: 'var(--color-bg)', borderRadius: 12, padding: 20, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Accesso Negozio: {store.name}</h4>
        {loadingCreds ? (
          <Loader size={14} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
        ) : existingEmail ? (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.2)' }}>
            ✓ Credenziali configurate
          </span>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#b45309', border: '1px solid rgba(245,158,11,0.2)' }}>
            ?? Nessun accesso
          </span>
        )}
      </div>

      {/* 👑 Pannello SuperAdmin — password in chiaro (recuperata dal backend) */}
      {isSuperAdmin && existingEmail && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
          border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366f1', marginBottom: 10 }}>
            👑 Accesso Admin — credenziali in chiaro
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* Email */}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>EMAIL</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all' }}>{existingEmail}</span>
                <button onClick={() => copyToClipboard(existingEmail, 'email')}
                  style={{ flexShrink: 0, padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: copied === 'email' ? '#22c55e' : 'rgba(99,102,241,0.2)', color: copied === 'email' ? '#fff' : '#a5b4fc', transition: 'all 0.2s' }}>
                  {copied === 'email' ? '✓' : 'Copia'}
                </button>
              </div>
            </div>
            {/* Password */}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>PASSWORD</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                {(backendPassword || loadFromCache()?.password) ? (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.05em', fontFamily: 'monospace' }}>
                      {backendPassword || loadFromCache()?.password}
                    </span>
                    <button onClick={() => copyToClipboard(backendPassword || loadFromCache()?.password, 'password')}
                      style={{ flexShrink: 0, padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: copied === 'password' ? '#22c55e' : 'rgba(99,102,241,0.2)', color: copied === 'password' ? '#fff' : '#a5b4fc', transition: 'all 0.2s' }}>
                      {copied === 'password' ? '✓' : 'Copia'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                    {loadingCreds ? 'Caricamento...' : '?? Password non trovata. Aggiorna le credenziali per salvarla.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        {existingEmail
          ? 'Modifica email o password dell\'utente collegato a questo negozio.'
          : 'Crea un accesso dipendente per questo negozio.'}
      </p>

      {/* Form modifica */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label className="sp-label">Email di Login</label>
          <input type="email" className="sp-input" value={form.email} onChange={e => set('email', e.target.value.toLowerCase())} placeholder="es: mario@negozio.it" />
          {errors.email && <div style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{errors.email[0]}</div>}
        </div>
        <div>
          <label className="sp-label">
            Nuova Password
            {existingEmail && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginLeft: 6 }}>(lascia vuota per non cambiare)</span>}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="sp-input"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={existingEmail ? 'Lascia vuota per non cambiare...' : 'Inserisci la password...'}
              style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}
              title={showPassword ? 'Nascondi' : 'Mostra'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <div style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 3 }}>{errors.password[0]}</div>}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <button className="sp-btn sp-btn-primary" onClick={handleSubmit}
          disabled={loading || !form.email || (!existingEmail && !form.password)}>
          {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : (existingEmail ? 'Aggiorna Credenziali' : 'Salva Credenziali')}
        </button>
      </div>
    </div>
  );
}


// ─── Card negozio ──────────────────────────────────────────────────
function StoreCard({ store, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const today = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
  const todayHours = store.opening_hours?.[today];

  // Calcolo aperto/chiuso in tempo reale dagli slot orari (formato nuovo: slots[])
  const isStoreOpenNow = (() => {
    if (todayHours?.closed) return false;
    const slots = todayHours?.slots || (todayHours?.open ? [{ open: todayHours.open, close: todayHours.close }] : null);
    if (!slots?.length) return store.is_open_now ?? false; // fallback API
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const toMins = (t) => { const [h,m] = (t||'').split(':').map(Number); return h*60 + (m||0); };
    return slots.some(s => nowMins >= toMins(s.open) && nowMins < toMins(s.close));
  })();

  const hoursDisplay = todayHours?.closed
    ? 'Chiuso oggi'
    : todayHours?.slots?.length
    ? todayHours.slots.map(s => `${s.open}–${s.close}`).join(', ')
    : todayHours?.open
    ? `${todayHours.open}–${todayHours.close}`
    : '—';

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 16, padding: 0,
    border: isStoreOpenNow ? '2px solid #6EE7B7' : '1px solid var(--color-border)',
      overflow: 'hidden', transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Card header */}
      <div style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, flexShrink: 0,
          background: store.is_main ? 'var(--color-accent)' : 'var(--color-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--color-border)',
        }}>
          <Store size={20} color={store.is_main ? '#fff' : 'var(--color-text-secondary)'} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{store.name}</h3>
            {store.is_main && (
              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--color-accent)', color: '#fff', padding: '2px 8px', borderRadius: 100 }}>PRINCIPALE</span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
              background: isStoreOpenNow ? '#D1FAE5' : '#F3F4F6',
              color: isStoreOpenNow ? '#065F46' : '#6B7280',
            }}>
              {isStoreOpenNow ? '🟢 APERTO' : '🔴 CHIUSO'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Codice: <strong>{store.code}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => onEdit(store)} title="Modifica">
            <Edit3 size={14} />
          </button>
          {!store.is_main && (
            <button className="sp-btn sp-btn-ghost sp-btn-sm" style={{ color: 'var(--color-error)' }}
              onClick={() => onDelete(store)} title="Elimina">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Info rapide */}
      <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {store.address && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <MapPin size={12} /> {store.city || store.address}
          </span>
        )}
        {store.phone && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <Phone size={12} /> {store.phone}
          </span>
        )}
        {store.default_start_time && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <Clock size={12} /> Apertura dipendenti: {store.default_start_time}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          🕐 Oggi: {hoursDisplay}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--color-accent)' }} title="Media settimanale: fatturato accumulato entro le 18:00 per ogni giorno di questa settimana (lun?oggi), diviso per i giorni.">
          📊 Media h18 (sett.): € {(store.revenue_18 || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
        </span>

      </div>

      {/* Orari accordion */}
      {store.opening_hours && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ width: '100%', padding: '10px 20px', background: 'var(--color-bg)', border: 'none', borderTop: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}
          >
            <span>Orari settimanali</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <div style={{ padding: '12px 20px 16px', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
              {DAYS.map(({ key, label }) => {
                const d = store.opening_hours[key] || {};
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</span>
                    <span style={{ color: d.closed ? 'var(--color-text-tertiary)' : 'var(--color-text)', fontStyle: d.closed ? 'italic' : 'normal' }}>
                      {d.closed ? 'Chiuso' : `${d.open}–${d.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Pagina principale ─────────────────────────────────────────────
export default function StoresPage() {
  const { user } = useOutletContext?.() || {};
  const [storesList, setStoresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await storesApi.getStores();
      setStoresList(res.data?.data || []);
    } catch {
      toast.error('Errore caricamento negozi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      await storesApi.deleteStore(confirmDelete.id);
      toast.success(`"${confirmDelete.name}" eliminato.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Errore eliminazione');
    } finally { setDeleting(false); }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Gestione Negozi</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Configura i tuoi negozi, orari di apertura e impostazioni timbrature
          </p>
        </div>
        <button className="sp-btn sp-btn-primary" onClick={() => { setEditStore(null); setShowModal(true); }}>
          <Plus size={16} /> Nuovo Negozio
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Totale negozi', value: storesList.length, icon: Store, color: 'var(--color-accent)' },
          { label: 'Aperti ora', value: storesList.filter(s => {
            const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
            const th = s.opening_hours?.[today];
            if (th?.closed) return false;
            const slots = th?.slots || (th?.open ? [{ open: th.open, close: th.close }] : null);
            if (!slots?.length) return s.is_open_now ?? false;
            const nowMins = new Date().getHours()*60 + new Date().getMinutes();
            const toMins = (t) => { const [h,m]=(t||'').split(':').map(Number); return h*60+(m||0); };
            return slots.some(sl => nowMins >= toMins(sl.open) && nowMins < toMins(sl.close));
          }).length, icon: CheckCircle, color: '#10B981' },
          { label: 'Chiusi ora', value: storesList.filter(s => {
            const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
            const th = s.opening_hours?.[today];
            if (th?.closed) return true;
            const slots = th?.slots || (th?.open ? [{ open: th.open, close: th.close }] : null);
            if (!slots?.length) return !(s.is_open_now ?? false);
            const nowMins = new Date().getHours()*60 + new Date().getMinutes();
            const toMins = (t) => { const [h,m]=(t||'').split(':').map(Number); return h*60+(m||0); };
            return !slots.some(sl => nowMins >= toMins(sl.open) && nowMins < toMins(sl.close));
          }).length, icon: XCircle, color: '#6B7280' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lista negozi */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', opacity: 0.4 }} />
        </div>
      ) : storesList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--color-surface)', borderRadius: 16, border: '2px dashed var(--color-border)' }}>
          <Store size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nessun negozio configurato</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 20 }}>Crea il tuo primo negozio per iniziare</p>
          <button className="sp-btn sp-btn-primary" onClick={() => { setEditStore(null); setShowModal(true); }}>
            <Plus size={14} /> Crea primo negozio
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {storesList.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              onEdit={(s) => { setEditStore(s); setShowModal(true); }}
              onDelete={(s) => setConfirmDelete(s)}
            />
          ))}
        </div>
      )}

      {/* Modal crea/modifica */}
      {showModal && (
        <StoreModal
          store={editStore}
          onClose={() => { setShowModal(false); setEditStore(null); }}
          onSaved={() => { setShowModal(false); setEditStore(null); load(); }}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%', textAlign: 'center' }} className="sp-animate-in">
            <AlertTriangle size={40} style={{ color: 'var(--color-error)', margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Elimina negozio?</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>
              Stai per eliminare <strong>"{confirmDelete.name}"</strong>. Questa azione non pu??essere annullata.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="sp-btn sp-btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Annulla</button>
              <button className="sp-btn sp-btn-primary" style={{ background: 'var(--color-error)' }} onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
