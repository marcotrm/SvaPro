import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#0a1628', fontFamily: "'Sora', sans-serif",
      }}>
        <div style={{
          background: '#0f1d32', border: '1px solid #1e3050', borderRadius: 12,
          padding: '48px 40px', maxWidth: 440, textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
            background: 'rgba(230,76,60,.12)', border: '1px solid rgba(230,76,60,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#e64c3c',
          }}>!</div>
          <h2 style={{ color: '#e8ecf4', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
            Qualcosa è andato storto
          </h2>
          <p style={{ color: '#7b8ba5', fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
            Si è verificato un errore imprevisto. Puoi riprovare o ricaricare la pagina.
          </p>
          {this.state.error && (
            <pre style={{
              background: '#080d18', border: '1px solid #1e3050', borderRadius: 6,
              padding: '10px 14px', fontSize: 11, color: '#e64c3c', textAlign: 'left',
              overflow: 'auto', maxHeight: 100, marginBottom: 20,
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                background: 'transparent', border: '1px solid #2a3f5f', borderRadius: 8,
                padding: '10px 20px', color: '#e8ecf4', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Sora', sans-serif",
              }}
            >
              Riprova
            </button>
            <button
              onClick={this.handleReload}
              style={{
                background: 'linear-gradient(135deg, #c9a227, #b8931e)', border: 'none',
                borderRadius: 8, padding: '10px 20px', color: '#0a1628',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              Ricarica Pagina
            </button>
          </div>
        </div>
      </div>
    );
  }
}
