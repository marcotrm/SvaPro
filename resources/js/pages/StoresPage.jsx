import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { stores as storesApi } from '../api.jsx';
import {
  Plus, Edit3, Trash2, Store, MapPin, Phone, Mail, Clock,
  CheckCircle, XCircle, AlertTriangle, Loader, X, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Costanti ──────────────────────────────────────────────────────
const DAYS = [
  { key: 'mon', label: 'Lunedì' },
  { key: 'tue', label: 'Martedì' },
  { key: 'wed', label: 'Mercoledì' },
  { key: 'thu', label: 'Giovedì' },
  { key: 'fri', label: 'Venerdì' },
  { key: 'sat', label: 'Sabato' },
  { key: 'sun', label: 'Domenica' },
];

const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map(({ key }, i) => [key, { open: '09:00', close: '19:00', closed: i >= 5 }])
);

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
});

// ─── Griglia orari ─────────────────────────────────────────────────
function OpeningHoursEditor({ value, onChange }) {
  const hours = value || DEFAULT_HOURS;

  const update = (day, field, val) => {
    onChange({ ...hours, [day]: { ...hours[day], [field]: val } });
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {DAYS.map(({ key, label }) => {
        const day = hours[key] || { open: '09:00', close: '19:00', closed: false };
        return (
          <div key={key} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr',
            gap: 12, alignItems: 'center',
            padding: '10px 14px',
            background: day.closed ? 'var(--color-bg)' : 'rgba(155,143,212,0.05)',
            borderRadius: 10, border: '1px solid var(--color-border)',
            opacity: day.closed ? 0.6 : 1,
          }}>
            {/* Giorno + toggle chiuso */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={!day.closed}
                onChange={e => update(key, 'closed', !e.target.checked)}
                style={{ width: 15, height: 15, accentColor: 'var(--color-accent)', cursor: 'pointer' }} />
              {label}
            </label>

            {/* Orari aperto/chiuso */}
            {!day.closed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="time" value={day.open || '09:00'}
                  onChange={e => update(key, 'open', e.target.value)}
                  className="sp-input" style={{ width: 110, fontSize: 13 }} />
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>→</span>
                <input type="time" value={day.close || '19:00'}
                  onChange={e => update(key, 'close', e.target.value)}
                  className="sp-input" style={{ width: 110, fontSize: 13 }} />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Chiuso</span>
            )}
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
  } : emptyStore());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [tab, setTab] = useState('info'); // 'info' | 'hours' | 'attendance'

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
                  Ricevi una notifica WhatsApp se un dipendente arriva con più di N minuti di ritardo.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="number" min="0" max="120" className="sp-input"
                    value={form.late_tolerance_minutes}
                    onChange={e => set('late_tolerance_minutes', parseInt(e.target.value) || 0)}
                    style={{ width: 100 }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>minuti di tolleranza</span>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(155,143,212,0.08)', borderRadius: 10, border: '1px solid rgba(155,143,212,0.2)', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <strong>ℹ️ Come funziona:</strong><br />
                1. Il dipendente tocca la sua card sulla pagina <strong>Timbrature</strong><br />
                2. Il sistema confronta l'orario di arrivo con <em>orario inizio turno</em><br />
                3. Se il ritardo supera la <em>soglia</em>, arriva una notifica WhatsApp immediata all'admin
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="sp-btn sp-btn-ghost" onClick={onClose} disabled={loading}>Annulla</button>
          <button className="sp-btn sp-btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : isEdit ? 'Salva modifiche' : 'Crea negozio'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card negozio ──────────────────────────────────────────────────
function StoreCard({ store, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const today = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
  const todayHours = store.opening_hours?.[today];
  const hoursDisplay = todayHours?.closed
    ? 'Chiuso oggi'
    : todayHours
    ? `${todayHours.open} – ${todayHours.close}`
    : '—';

  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 16, padding: 0,
      border: store.is_open_now ? '2px solid #6EE7B7' : '1px solid var(--color-border)',
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
              background: store.is_open_now ? '#D1FAE5' : '#F3F4F6',
              color: store.is_open_now ? '#065F46' : '#6B7280',
            }}>
              {store.is_open_now ? '🟢 APERTO' : '🔴 CHIUSO'}
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
          { label: 'Aperti ora', value: storesList.filter(s => s.is_open_now).length, icon: CheckCircle, color: '#10B981' },
          { label: 'Chiusi ora', value: storesList.filter(s => !s.is_open_now).length, icon: XCircle, color: '#6B7280' },
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
              Stai per eliminare <strong>"{confirmDelete.name}"</strong>. Questa azione non può essere annullata.
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
