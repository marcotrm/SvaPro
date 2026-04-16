import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * ConfirmModal — modale di conferma per azioni distruttive (eliminazione, ecc.)
 *
 * Props:
 *   isOpen      {boolean}   — mostra/nasconde il modale
 *   title       {string}    — titolo del modale
 *   message     {string}    — messaggio descrittivo (supporta JSX)
 *   confirmLabel{string}    — testo del tasto conferma (default: "Elimina")
 *   onConfirm   {function}  — callback al click di Conferma
 *   onCancel    {function}  — callback al click di Annulla / X / overlay
 *   loading     {boolean}   — disabilita i tasti e mostra stato pending
 *   destructive {boolean}   — usa colori rossi per il tasto conferma (default: true)
 */
export default function ConfirmModal({
  isOpen,
  title       = 'Conferma eliminazione',
  message     = 'Questa azione è irreversibile. Sei sicuro di voler procedere?',
  confirmLabel = 'Elimina',
  onConfirm,
  onCancel,
  loading     = false,
  destructive = true,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel?.(); }}
    >
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 20,
        padding: '28px 28px 24px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        border: `1px solid ${destructive ? 'rgba(239,68,68,0.2)' : 'var(--color-border)'}`,
        animation: 'confirmModalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: destructive ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {destructive
              ? <Trash2 size={20} color="#ef4444" />
              : <AlertTriangle size={20} color="#6366f1" />
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--color-text)', lineHeight: 1.2 }}>
              {title}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning note */}
        {destructive && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
            fontSize: 12, color: '#b91c1c', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            Questa azione non può essere annullata.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 22px', borderRadius: 12, border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 22px', borderRadius: 12, border: 'none',
              background: destructive
                ? (loading ? '#ef4444aa' : 'linear-gradient(135deg, #ef4444, #dc2626)')
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: destructive ? '0 4px 12px rgba(239,68,68,0.35)' : '0 4px 12px rgba(99,102,241,0.35)',
              transition: 'all 0.15s', opacity: loading ? 0.8 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {loading ? (
              <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Eliminazione...</>
            ) : (
              <><Trash2 size={14} />{confirmLabel}</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirmModalIn {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}
