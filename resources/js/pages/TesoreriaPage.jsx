import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { cashMovements, employees as employeesApi } from '../api.jsx';
import {
  Plus, ArrowDownCircle, ArrowUpCircle, Filter, Store,
  TrendingUp, TrendingDown, DollarSign, Clock, RefreshCw,
  User, Search, CheckCircle, AlertCircle, Banknote, CreditCard
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import DatePicker from '../components/DatePicker.jsx';

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

/* ─── Tab Bar ─── */
function TabBar({ active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg)', borderRadius: 12, padding: 4, border: '1px solid var(--color-border)', width: 'fit-content' }}>
      {[
        { id: 'live',    label: '🟢 Cassa Live',       },
        { id: 'history', label: '📋 Movimentazioni',   },
      ].map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            background: active === t.id ? 'var(--color-accent)' : 'transparent',
            color: active === t.id ? '#fff' : 'var(--color-text-secondary)',
            transition: 'all 0.15s',
          }}
        >{t.label}</button>
      ))}
    </div>
  );
}

/* ─── Cassa Live Card ─── */
function StoreCashCard({ store, onMove }) {
  const balance = store.balance;
  const isPositive = balance >= 0;
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 18,
      padding: 20, border: '1px solid var(--color-border)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header negozio */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(123,111,208,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={18} color="#7B6FD0" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{store.store_name}</div>
            {store.last_movement && (
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} />
                Ultimo mov: {new Date(store.last_movement.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
        {/* Badge status */}
        <div style={{ padding: '4px 10px', borderRadius: 8, background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: isPositive ? '#10b981' : '#EF4444', fontSize: 11, fontWeight: 700 }}>
          {isPositive ? '✓ Regolare' : '⚠ Negativo'}
        </div>
      </div>

      {/* Saldo grande */}
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Saldo in Cassa</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: isPositive ? '#10b981' : '#EF4444', letterSpacing: '-0.02em' }}>
          {fmt(balance)}
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: 'rgba(16,185,129,0.07)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Entrate</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmt(store.total_deposits)}</div>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.07)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Uscite</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#EF4444' }}>{fmt(store.total_withdrawals)}</div>
        </div>
      </div>

      {/* Azione rapida */}
      <button
        onClick={() => onMove(store.store_id, store.store_name)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 0', borderRadius: 10, border: '1px dashed rgba(123,111,208,0.35)',
          background: 'rgba(123,111,208,0.04)', color: '#7B6FD0',
          cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,111,208,0.1)'; e.currentTarget.style.borderStyle = 'solid'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,111,208,0.04)'; e.currentTarget.style.borderStyle = 'dashed'; }}
      >
        <Plus size={14} /> Registra Movimento
      </button>
    </div>
  );
}

/* ─── Operator Field ─── */
function OperatorField({ value, onChange }) {
  const [empFound, setEmpFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    setEmpFound(null);
    if (!value || value.length < 3) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await employeesApi.getEmployees({ barcode: value, limit: 1 });
        const list = res.data?.data || [];
        if (list.length > 0) setEmpFound(list[0]);
        else setEmpFound(null);
      } catch {
        setEmpFound(null);
      } finally { setSearching(false); }
    }, 600);
    return () => clearTimeout(debounce.current);
  }, [value]);

  return (
    <div>
      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--color-text)', marginBottom: 6 }}>
        Codice Operatore
      </label>
      <div style={{ position: 'relative' }}>
        <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
        <input
          type="text"
          className="sp-input"
          style={{ paddingLeft: 36 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Scansiona o digita il codice barcode operatore"
        />
      </div>
      {searching && <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Ricerca operatore...</div>}
      {empFound && (
        <div style={{ marginTop: 6, padding: '6px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981', fontWeight: 700 }}>
          <CheckCircle size={13} /> {empFound.first_name} {empFound.last_name} trovato
        </div>
      )}
      {value.length >= 3 && !empFound && !searching && (
        <div style={{ marginTop: 6, padding: '6px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#EF4444', fontWeight: 700 }}>
          <AlertCircle size={13} /> Operatore non trovato (registrerà comunque)
        </div>
      )}
    </div>
  );
}

/* ─── MAIN PAGE ─── */
export default function TesoreriaPage() {
  const { selectedStoreId, storesList, user } = useOutletContext();
  const isDipendente = (user?.roles || []).includes('dipendente') || user?.role === 'dipendente';

  const [activeTab, setActiveTab] = useState(isDipendente ? 'history' : 'live');

  // ── Cassa Live ──
  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filterAlerts, setFilterAlerts] = useState(false); // filtra solo negozi >= 1000
  const CASH_ALERT_THRESHOLD = 1000;

  const [movements, setMovements] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCompany, setFilterCompany] = useState(''); // nome della societa
  const companiesList = [...new Set((storesList || []).map(s => s.company_group).filter(Boolean))];

  // ── balance live per lo store corrente (mostrata in History) ──
  const [storeBalance, setStoreBalance] = useState(null);

  // ── Modal ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStoreId, setModalStoreId] = useState(selectedStoreId || '');
  const [modalStoreName, setModalStoreName] = useState('');
  const [type, setType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [operatorBarcode, setOperatorBarcode] = useState('');
  const [saving, setSaving] = useState(false);

  /* fetch balances */
  const fetchBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await cashMovements.balances();
      setBalances(res.data?.data || []);
      setLastRefresh(new Date());
    } catch { }
    finally { setBalancesLoading(false); }
  }, []);

  /* fetch movements */
  const fetchMovements = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const res = await cashMovements.get(params);
      setMovements(res.data?.data || []);
    } catch {}
    finally { setHistLoading(false); }
  }, [selectedStoreId, dateFrom, dateTo]);

  /* balance live per il negozio corrente nella history */
  const fetchStoreBalance = useCallback(async () => {
    if (!selectedStoreId) { setStoreBalance(null); return; }
    try {
      const res = await cashMovements.balances();
      const found = (res.data?.data || []).find(b => String(b.store_id) === String(selectedStoreId));
      setStoreBalance(found?.balance ?? null);
    } catch {}
  }, [selectedStoreId]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);
  useEffect(() => { fetchMovements(); fetchStoreBalance(); }, [fetchMovements, fetchStoreBalance]);

  /* Auto-refresh balances ogni 30s */
  useEffect(() => {
    const t = setInterval(() => { fetchBalances(); fetchStoreBalance(); }, 30000);
    return () => clearInterval(t);
  }, [fetchBalances, fetchStoreBalance]);

  const openModal = (storeId = selectedStoreId, storeName = '') => {
    if (!storeId) { toast.error("Seleziona un negozio prima."); return; }
    setModalStoreId(storeId);
    setModalStoreName(storeName || storesList?.find(s => String(s.id) === String(storeId))?.name || '');
    setType('deposit'); setAmount(''); setNote(''); setOperatorBarcode('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { toast.error("Inserisci un importo valido."); return; }
    setSaving(true);
    try {
      await cashMovements.create({
        store_id: modalStoreId,
        type, amount, note,
        operator_barcode: operatorBarcode || undefined,
      });
      toast.success('Movimento registrato!');
      setIsModalOpen(false);
      fetchMovements();
      fetchBalances();
      fetchStoreBalance();
    } catch {
      toast.error('Errore durante il salvataggio.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>Tesoreria & Cassa</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Gestione flusso di cassa, versamenti e prelievi</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <TabBar active={activeTab} onChange={setActiveTab} />
          <button onClick={() => openModal()} className="sp-button-primary">
            <Plus size={16} /> Registra Movimento
          </button>
        </div>
      </div>

      {/* ══ TAB: CASSA LIVE ══ */}
      {activeTab === 'live' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              {lastRefresh && `Aggiornato: ${lastRefresh.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
            </div>
            <button
              onClick={fetchBalances}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}
            >
              <RefreshCw size={13} style={{ animation: balancesLoading ? 'spin 1s linear infinite' : 'none' }} />
              Aggiorna
            </button>
          </div>

          {balancesLoading && balances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-tertiary)' }}>Caricamento saldi...</div>
          ) : balances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-tertiary)' }}>Nessun negozio trovato.</div>
          ) : (
            <>
              {/* ── PANNELLO ALLERTA CASSA ────────────────────────────── */}
              {(() => {
                const alertStores = balances.filter(b => b.balance >= CASH_ALERT_THRESHOLD);
                if (alertStores.length === 0) return null;
                return (
                  <div style={{
                    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 14, padding: '14px 20px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertCircle size={18} color="#ef4444" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#ef4444' }}>
                          {alertStores.length} {alertStores.length === 1 ? 'negozio' : 'negozi'} con cassa ≥ €{CASH_ALERT_THRESHOLD.toLocaleString('it-IT')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {alertStores.map(s => s.store_name).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setFilterAlerts(v => !v)}
                      style={{
                        padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        fontWeight: 800, fontSize: 13, transition: 'all 0.2s',
                        background: filterAlerts ? '#ef4444' : 'rgba(239,68,68,0.15)',
                        color: filterAlerts ? '#fff' : '#ef4444',
                      }}
                    >
                      {filterAlerts ? '🔴 Mostra tutti' : '🔴 Filtra negozi in allerta'}
                    </button>
                  </div>
                );
              })()}

              {/* Totale aggregato */}
              <div style={{ background: 'linear-gradient(135deg,#7B6FD0,#5B50B0)', borderRadius: 18, padding: '20px 24px', color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Liquidità Totale (tutti i negozi)</div>
                  <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {fmt(balances.reduce((s, b) => s + b.balance, 0))}
                  </div>
                </div>
                <Banknote size={48} style={{ opacity: 0.2 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {(filterAlerts ? balances.filter(b => b.balance >= CASH_ALERT_THRESHOLD) : balances).map(store => (
                  <StoreCashCard key={store.store_id} store={store} onMove={(id, name) => openModal(id, name)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ TAB: MOVIMENTAZIONI ══ */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Saldo live negozio corrente */}
          {storeBalance !== null && selectedStoreId && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--color-surface)', borderRadius: 14, padding: '14px 20px',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13 }}>
                <Store size={15} color="#7B6FD0" />
                {storesList?.find(s => String(s.id) === String(selectedStoreId))?.name || 'Negozio'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>Saldo Cassa Live:</div>
                <div style={{
                  fontSize: 22, fontWeight: 900,
                  color: storeBalance >= 0 ? '#10b981' : '#EF4444',
                  letterSpacing: '-0.01em',
                }}>
                  {fmt(storeBalance)}
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'spBadgePulse 2s ease-out infinite' }} />
              </div>
            </div>
          )}

          {/* Filtri */}
          <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: 14, display: 'flex', gap: 16, alignItems: 'center', border: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
            <Filter size={16} color="var(--color-text-secondary)" />
            
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Da:</span>
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Inizio..." style={{ minWidth: 140 }} />
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>A:</span>
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="Fine..." style={{ minWidth: 140 }} />
            </div>

            {!selectedStoreId && companiesList.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)' }}>Società / Holding:</span>
                <select className="sp-select" value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={{ minHeight: 40, padding: '6px 12px' }}>
                  <option value="">Tutte le società...</option>
                  {companiesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {(dateFrom || dateTo || filterCompany) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterCompany(''); }} style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Reset</button>
            )}
          </div>

          {/* Calcolo Movimenti Filtrati */}
          {(() => {
            const filteredMovements = filterCompany ? movements.filter(m => m.company_group === filterCompany) : movements;
            const totIn = filteredMovements.filter(m => m.type === 'deposit').reduce((s, m) => s + parseFloat(m.amount || 0), 0);
            const totOut = filteredMovements.filter(m => m.type === 'withdrawal').reduce((s, m) => s + parseFloat(m.amount || 0), 0);

            return (
              <>
                {/* Riquadro Riepilogo Società (visibile se filtrato) */}
                {(dateFrom || dateTo || filterCompany) && filteredMovements.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr) minmax(200px, 1fr)', gap: 12 }}>
                    <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '16px 20px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>Movimenti Estratti</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-text)' }}>{filteredMovements.length}</div>
                    </div>
                    <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#10B981' }}>Totale Entrate (Incassi)</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981' }}>{fmt(totIn)}</div>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 14, padding: '16px 20px', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#EF4444' }}>Totale Uscite (Versamenti banca)</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: '#EF4444' }}>{fmt(totOut)}</div>
                    </div>
                  </div>
                )}

                {/* Tabella */}
                <div style={{ background: 'var(--color-surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  {histLoading ? (
                    <div style={{ padding: 40, textAlign: 'center' }}><div className="sp-spin" style={{ width: 32, height: 32, margin: '0 auto' }} /></div>
                  ) : filteredMovements.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Nessun movimento trovato per questi filtri.</div>
                  ) : (
                    <table className="sp-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Data & Ora</th>
                          {!selectedStoreId && <th>Negozio & Società</th>}
                          <th>Operatore</th>
                          <th>Tipo</th>
                          <th>Note</th>
                          <th style={{ textAlign: 'right' }}>Importo</th>
                          <th style={{ textAlign: 'right' }}>Fondi Rimanenti</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMovements.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontSize: 12 }}>{new Date(m.created_at).toLocaleString('it-IT')}</td>
                            {!selectedStoreId && (
                              <td>
                                <div style={{ fontWeight: 600 }}>{m.store_name || '-'}</div>
                                {m.company_group && <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{m.company_group}</div>}
                              </td>
                            )}
                            <td style={{ fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(123,111,208,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <User size={12} color="#7B6FD0" />
                                </div>
                                {m.employee_name || '-'}
                              </div>
                            </td>
                            <td>
                              {m.type === 'deposit' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#10B981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 99, fontSize: 11 }}>
                                  <ArrowDownCircle size={12} /> Incasso / Versamento
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#EF4444', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 99, fontSize: 11 }}>
                                  <ArrowUpCircle size={12} /> Prelievo / Banca
                                </span>
                              )}
                            </td>
                            <td style={{ color: 'var(--color-text-secondary)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.note || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: m.type === 'deposit' ? '#10B981' : '#EF4444' }}>
                              {m.type === 'deposit' ? '+' : '-'}{fmt(m.amount)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>
                              {m.balance_after_transaction !== null && m.balance_after_transaction !== undefined ? (
                                <span style={{ padding: '4px 8px', background: 'var(--color-bg)', borderRadius: 20 }}>{fmt(m.balance_after_transaction)}</span>
                              ) : (
                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11, fontWeight: 400 }}>N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ══ MODAL REGISTRA MOVIMENTO ══ */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="sp-animate-in" style={{ background: 'var(--color-surface)', width: '100%', maxWidth: 480, borderRadius: 24, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Registra Movimento di Cassa</h2>
              {modalStoreName && <div style={{ fontSize: 13, color: '#7B6FD0', fontWeight: 600, marginTop: 4 }}>🏪 {modalStoreName}</div>}
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Tipo */}
              <div>
                <label className="sp-label">Tipo di Movimento</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button type="button" onClick={() => setType('deposit')} style={{ padding: '14px 12px', borderRadius: 12, border: '2px solid', borderColor: type === 'deposit' ? '#10B981' : 'var(--color-border)', background: type === 'deposit' ? 'rgba(16,185,129,0.1)' : 'transparent', color: type === 'deposit' ? '#10B981' : 'var(--color-text)', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    <ArrowDownCircle size={16} /> Entrata in Cassa
                  </button>
                  <button type="button" onClick={() => setType('withdrawal')} style={{ padding: '14px 12px', borderRadius: 12, border: '2px solid', borderColor: type === 'withdrawal' ? '#EF4444' : 'var(--color-border)', background: type === 'withdrawal' ? 'rgba(239,68,68,0.1)' : 'transparent', color: type === 'withdrawal' ? '#EF4444' : 'var(--color-text)', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                    <ArrowUpCircle size={16} /> Prelievo / Banca
                  </button>
                </div>
              </div>

              {/* Codice Operatore */}
              <OperatorField value={operatorBarcode} onChange={setOperatorBarcode} />

              {/* Importo */}
              <div>
                <label className="sp-label">Importo (€)</label>
                <input type="number" step="0.01" min="0.01" className="sp-input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
              </div>

              {/* Note */}
              <div>
                <label className="sp-label">Note / Causale</label>
                <textarea className="sp-input" style={{ minHeight: 70, resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)} placeholder="Es. Versamento in banca, fondo cassa..." />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="sp-button" style={{ flex: 1 }}>Annulla</button>
                <button type="submit" className="sp-button-primary" style={{ flex: 2 }} disabled={saving}>
                  {saving ? 'Salvataggio...' : '✓ Salva Movimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
