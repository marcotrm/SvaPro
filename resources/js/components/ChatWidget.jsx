import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chat } from '../api.jsx';
import { useOutletContext } from 'react-router-dom';

const POLL_INTERVAL = 5000; // 5 secondi

const roleLabel = (role) => {
  if (role === 'superadmin' || role === 'admin_cliente') return '🏢 Area Manager';
  if (role === 'dipendente') return '👤 Dipendente';
  return role;
};

const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};

export default function ChatWidget() {
  const { user, selectedStoreId } = useOutletContext() || {};
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread]   = useState(0);
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const [lastTs, setLastTs]   = useState(null);
  const bottomRef = useRef(null);
  const pollRef   = useRef(null);

  const isAdmin = (user?.roles || []).some(r => ['superadmin', 'admin_cliente'].includes(r));

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const params = { store_id: selectedStoreId };
      if (!initial && lastTs) params.since = lastTs;
      const res = await chat.getMessages(params);
      const newMsgs = res.data?.data || [];
      const unreadCount = res.data?.unread_count ?? 0;

      if (initial) {
        setMessages(newMsgs);
      } else if (newMsgs.length > 0) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...newMsgs.filter(m => !ids.has(m.id))];
        });
      }
      if (newMsgs.length > 0) {
        setLastTs(newMsgs[newMsgs.length - 1].created_at);
      }
      setUnread(unreadCount);
    } catch {}
  }, [selectedStoreId, lastTs]);

  // Carica messaggi iniziali
  useEffect(() => {
    fetchMessages(true);
  }, [selectedStoreId]);

  // Polling ogni 5 secondi
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(false), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  // Scroll in fondo quando arrivano nuovi messaggi
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Segna come letti quando si apre la chat
  useEffect(() => {
    if (open && unread > 0) {
      chat.markRead({ store_id: selectedStoreId }).catch(() => {});
      setUnread(0);
    }
  }, [open]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await chat.sendMessage({ message: text.trim(), store_id: selectedStoreId });
      setText('');
      await fetchMessages(false);
    } catch {} finally { setSending(false); }
  };

  // Raggruppa per data
  const grouped = messages.reduce((acc, msg) => {
    const key = fmtDate(msg.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  return (
    <>
      {/* ── Bubble ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7B6FD0, #4F46E5)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(79,70,229,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="Chat live"
      >
        <span style={{ fontSize: 22 }}>{open ? '✕' : '💬'}</span>
        {unread > 0 && !open && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            width: 20, height: 20, fontSize: 11, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--color-bg, #fff)',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 1000,
          width: 360, height: 480, borderRadius: 20,
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e5e7eb)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1C1B2E, #2D2B4E)',
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 24 }}>💬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>Chat Interna</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {isAdmin ? 'Area Manager — tutti i negozi' : 'Dipendente → Area Manager'}
              </div>
            </div>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
              boxShadow: '0 0 6px #4ade80', animation: 'pulse 2s infinite',
            }} title="Live (polling 5s)" />
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {Object.entries(grouped).length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Nessun messaggio — scrivi il primo! 👋
              </div>
            )}
            {Object.entries(grouped).map(([date, msgs]) => (
              <React.Fragment key={date}>
                <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '8px 0 4px' }}>
                  {date}
                </div>
                {msgs.map(msg => {
                  const isMe = msg.sender_user_id === user?.id;
                  return (
                    <div key={msg.id} style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 8,
                    }}>
                      {!isMe && (
                        <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 2 }}>
                          {msg.sender_name} · {roleLabel(msg.sender_role)}
                        </div>
                      )}
                      <div style={{
                        maxWidth: '80%', padding: '8px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMe ? 'linear-gradient(135deg, #7B6FD0, #4F46E5)' : 'var(--color-bg, #f3f4f6)',
                        color: isMe ? '#fff' : 'var(--color-text)',
                        fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                      }}>
                        {msg.message}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                        {fmtTime(msg.created_at)}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{
            padding: '12px 16px', borderTop: '1px solid var(--color-border)',
            display: 'flex', gap: 8, background: 'var(--color-surface)',
          }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Scrivi un messaggio..."
              style={{
                flex: 1, border: '1.5px solid var(--color-border)', borderRadius: 10,
                padding: '8px 12px', fontSize: 13, outline: 'none',
                background: 'var(--color-bg)', color: 'var(--color-text)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#7B6FD0'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              style={{
                width: 38, height: 38, borderRadius: 10, border: 'none',
                background: text.trim() ? 'linear-gradient(135deg, #7B6FD0, #4F46E5)' : 'var(--color-border)',
                color: '#fff', cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              {sending ? '…' : '➤'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
