import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chat } from '../api.jsx';
import { useOutletContext } from 'react-router-dom';

const POLL_INTERVAL = 5000;

const roleLabel = (role) => {
  if (role === 'superadmin' || role === 'admin_cliente') return 'Area Manager';
  if (role === 'dipendente') return 'Dipendente';
  return role;
};

const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (d.toDateString() === new Date().toDateString()) return 'Oggi';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

/* ─── Pannello Chat ─── */
function ChatPanel({ user, selectedStoreId, priority, onClose }) {
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [lastTs, setLastTs] = useState(null);
  const bottomRef = useRef(null);

  const isAdmin = (user?.roles || []).some(r => ['superadmin', 'admin_cliente'].includes(r));
  const title = priority === 'urgent' ? '🚨 Segnalazione Urgente' : '💬 Chat Area Manager';
  const subtitle = isAdmin ? 'Vista manager — tutti i negozi' : (priority === 'urgent' ? 'Segnala un problema urgente' : 'Chatta con l\'Area Manager');

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
      setUnread(res.data?.unread_count ?? 0);
    } catch {}
  }, [selectedStoreId, lastTs, priority]);

  useEffect(() => { fetchMessages(true); }, [selectedStoreId]);

  useEffect(() => {
    const t = setInterval(() => fetchMessages(false), POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    chat.markRead({ store_id: selectedStoreId, priority }).catch(() => {});
    setUnread(0);
  }, []);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await chat.sendMessage({ message: text.trim(), store_id: selectedStoreId, priority });
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

  const accentColor = priority === 'urgent' ? '#EF4444' : '#7B6FD0';
  const accentGrad  = priority === 'urgent'
    ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
    : 'linear-gradient(135deg,#7B6FD0,#4F46E5)';

  return (
    <div style={{
      width: 340, height: 460, borderRadius: 20,
      background: 'var(--color-surface,#fff)',
      border: '1px solid var(--color-border,#e5e7eb)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ background: accentGrad, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'spBadgePulse 2s ease-out infinite' }} />
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontWeight: 900 }}
          >✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--color-text-tertiary)' }}>
            <div style={{ fontSize: 36 }}>{priority === 'urgent' ? '🚨' : '💬'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              {priority === 'urgent' ? 'Segnala un problema urgente\nall\'Area Manager' : 'Chatta con l\'Area Manager\nIl tuo messaggio arriverà subito'}
            </div>
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '8px 0 4px' }}>
              {date}
            </div>
            {msgs.map(msg => {
              const isMe = msg.sender_user_id === user?.id;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                  {!isMe && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 700, marginBottom: 2 }}>
                      {msg.sender_name} · {roleLabel(msg.sender_role)}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '8px 12px',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isMe ? accentGrad : 'var(--color-bg,#f3f4f6)',
                    color: isMe ? '#fff' : 'var(--color-text)',
                    fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                  }}>
                    {msg.message}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{fmtTime(msg.created_at)}</div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          placeholder={priority === 'urgent' ? 'Descrivi il problema...' : 'Scrivi un messaggio...'}
          style={{
            flex: 1, border: '1.5px solid var(--color-border)', borderRadius: 10,
            padding: '8px 12px', fontSize: 13, outline: 'none',
            background: 'var(--color-bg)', color: 'var(--color-text)',
          }}
          onFocus={e => e.target.style.borderColor = accentColor}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <button
          type="submit" disabled={!text.trim() || sending}
          style={{
            width: 38, height: 38, borderRadius: 10, border: 'none',
            background: text.trim() ? accentGrad : 'var(--color-border)',
            color: '#fff', cursor: text.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, transition: 'all 0.15s', flexShrink: 0,
          }}
        >{sending ? '…' : '➤'}</button>
      </form>
    </div>
  );
}

/* ─── ChatWidget con due pallini ─── */
export default function ChatWidget() {
  const { user, selectedStoreId } = useOutletContext() || {};
  const [openPanel, setOpenPanel] = useState(null); // null | 'chat' | 'urgent'
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadUrgent, setUnreadUrgent] = useState(0);

  // Poll unread counts ogni 8s (anche a widget chiuso)
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
      {/* ── Pannello chat ── */}
      {openPanel && (
        <div style={{
          position: 'fixed', bottom: 100, right: 28, zIndex: 1001,
          animation: 'chatIn 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <ChatPanel
            user={user}
            selectedStoreId={selectedStoreId}
            priority={openPanel === 'urgent' ? 'urgent' : 'normal'}
            onClose={() => setOpenPanel(null)}
          />
        </div>
      )}

      {/* ── Due pallini ── */}
      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Pallino URGENTE */}
        <div style={{ position: 'relative' }}>
          {unreadUrgent > 0 && openPanel !== 'urgent' && (
            <span style={{
              position: 'absolute', top: -4, right: -4, zIndex: 2,
              background: '#ef4444', color: '#fff', borderRadius: '50%',
              width: 18, height: 18, fontSize: 10, fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff', animation: 'spBadgePulse 1s ease-out infinite',
            }}>{unreadUrgent > 9 ? '9+' : unreadUrgent}</span>
          )}
          <button
            onClick={() => toggle('urgent')}
            title="Segnalazione Urgente"
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: openPanel === 'urgent'
                ? 'linear-gradient(135deg,#b91c1c,#dc2626)'
                : 'linear-gradient(135deg,#EF4444,#dc2626)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 20px rgba(239,68,68,${openPanel === 'urgent' ? 0.6 : 0.35})`,
              transition: 'all 0.2s', fontSize: 22,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {openPanel === 'urgent' ? '✕' : '🚨'}
            {openPanel !== 'urgent' && (
              <span style={{ position: 'absolute', width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.4)', animation: 'ripple 2s ease-out infinite' }} />
            )}
          </button>
        </div>

        {/* Pallino CHAT */}
        <div style={{ position: 'relative' }}>
          {unreadChat > 0 && openPanel !== 'chat' && (
            <span style={{
              position: 'absolute', top: -4, right: -4, zIndex: 2,
              background: '#7B6FD0', color: '#fff', borderRadius: '50%',
              width: 18, height: 18, fontSize: 10, fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>{unreadChat > 9 ? '9+' : unreadChat}</span>
          )}
          <button
            onClick={() => toggle('chat')}
            title="Chat Area Manager"
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: openPanel === 'chat'
                ? 'linear-gradient(135deg,#5B50B0,#4F46E5)'
                : 'linear-gradient(135deg,#7B6FD0,#4F46E5)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px rgba(79,70,229,${openPanel === 'chat' ? 0.6 : 0.4})`,
              transition: 'all 0.2s', fontSize: 24,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {openPanel === 'chat' ? '✕' : '💬'}
            {openPanel !== 'chat' && (
              <span style={{ position: 'absolute', width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(123,111,208,0.4)', animation: 'ripple 2.5s ease-out infinite' }} />
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes chatIn {
          from { transform: translateY(12px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes ripple {
          0%  { transform: scale(1); opacity: 0.7; }
          100%{ transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </>
  );
}
