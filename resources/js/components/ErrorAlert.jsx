import React from 'react';

export default function ErrorAlert({ message, onRetry, onClose }) {
  return (
    <div className="banner banner-error">
      <svg className="banner-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div className="banner-text">
        <strong>Errore</strong>{message}
        {onRetry && (
          <button className="banner-action" onClick={onRetry} style={{display:'block',marginTop:4}}>Riprova</button>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted2)',padding:0,marginLeft:8,lineHeight:1}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}
