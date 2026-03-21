import React from 'react';

export default function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 300 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border2)',
          borderTopColor: 'var(--gold)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto',
        }}></div>
        <p style={{ marginTop: 14, color: 'var(--muted)', fontSize: 13, fontFamily: "'Sora', sans-serif" }}>
          Caricamento…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

