import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chat } from '../api.jsx';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';

const POLL_INTERVAL = 5000;

const roleLabel = (role) => {
  if (role === 'superadmin' || role === 'admin_cliente') return 'Area Manager';
  if (role === 'dipendente') return 'Operatore';
  return role || 'Utente';
};

const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (d.toDateString() === new Date().toDateString()) return 'Oggi';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

/* ─── Pannello Chat ─── */
function ChatPanel({ user, selectedStoreId, priority, onClose, anchorRef }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastTs, setLastTs] = useState(null);

  // Codice operatore (richiesto prima di inviare)
  const [opCode, setOpCode] = useState('');
  const [opName, setOpName] = useState('');
  const [opVerifying, setOpVerifying] = useState(false);
  const [opError, setOpError] = useState('');
  const [opVerified, setOpVerified] = useState(false);

  const bottomRef = useRef(null);
  const isAdmin = (user?.roles || []).some(r => ['superadmin', 'admin_cliente'].includes(r));

  const accentColor = priority === 'urgent' ? '#EF4444' : '#7B6FD0';
  const accentGrad  = priority === 'urgent'
    ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
    : 'linear-gradient(135deg,#7B6FD0,#4F46E5)';
  const title = priority === 'urgent' ? '🚨 Segnalazione Urgente' : '💬 Chat Area Manager';

  // Recupera messaggi
  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const params = { store_id: selectedStoreId, priority };
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
  }, [selectedStoreId, lastTs, priority]);

  useEffect(() => { fetchMessages(true); }, [selectedStoreId, priority]);

  useEffect(() => {
    const t = setInterval(() => fetchMessages(false), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    chat.markRead({ store_id: selectedStoreId, priority }).catch(() => {});
  }, []);

  // Verifica barcode operatore
  const verifyOperator = async () => {
    if (!opCode.trim()) { setOpError('Inserisci il codice operatore'); return; }
    setOpVerifying(true); setOpError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/employees/by-barcode', {
        params: { barcode: opCode.trim() },
        headers: { Authorization: `Bearer ${token}` },
      });
      const emp = res.data?.data;
      if (emp) {
        setOpName(`${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || opCode);
        setOpVerified(true);
      } else {
        setOpError('Codice non trovato. Riprova.');
      }
    } catch {
      setOpError('Codice non valido o non trovato.');
    } finally { setOpVerifying(false); }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await chat.sendMessage({
        message: text.trim(),
        store_id: selectedStoreId,
        priority,
        operator_code: opCode.trim(),
        operator_name: opName,
      });
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
    <div style={{
      position: 'fixed', top: 60, right: 16, zIndex: 1001,
      width: 340, height: 480, borderRadius: 16,
      background: 'var(--color-surface,#fff)',
      border: '1px solid var(--color-border,#e5e7eb)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'chatIn 0.2s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Header */}
      <div style={{ background: accentGrad, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>{title}</div>
          {opVerified && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>✓ {opName} · {selectedStoreId ? '' : 'Tutti i negozi'}</div>}
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontWeight: 900 }}>✕</button>
      </div>

      {/* Messaggi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-tertiary)' }}>
            <div style={{ fontSize: 32 }}>{priority === 'urgent' ? '🚨' : '💬'}</div>
            <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
              {isAdmin ? 'Nessun messaggio dal negozio' : priority === 'urgent' ? 'Segnala un problema all\'Area Manager' : 'Chatta con l\'Area Manager'}
            </div>
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '6px 0 3px' }}>{date}</div>
            {msgs.map(msg => {
              const isMe = msg.sender_user_id === user?.id;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 5 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: isMe ? accentColor : 'inherit' }}>
                      {isMe ? (opName || 'Tu') : (msg.sender_name || 'Operatore')}
                    </span>
                    {msg.store_name && (
                      <span style={{ padding: '1px 5px', borderRadius: 4, background: 'rgba(123,111,208,0.12)', color: '#7B6FD0', fontWeight: 700, fontSize: 9 }}>
                        🏪 {msg.store_name}
                      </span>
                    )}
                    <span style={{ opacity: 0.55 }}>· {roleLabel(msg.sender_role)}</span>
                    <span style={{ opacity: 0.45 }}>{fmtTime(msg.created_at)}</span>
                  </div>
                  <div style={{
                    maxWidth: '80%', padding: '8px 12px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? accentGrad : 'var(--color-bg,#f3f4f6)',
                    color: isMe ? '#fff' : 'var(--color-text)',
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

      {/* Inserimento codice operatore (solo non-admin e non ancora verificato) */}
      {!isAdmin && !opVerified && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', background: 'rgba(123,111,208,0.04)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7B6FD0', marginBottom: 6 }}>🔐 Identifica operatore</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={opCode}
              onChange={e => setOpCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyOperator()}
              placeholder="Scansiona o inserisci codice..."
              autoFocus
              style={{
                flex: 1, border: `1.5px solid ${opError ? '#ef4444' : 'var(--color-border)'}`,
                borderRadius: 9, padding: '7px 10px', fontSize: 12, outline: 'none',
                background: 'var(--color-bg)', color: 'var(--color-text)',
              }}
            />
            <button
              onClick={verifyOperator}
              disabled={opVerifying}
              style={{
                padding: '0 12px', borderRadius: 9, border: 'none',
                background: accentGrad, color: '#fff', fontWeight: 700,
                fontSize: 12, cursor: 'pointer', flexShrink: 0,
              }}
            >{opVerifying ? '…' : '✓'}</button>
          </div>
          {opError && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{opError}</div>}
        </div>
      )}

      {/* Input messaggio */}
      <form onSubmit={handleSend} style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          placeholder={!isAdmin && !opVerified ? 'Verifica prima il codice operatore ↑' : (priority === 'urgent' ? 'Descrivi il problema...' : 'Scrivi un messaggio...')}
          disabled={!isAdmin && !opVerified}
          style={{
            flex: 1, border: '1.5px solid var(--color-border)', borderRadius: 10,
            padding: '8px 12px', fontSize: 13, outline: 'none',
            background: (!isAdmin && !opVerified) ? 'var(--color-bg)' : 'var(--color-bg)',
            color: 'var(--color-text)', opacity: (!isAdmin && !opVerified) ? 0.5 : 1,
          }}
          onFocus={e => { if (isAdmin || opVerified) e.target.style.borderColor = accentColor; }}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <button
          type="submit" disabled={!text.trim() || sending || (!isAdmin && !opVerified)}
          style={{
            width: 38, height: 38, borderRadius: 10, border: 'none',
            background: (text.trim() && (isAdmin || opVerified)) ? accentGrad : 'var(--color-border)',
            color: '#fff', cursor: (text.trim() && (isAdmin || opVerified)) ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, transition: 'all 0.15s', flexShrink: 0,
          }}
        >{sending ? '…' : '➤'}</button>
      </form>
    </div>
  );
}

/* ─── Bottoni topbar esportati ─── */
export function ChatTopbarButtons({ user, selectedStoreId }) {
  const [openPanel, setOpenPanel] = useState(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadUrgent, setUnreadUrgent] = useState(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const [r1, r2] = await Promise.all([
          chat.getMessages({ store_id: selectedStoreId, priority: 'normal', limit: 1 }),
          chat.getMessages({ store_id: selectedStoreId, priority: 'urgent', limit: 1 }),
        ]);
        if (openPanel !== 'chat') setUnreadChat(r1.data?.unread_count ?? 0);
        if (openPanel !== 'urgent') setUnreadUrgent(r2.data?.unread_count ?? 0);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [selectedStoreId, openPanel]);

  const toggle = (panel) => setOpenPanel(o => o === panel ? null : panel);

  return (
    <>
      {openPanel && (
        <ChatPanel
          user={user}
          selectedStoreId={selectedStoreId}
          priority={openPanel}
          onClose={() => setOpenPanel(null)}
        />
      )}

      {/* Bottone URGENTE */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        {unreadUrgent > 0 && openPanel !== 'urgent' && (
          <span style={{
            position: 'absolute', top: -4, right: -4, zIndex: 2,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            width: 16, height: 16, fontSize: 9, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--color-surface)',
          }}>{unreadUrgent > 9 ? '9+' : unreadUrgent}</span>
        )}
        <button
          onClick={() => toggle('urgent')}
          title="Segnalazione Urgente"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: openPanel === 'urgent'
              ? 'linear-gradient(135deg,#b91c1c,#dc2626)'
              : unreadUrgent > 0 ? 'rgba(239,68,68,0.15)' : 'var(--color-bg)',
            border: `1.5px solid ${openPanel === 'urgent' || unreadUrgent > 0 ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, position: 'relative', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {openPanel === 'urgent' ? '✕' : '🚨'}
          {unreadUrgent > 0 && openPanel !== 'urgent' && (
            <span style={{ position: 'absolute', inset: -1, borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.5)', animation: 'ripple 1.5s ease-out infinite' }} />
          )}
        </button>
      </div>

      {/* Bottone CHAT */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        {unreadChat > 0 && openPanel !== 'chat' && (
          <span style={{
            position: 'absolute', top: -4, right: -4, zIndex: 2,
            background: '#7B6FD0', color: '#fff', borderRadius: '50%',
            width: 16, height: 16, fontSize: 9, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--color-surface)',
          }}>{unreadChat > 9 ? '9+' : unreadChat}</span>
        )}
        <button
          onClick={() => toggle('chat')}
          title="Chat Area Manager"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: openPanel === 'chat'
              ? 'linear-gradient(135deg,#5B50B0,#4F46E5)'
              : unreadChat > 0 ? 'rgba(123,111,208,0.15)' : 'var(--color-bg)',
            border: `1.5px solid ${openPanel === 'chat' || unreadChat > 0 ? 'rgba(123,111,208,0.4)' : 'var(--color-border)'}`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, position: 'relative', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {openPanel === 'chat' ? '✕' : '💬'}
        </button>
      </div>

      <style>{`
        @keyframes chatIn {
          from { transform: translateY(-8px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes ripple {
          0%  { transform: scale(1); opacity: 0.7; }
          100%{ transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </>
  );
}

/* ─── Default export (ora vuoto — i bottoni sono in topbar) ─── */
export default function ChatWidget() { return null; }
