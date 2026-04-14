import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chat } from '../api.jsx';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';

const POLL_MS = 5000;
const CONV_POLL_MS = 8000;

const roleLabel = (r) => ({ superadmin: 'Manager', admin_cliente: 'Manager', dipendente: 'Operatore' }[r] || r || 'Utente');
const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (d.toDateString() === new Date().toDateString()) return 'Oggi';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};
const truncate = (s, n = 35) => s && s.length > n ? s.slice(0, n) + '…' : (s || '');

/* ──────────────────────────────────────────────────────────────
   THREAD — singola conversazione (admin risponde a un negozio)
   ────────────────────────────────────────────────────────────── */
function ChatThread({ user, storeId, storeName, priority, onBack }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const bottomRef = useRef(null);

  const accentGrad = priority === 'urgent'
    ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
    : 'linear-gradient(135deg,#7B6FD0,#4F46E5)';
  const accentColor = priority === 'urgent' ? '#EF4444' : '#7B6FD0';

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const params = { store_id: storeId, priority };
      if (!initial && lastTs) params.since = lastTs;
      const res = await chat.getMessages(params);
      const newMsgs = res.data?.data || [];
      if (initial) {
        setMessages(newMsgs);
      } else if (newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
      }
      if (newMsgs.length > 0) setLastTs(newMsgs[newMsgs.length - 1].created_at);
    } catch {}
  }, [storeId, priority, lastTs]);

  useEffect(() => {
    fetchMessages(true);
    chat.markRead({ store_id: storeId, priority }).catch(() => {});
  }, [storeId, priority]);

  useEffect(() => {
    const t = setInterval(() => fetchMessages(false), POLL_MS);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await chat.sendMessage({ message: text.trim(), store_id: storeId, priority });
      setText('');
      await fetchMessages(false);
    } catch {} finally { setSending(false); }
  };

  const grouped = messages.reduce((acc, msg) => {
    const k = fmtDate(msg.created_at);
    if (!acc[k]) acc[k] = [];
    acc[k].push(msg);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-header thread */}
      <div style={{ background: accentGrad, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 7, width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>🏪 {storeName}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>{priority === 'urgent' ? '🚨 Urgente' : '💬 Normale'}</div>
        </div>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
      </div>

      {/* Messaggi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#9ca3af' }}>
            <div style={{ fontSize: 28 }}>{priority === 'urgent' ? '🚨' : '💬'}</div>
            <div style={{ fontSize: 11, textAlign: 'center' }}>Nessun messaggio da {storeName}</div>
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '6px 0 3px' }}>{date}</div>
            {msgs.map(msg => {
              const isMe = msg.sender_user_id === user?.id;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 5 }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontWeight: 900, color: isMe ? accentColor : '#374151' }}>{isMe ? 'Tu (Manager)' : (msg.sender_name || 'Operatore')}</span>
                    <span style={{ opacity: 0.5 }}>· {roleLabel(msg.sender_role)} · {fmtTime(msg.created_at)}</span>
                  </div>
                  <div style={{
                    maxWidth: '82%', padding: '8px 12px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? accentGrad : '#f3f4f6',
                    color: isMe ? '#fff' : '#1a1a2e',
                    fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                  }}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          placeholder={`Rispondi a ${storeName}...`}
          autoFocus
          style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }}
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <button type="submit" disabled={!text.trim() || sending}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: text.trim() ? accentGrad : '#e5e7eb', color: '#fff', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {sending ? '…' : '➤'}
        </button>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PANNELLO ADMIN — lista conversazioni + thread a destra
   ────────────────────────────────────────────────────────────── */
function AdminChatPanel({ user, priority, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null); // { storeId, storeName }
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await chat.getConversations();
      setConversations(res.data?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConversations(); }, []);
  useEffect(() => {
    const t = setInterval(fetchConversations, CONV_POLL_MS);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // Filtra per priority tab
  const filtered = conversations.filter(c =>
    priority === 'urgent' ? (c.last_urgent || c.unread_urgent > 0) : true
  );

  const fmtLast = (c) => {
    const m = priority === 'urgent' ? c.last_urgent : (c.last_normal || c.last_urgent);
    if (!m) return 'Nessun messaggio';
    return truncate(m.message, 40);
  };
  const fmtLastTime = (c) => {
    const m = priority === 'urgent' ? c.last_urgent : (c.last_normal || c.last_urgent);
    return m?.created_at ? fmtTime(m.created_at) : '';
  };
  const unreadCount = (c) => priority === 'urgent' ? c.unread_urgent : c.unread_normal;
  const accentGrad  = priority === 'urgent' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#7B6FD0,#4F46E5)';
  const accentColor = priority === 'urgent' ? '#EF4444' : '#7B6FD0';
  const title = priority === 'urgent' ? '🚨 Segnalazioni Urgenti' : '💬 Chat Negozi';

  return (
    <div style={{
      position: 'fixed', top: 60, right: 16, zIndex: 1001,
      width: selected ? 620 : 300, height: 500, borderRadius: 16,
      background: 'var(--color-surface,#fff)',
      border: '1px solid var(--color-border,#e5e7eb)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'chatIn 0.2s cubic-bezier(0.4,0,0.2,1)',
      transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Header */}
      <div style={{ background: accentGrad, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 13, color: '#fff' }}>{title}</div>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lista negozi */}
        <div style={{ width: 300, borderRight: selected ? '1px solid #e5e7eb' : 'none', overflowY: 'auto', flexShrink: 0 }}>
          {loading && (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Caricamento…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏪</div>
              Nessun negozio con messaggi
            </div>
          )}
          {filtered.map(c => {
            const unread = unreadCount(c);
            const isActive = selected?.storeId === c.store_id;
            return (
              <div
                key={c.store_id}
                onClick={() => { setSelected({ storeId: c.store_id, storeName: c.store_name }); }}
                style={{
                  padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                  background: isActive ? `rgba(${priority === 'urgent' ? '239,68,68' : '123,111,208'},0.08)` : 'transparent',
                  borderLeft: isActive ? `3px solid ${accentColor}` : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9f9fb'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 900, color: '#fff',
                    }}>{c.store_name?.charAt(0) || '?'}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#1a1a2e' }}>{c.store_name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{fmtLast(c)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{fmtLastTime(c)}</div>
                    {unread > 0 && (
                      <span style={{ background: accentColor, color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                </div>
                {c.unread_urgent > 0 && priority !== 'urgent' && (
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginTop: 4 }}>🚨 {c.unread_urgent} urgenti non lette</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Thread conversazione */}
        {selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatThread
              user={user}
              storeId={selected.storeId}
              storeName={selected.storeName}
              priority={priority}
              onBack={() => setSelected(null)}
            />
          </div>
        )}

        {/* Placeholder "seleziona un negozio" */}
        {!selected && filtered.length > 0 && (
          <div style={{ flex: 1, display: 'none' }} />
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   PANNELLO DIPENDENTE — chat singola con barcode operatore
   ────────────────────────────────────────────────────────────── */
function EmployeeChatPanel({ user, selectedStoreId, priority, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const [opCode, setOpCode] = useState('');
  const [opName, setOpName] = useState('');
  const [opVerifying, setOpVerifying] = useState(false);
  const [opError, setOpError] = useState('');
  const [opVerified, setOpVerified] = useState(false);
  const bottomRef = useRef(null);

  const accentGrad  = priority === 'urgent' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#7B6FD0,#4F46E5)';
  const accentColor = priority === 'urgent' ? '#EF4444' : '#7B6FD0';
  const title = priority === 'urgent' ? '🚨 Segnalazione Urgente' : '💬 Chat Area Manager';

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const params = { store_id: selectedStoreId, priority };
      if (!initial && lastTs) params.since = lastTs;
      const res = await chat.getMessages(params);
      const newMsgs = res.data?.data || [];
      if (initial) setMessages(newMsgs);
      else if (newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
      }
      if (newMsgs.length > 0) setLastTs(newMsgs[newMsgs.length - 1].created_at);
    } catch {}
  }, [selectedStoreId, priority, lastTs]);

  useEffect(() => { fetchMessages(true); chat.markRead({ store_id: selectedStoreId, priority }).catch(() => {}); }, [selectedStoreId, priority]);
  useEffect(() => { const t = setInterval(() => fetchMessages(false), POLL_MS); return () => clearInterval(t); }, [fetchMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const verifyOperator = async () => {
    if (!opCode.trim()) { setOpError('Inserisci il codice operatore'); return; }
    setOpVerifying(true); setOpError('');
    try {
      // Usa l'istanza api già configurata (authToken + X-Tenant-Code corretti)
      const { default: api } = await import('../api.jsx');
      const res = await api.get('/employees', { params: { barcode: opCode.trim(), limit: 1 } });
      const empList = res.data?.data || [];
      if (empList.length > 0) {
        const emp = empList[0];
        setOpName(`${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || opCode);
        setOpVerified(true);
      } else {
        setOpError('Codice non trovato. Verifica il badge del dipendente.');
      }
    } catch (err) {
      setOpError('Errore di connessione. Riprova.');
    }
    finally { setOpVerifying(false); }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await chat.sendMessage({ message: text.trim(), store_id: selectedStoreId, priority, operator_name: opName, operator_code: opCode });
      setText(''); await fetchMessages(false);
    } catch {} finally { setSending(false); }
  };

  const grouped = messages.reduce((acc, msg) => {
    const k = fmtDate(msg.created_at);
    if (!acc[k]) acc[k] = [];
    acc[k].push(msg);
    return acc;
  }, {});

  return (
    <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 1001, width: 340, height: 480, borderRadius: 16, background: 'var(--color-surface,#fff)', border: '1px solid #e5e7eb', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'chatIn 0.2s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ background: accentGrad, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>{title}</div>
          {opVerified && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>✓ {opName}</div>}
        </div>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9ca3af' }}>
            <div style={{ fontSize: 32 }}>{priority === 'urgent' ? '🚨' : '💬'}</div>
            <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{priority === 'urgent' ? 'Segnala un problema urgente' : 'Chatta con l\'Area Manager'}</div>
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '5px 0 2px' }}>{date}</div>
            {msgs.map(msg => {
              const isMe = msg.sender_user_id === user?.id;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 5 }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, marginBottom: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 900, color: isMe ? accentColor : '#374151' }}>{isMe ? (opName || 'Tu') : (msg.sender_name || 'Manager')}</span>
                    {msg.store_name && <span style={{ padding: '0 4px', borderRadius: 4, background: 'rgba(123,111,208,0.1)', color: '#7B6FD0', fontSize: 8 }}>🏪 {msg.store_name}</span>}
                    <span style={{ opacity: 0.45 }}>· {fmtTime(msg.created_at)}</span>
                  </div>
                  <div style={{ maxWidth: '82%', padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isMe ? accentGrad : '#f3f4f6', color: isMe ? '#fff' : '#1a1a2e', fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word' }}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {!opVerified && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: 'rgba(123,111,208,0.04)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7B6FD0', marginBottom: 6 }}>🔐 Identifica operatore</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={opCode} onChange={e => setOpCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyOperator()}
              placeholder="Scansiona o inserisci codice..." autoFocus
              style={{ flex: 1, border: `1.5px solid ${opError ? '#ef4444' : '#e5e7eb'}`, borderRadius: 9, padding: '7px 10px', fontSize: 12, outline: 'none' }} />
            <button onClick={verifyOperator} disabled={opVerifying} style={{ padding: '0 12px', borderRadius: 9, border: 'none', background: accentGrad, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {opVerifying ? '…' : '✓'}
            </button>
          </div>
          {opError && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{opError}</div>}
        </div>
      )}

      <form onSubmit={handleSend} style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          placeholder={!opVerified ? 'Verifica prima il codice ↑' : (priority === 'urgent' ? 'Descrivi il problema...' : 'Scrivi un messaggio...')}
          disabled={!opVerified}
          style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', opacity: opVerified ? 1 : 0.5 }}
          onFocus={e => { if (opVerified) e.target.style.borderColor = accentColor; }}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <button type="submit" disabled={!text.trim() || sending || !opVerified}
          style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: (text.trim() && opVerified) ? accentGrad : '#e5e7eb', color: '#fff', cursor: (text.trim() && opVerified) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {sending ? '…' : '➤'}
        </button>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   TOPBAR BUTTONS — esportato e usato nel Layout
   ────────────────────────────────────────────────────────────── */
export function ChatTopbarButtons({ user, selectedStoreId }) {
  const [openPanel, setOpenPanel] = useState(null); // null | 'chat' | 'urgent'
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadUrgent, setUnreadUrgent] = useState(0);
  const isAdmin = (user?.roles || []).some(r => ['superadmin', 'admin_cliente'].includes(r));

  useEffect(() => {
    const poll = async () => {
      try {
        if (isAdmin) {
          const res = await chat.getConversations();
          const convs = res.data?.data || [];
          if (openPanel !== 'chat') setUnreadChat(convs.reduce((s, c) => s + (c.unread_normal || 0), 0));
          if (openPanel !== 'urgent') setUnreadUrgent(convs.reduce((s, c) => s + (c.unread_urgent || 0), 0));
        } else {
          const [r1, r2] = await Promise.all([
            chat.getMessages({ store_id: selectedStoreId, priority: 'normal', limit: 1 }),
            chat.getMessages({ store_id: selectedStoreId, priority: 'urgent', limit: 1 }),
          ]);
          if (openPanel !== 'chat') setUnreadChat(r1.data?.unread_count ?? 0);
          if (openPanel !== 'urgent') setUnreadUrgent(r2.data?.unread_count ?? 0);
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, CONV_POLL_MS);
    return () => clearInterval(t);
  }, [selectedStoreId, openPanel, isAdmin]);

  const toggle = (panel) => setOpenPanel(o => o === panel ? null : panel);

  const BtnStyle = (p, color, unread) => ({
    width: 36, height: 36, borderRadius: 10,
    background: openPanel === p ? (p === 'urgent' ? 'linear-gradient(135deg,#b91c1c,#dc2626)' : 'linear-gradient(135deg,#5B50B0,#4F46E5)') : unread > 0 ? `rgba(${p === 'urgent' ? '239,68,68' : '123,111,208'},0.12)` : 'var(--color-bg)',
    border: `1.5px solid ${openPanel === p || unread > 0 ? color + '66' : 'var(--color-border)'}`,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, position: 'relative', transition: 'all 0.15s',
  });

  return (
    <>
      {openPanel && (
        isAdmin
          ? <AdminChatPanel user={user} priority={openPanel} onClose={() => setOpenPanel(null)} />
          : <EmployeeChatPanel user={user} selectedStoreId={selectedStoreId} priority={openPanel} onClose={() => setOpenPanel(null)} />
      )}

      {/* 🚨 */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        {unreadUrgent > 0 && openPanel !== 'urgent' && (
          <span style={{ position: 'absolute', top: -4, right: -4, zIndex: 2, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-surface)' }}>
            {unreadUrgent > 9 ? '9+' : unreadUrgent}
          </span>
        )}
        <button onClick={() => toggle('urgent')} title="Segnalazioni Urgenti"
          style={BtnStyle('urgent', '#EF4444', unreadUrgent)}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        >
          {openPanel === 'urgent' ? '✕' : '🚨'}
          {unreadUrgent > 0 && openPanel !== 'urgent' && (
            <span style={{ position: 'absolute', inset: -1, borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.5)', animation: 'ripple 1.5s ease-out infinite' }} />
          )}
        </button>
      </div>

      {/* 💬 */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        {unreadChat > 0 && openPanel !== 'chat' && (
          <span style={{ position: 'absolute', top: -4, right: -4, zIndex: 2, background: '#7B6FD0', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--color-surface)' }}>
            {unreadChat > 9 ? '9+' : unreadChat}
          </span>
        )}
        <button onClick={() => toggle('chat')} title="Chat Negozi"
          style={BtnStyle('chat', '#7B6FD0', unreadChat)}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        >
          {openPanel === 'chat' ? '✕' : '💬'}
        </button>
      </div>

      <style>{`
        @keyframes chatIn { from { transform:translateY(-8px) scale(0.97); opacity:0; } to { transform:translateY(0) scale(1); opacity:1; } }
        @keyframes ripple { 0% { transform:scale(1); opacity:0.7; } 100% { transform:scale(1.5); opacity:0; } }
      `}</style>
    </>
  );
}

export default function ChatWidget() { return null; }
