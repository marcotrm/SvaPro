import React, { useState, useEffect, useRef } from 'react';
import { X, Loader, User, Building2, CheckCircle, Mail, Phone, RefreshCw, Upload, FileText, Trash2, Sparkles } from 'lucide-react';
import { customers as customersApi } from '../api.jsx';
import { calcolaCodiceFiscale, cercaComune } from '../utils/codiceFiscale.js';
import DatePicker from './DatePicker.jsx';

const TAB_PRIVATO = 'privato';
const TAB_AZIENDA = 'azienda';

/* ─── stile unificato con la dashboard ────────────────────── */
const S = {
  label:   { fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' },
  input:   'sp-input',
  select:  'sp-select',
  section: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fullRow: { gridColumn: '1 / -1' },
  err:     { fontSize: 11, color: 'var(--color-error)', marginTop: 4 },
};

function Field({ label, error, children, full }) {
  return (
    <div style={full ? S.fullRow : {}}>
      {label && <label style={S.label}>{label}</label>}
      {children}
      {error && <p style={S.err}>{error}</p>}
    </div>
  );
}

/* ─── Helper OTP email ─────────────────────────────────────── */
function EmailOtpSection({ customerId, email, onVerified, alreadyVerified }) {
  const [otpSent,    setOtpSent]    = useState(false);
  const [otpValue,   setOtpValue]   = useState('');
  const [sending,    setSending]    = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const [verified,   setVerified]   = useState(alreadyVerified);
  const [msg,        setMsg]        = useState('');
  const [error,      setError]      = useState('');

  const sendOtp = async () => {
    if (!email) { setError('Inserisci prima l\'email.'); return; }
    if (!customerId) { setError('Salva prima il cliente per verificare l\'email.'); return; }
    setSending(true); setMsg(''); setError('');
    try {
      await customersApi.post_(`/customers/${customerId}/email-otp/send`, { email });
      setOtpSent(true);
      setMsg('Codice inviato via email. Valido 10 minuti.');
    } catch (e) {
      setError(e.response?.data?.message || 'Errore invio OTP.');
    } finally { setSending(false); }
  };

  const verifyOtp = async () => {
    if (!otpValue || otpValue.length !== 6) { setError('Inserisci il codice a 6 cifre.'); return; }
    setVerifying(true); setMsg(''); setError('');
    try {
      await customersApi.post_(`/customers/${customerId}/email-otp/verify`, { otp: otpValue });
      setVerified(true);
      onVerified?.();
      setMsg('✓ Email verificata!');
    } catch (e) {
      setError(e.response?.data?.message || 'Codice non valido.');
    } finally { setVerifying(false); }
  };

  if (verified) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#22C55E', fontWeight: 600, marginTop: 6 }}>
        <CheckCircle size={14} /> Email verificata
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!otpSent ? (
        <button type="button" onClick={sendOtp} disabled={sending || !email}
          style={{ fontSize: 12, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
          {sending ? <Loader size={12} /> : <Mail size={12} />}
          {sending ? 'Invio...' : 'Verifica email (OTP)'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="sp-input"
            style={{ width: 120, fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
            maxLength={6}
            placeholder="000000"
            value={otpValue}
            onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
          />
          <button type="button" onClick={verifyOtp} disabled={verifying} className="sp-btn sp-btn-primary sp-btn-sm">
            {verifying ? <Loader size={12} /> : 'Verifica'}
          </button>
          <button type="button" onClick={() => { setOtpSent(false); setOtpValue(''); }} className="sp-btn sp-btn-ghost sp-btn-sm">
            Rinvia
          </button>
        </div>
      )}
      {msg   && <p style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>{msg}</p>}
      {error && <p style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>{error}</p>}
    </div>
  );
}

/* ─── Upload Visura PDF ────────────────────────────────────── */
function VisuraUpload({ customerId, currentPath, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded,  setUploaded]  = useState(!!currentPath);
  const [err,       setErr]       = useState('');
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    if (!customerId) { setErr('Salva prima il cliente prima di caricare la visura.'); return; }
    if (file.type !== 'application/pdf') { setErr('Solo file PDF.'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('File troppo grande (max 5MB).'); return; }
    setUploading(true); setErr('');
    const fd = new FormData();
    fd.append('visura', file);
    try {
      await customersApi.uploadVisura(customerId, fd);
      setUploaded(true);
      onUploaded?.(file.name);
    } catch (e) {
      setErr(e.response?.data?.message || 'Errore upload.');
    } finally { setUploading(false); }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])} />
      {uploaded ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
          <FileText size={16} color="#22C55E" />
          <span style={{ fontSize: 13, color: '#15803D', fontWeight: 600, flex: 1 }}>Visura caricata</span>
          <button type="button" onClick={() => inputRef.current?.click()}
            style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)' }}>
            Sostituisci
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          style={{ width: '100%', padding: '12px 16px', border: '2px dashed var(--color-border)', borderRadius: 12, background: 'var(--color-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}>
          {uploading ? <Loader size={16} /> : <Upload size={16} />}
          {uploading ? 'Caricamento...' : '📄 Carica Visura Camerale (PDF, max 5MB)'}
        </button>
      )}
      {err && <p style={S.err}>{err}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL PRINCIPALE
══════════════════════════════════════════════════════════════ */
export default function CustomerModal({ customer, onClose, onSave }) {
  const initialType = customer?.customer_type || TAB_PRIVATO;
  const [tab, setTab]     = useState(initialType);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Ricerca comune per CF
  const [comuneQuery,   setComuneQuery]   = useState('');
  const [comuneResults, setComuneResults] = useState([]);
  const [cfGenerating,  setCfGenerating]  = useState(false);

  const [formData, setFormData] = useState({
    customer_type:   initialType,
    code:            customer?.code || '',
    // Privato
    first_name:      customer?.first_name || '',
    last_name:       customer?.last_name || '',
    codice_fiscale:  customer?.codice_fiscale || '',
    birth_date:      customer?.birth_date || '',
    birth_place_code: customer?.birth_place_code || '',
    birth_place_name: '',
    gender:          customer?.gender || '',
    // Azienda
    company_name:    customer?.company_name || '',
    vat_number:      customer?.vat_number || '',
    sdi_code:        customer?.sdi_code || '',
    pec_email:       customer?.pec_email || '',
    contact_person:  customer?.contact_person || '',
    // Comuni
    email:           customer?.email || '',
    phone:           customer?.phone || '',
    marketing_consent: customer?.marketing_consent || false,
    // Indirizzo
    address:         customer?.address || '',
    city:            customer?.city || '',
    province:        customer?.province || '',
    zip_code:        customer?.zip_code || '',
    country:         customer?.country || 'IT',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleTabSwitch = (newTab) => {
    setTab(newTab);
    setFormData(prev => ({ ...prev, customer_type: newTab }));
    setFieldErrors({});
    setError('');
  };

  // Auto-ricalcola CF quando cambiano i campi rilevanti
  useEffect(() => {
    const { first_name, last_name, birth_date, gender, birth_place_code } = formData;
    if (first_name && last_name && birth_date && gender && birth_place_code) {
      setCfGenerating(true);
      const cf = calcolaCodiceFiscale(last_name, first_name, birth_date, gender, birth_place_code);
      if (cf) setFormData(prev => ({ ...prev, codice_fiscale: cf }));
      setCfGenerating(false);
    }
  }, [formData.first_name, formData.last_name, formData.birth_date, formData.gender, formData.birth_place_code]);

  // Ricerca comune con debounce
  useEffect(() => {
    if (!comuneQuery || comuneQuery.length < 2) { setComuneResults([]); return; }
    const timer = setTimeout(async () => {
      const risultati = await cercaComune(comuneQuery);
      setComuneResults(risultati);
    }, 350);
    return () => clearTimeout(timer);
  }, [comuneQuery]);

  const selectComune = (comune) => {
    setFormData(prev => ({ ...prev, birth_place_code: comune.value, birth_place_name: comune.nome }));
    setComuneQuery(comune.label);
    setComuneResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setFieldErrors({});
      const payload = { ...formData, customer_type: tab };
      if (customer?.id) {
        await customersApi.updateCustomer(customer.id, payload);
      } else {
        await customersApi.createCustomer(payload);
      }
      onSave();
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setFieldErrors(serverErrors);
        setError('Controlla i campi evidenziati.');
      } else {
        setError(err.response?.data?.message || err.userFriendlyMessage || err.message || 'Errore sconosciuto.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fe = (field) => fieldErrors[field]?.[0];
  const isEdit = !!customer?.id;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 20, width: '100%',
        maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: '1px solid var(--color-border)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              {isEdit ? 'Modifica Cliente' : 'Nuovo Cliente'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isEdit ? (
                <>
                  <span style={{ background: 'var(--color-accent)', color: '#fff', borderRadius: 6, padding: '1px 8px', fontWeight: 800, fontFamily: 'monospace', fontSize: 13 }}>#{customer.id}</span>
                  <span>{customer.first_name || customer.company_name} {customer.last_name || ''}</span>
                </>
              ) : 'Aggiungi un nuovo cliente al gestionale'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--color-bg)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 8, padding: '16px 24px 0', flexShrink: 0 }}>
          {[{ key: TAB_PRIVATO, label: 'Privato', Icon: User }, { key: TAB_AZIENDA, label: 'Azienda', Icon: Building2 }].map(({ key, label, Icon }) => (
            <button key={key} type="button" onClick={() => handleTabSwitch(key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: 'none',
              cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
              background: tab === key ? 'var(--color-accent)' : 'var(--color-bg)',
              color: tab === key ? '#fff' : 'var(--color-text-secondary)',
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--color-error-bg)', border: '1px solid #fca5a5', borderRadius: 10, color: 'var(--color-error)', fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <div style={S.section}>
            {/* ─── TAB PRIVATO ─────────────────────────────── */}
            {tab === TAB_PRIVATO && (<>
              <Field label="Nome *" error={fe('first_name')}>
                <input className={S.input} name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Es: Marco" />
              </Field>
              <Field label="Cognome *" error={fe('last_name')}>
                <input className={S.input} name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Es: Rossi" />
              </Field>

              {/* Email + OTP */}
              <Field label="Email" error={fe('email')} full>
                <input className={S.input} name="email" type="email" value={formData.email} onChange={handleChange} placeholder="esempio@email.it" />
                <EmailOtpSection
                  customerId={customer?.id}
                  email={formData.email}
                  alreadyVerified={!!customer?.email_verified_at}
                  onVerified={() => {}}
                />
              </Field>

              <Field label="Telefono" error={fe('phone')}>
                <input className={S.input} name="phone" value={formData.phone} onChange={handleChange} placeholder="+39 333 1234567" />
              </Field>
              <Field label="Data di Nascita" error={fe('birth_date')}>
                <DatePicker className={S.input} name="birth_date" value={formData.birth_date} onChange={handleChange} placeholder="Seleziona data di nascita" />
              </Field>

              <Field label="Sesso" error={fe('gender')}>
                <select className={S.select} name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="">— Seleziona —</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </Field>

              {/* Comune di nascita con autocomplete */}
              <Field label="Comune di Nascita" error={fe('birth_place_code')} full>
                <div style={{ position: 'relative' }}>
                  <input
                    className={S.input}
                    placeholder="Inizia a digitare il comune..."
                    value={comuneQuery || formData.birth_place_name}
                    onChange={e => setComuneQuery(e.target.value)}
                  />
                  {comuneResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden',
                    }}>
                      {comuneResults.map(c => (
                        <button key={c.value} type="button" onClick={() => selectComune(c)}
                          style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              {/* Codice Fiscale con auto-generazione */}
              <Field label={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>Codice Fiscale <span style={{ color: 'var(--color-accent)', fontSize: 10 }}><Sparkles size={10} style={{ display:'inline' }} /> auto</span></span>} error={fe('codice_fiscale')} full>
                <div style={{ position: 'relative' }}>
                  <input
                    className={S.input}
                    name="codice_fiscale"
                    value={formData.codice_fiscale}
                    onChange={handleChange}
                    placeholder="Compilato automaticamente dai dati sopra"
                    style={{ paddingRight: 42, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }}
                    maxLength={16}
                  />
                  {cfGenerating && (
                    <RefreshCw size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} className="sp-spin" />
                  )}
                </div>
                <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  Compilato automaticamente da nome, cognome, data e comune di nascita. Puoi modificarlo manualmente.
                </p>
              </Field>
            </>)}

            {/* ─── TAB AZIENDA ─────────────────────────────── */}
            {tab === TAB_AZIENDA && (<>
              <Field label="Ragione Sociale *" error={fe('company_name')} full>
                <input className={S.input} name="company_name" value={formData.company_name} onChange={handleChange} required placeholder="Es: Esempio S.r.l." />
              </Field>
              <Field label="Partita IVA" error={fe('vat_number')}>
                <input className={S.input} name="vat_number" value={formData.vat_number} onChange={handleChange} placeholder="IT12345678901" />
              </Field>
              <Field label="Codice SDI" error={fe('sdi_code')}>
                <input className={S.input} name="sdi_code" value={formData.sdi_code} onChange={handleChange} placeholder="Es: ABCDEFG" maxLength={7} />
              </Field>
              <Field label="Codice Licenza" error={fe('license_code')}>
                <input className={S.input} name="license_code" value={formData.license_code || ''} onChange={handleChange} placeholder="Es: LIC-2026-001" style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
              </Field>
              <Field label="PEC" error={fe('pec_email')}>
                <input className={S.input} type="email" name="pec_email" value={formData.pec_email} onChange={handleChange} placeholder="pec@pec-azienda.it" />
              </Field>
              <Field label="Referente" error={fe('contact_person')}>
                <input className={S.input} name="contact_person" value={formData.contact_person} onChange={handleChange} placeholder="Nome referente" />
              </Field>

              <Field label="Email" error={fe('email')}>
                <input className={S.input} type="email" name="email" value={formData.email} onChange={handleChange} placeholder="info@azienda.it" />
                <EmailOtpSection
                  customerId={customer?.id}
                  email={formData.email}
                  alreadyVerified={!!customer?.email_verified_at}
                  onVerified={() => {}}
                />
              </Field>

              <Field label="Telefono" error={fe('phone')}>
                <input className={S.input} name="phone" value={formData.phone} onChange={handleChange} placeholder="+39 02 1234567" />
              </Field>

              {/* Visura Camerale */}
              <Field label="Visura Camerale" full>
                <VisuraUpload
                  customerId={customer?.id}
                  currentPath={customer?.visura_camerale_path}
                />
              </Field>
            </>)}

            {/* ─── SEZIONE INDIRIZZO (comune a entrambi i tab) ─── */}
            <div style={{ ...S.fullRow, borderTop: '1px solid var(--color-border)', paddingTop: 16, marginTop: 4 }}>
              <label style={{ ...S.label, marginBottom: 12 }}>Indirizzo</label>
              <div style={S.section}>
                <Field label="Via / Indirizzo" error={fe('address')} full>
                  <input className={S.input} name="address" value={formData.address} onChange={handleChange} placeholder="Via Roma 1" />
                </Field>
                <Field label="Città" error={fe('city')}>
                  <input className={S.input} name="city" value={formData.city} onChange={handleChange} placeholder="Milano" />
                </Field>
                <Field label="Provincia" error={fe('province')}>
                  <input className={S.input} name="province" value={formData.province} onChange={handleChange} placeholder="MI" maxLength={2} />
                </Field>
                <Field label="CAP" error={fe('zip_code')}>
                  <input className={S.input} name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="20100" maxLength={5} />
                </Field>
                <Field label="Nazione" error={fe('country')}>
                  <input className={S.input} name="country" value={formData.country} onChange={handleChange} placeholder="IT" maxLength={2} />
                </Field>
              </div>
            </div>

            {/* ─── Consenso marketing ─── */}
            <div style={S.fullRow}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" name="marketing_consent" checked={formData.marketing_consent} onChange={handleChange}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  Consenso marketing (WhatsApp, email, SMS)
                </span>
              </label>
            </div>

            {/* ─── Codice tessera fidelity + Numero Cliente ─── */}
            <Field label="Codice Tessera Fidelity" error={fe('code')} full>
              <input
                className={S.input}
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="Es: FID-0001 (lascia vuoto per assegnazione automatica)"
                style={{ fontFamily: 'monospace', letterSpacing: 1 }}
              />
              <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                Codice univoco per la tessera fedeltà del cliente
              </p>
            </Field>
            {isEdit && (
              <Field label="N° Cliente (progressivo)">
                <div style={{
                  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '9px 12px', fontFamily: 'monospace',
                  fontWeight: 800, fontSize: 16, color: 'var(--color-accent)',
                  letterSpacing: 1,
                }}>
                  #{customer.id}
                </div>
                <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                  Numero progressivo assegnato automaticamente alla creazione
                </p>
              </Field>
            )}
          </div>
        </form>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="sp-btn sp-btn-secondary">Annulla</button>
          <button type="submit" onClick={handleSubmit} disabled={loading} className="sp-btn sp-btn-primary" style={{ minWidth: 120 }}>
            {loading ? <><Loader size={14} /> Salvataggio...</> : (isEdit ? 'Salva Modifiche' : 'Crea Cliente')}
          </button>
        </div>
      </div>
    </div>
  );
}
