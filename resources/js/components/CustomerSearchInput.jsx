import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, Building2 } from 'lucide-react';
import { customers as customersApi } from '../api.jsx';

/**
 * Input con autocomplete per ricerca cliente in tempo reale.
 * Props:
 *  - onSelect(customer) — chiamato quando l'utente sceglie un cliente
 *  - placeholder — testo del placeholder
 *  - value — eventuale valore pre-impostato (nome del cliente)
 *  - className — classi aggiuntive
 */
export default function CustomerSearchInput({ onSelect, placeholder = 'Cerca cliente (nome, telefono, email)...', value = '', className = '' }) {
  const [query, setQuery]         = useState(value);
  const [results, setResults]     = useState([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const debounceRef               = useRef(null);
  const containerRef              = useRef(null);

  // Chiudi dropdown al click esterno
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await customersApi.getCustomers({ q, limit: 8 });
      const list = res.data?.data || [];
      setResults(list);
      setOpen(list.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  const handleSelect = (customer) => {
    const displayName = customer.customer_type === 'azienda'
      ? customer.company_name
      : `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    setQuery(displayName);
    setOpen(false);
    setResults([]);
    onSelect(customer);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(null);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }} className={className}>
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}
        />
        <input
          className="sp-input"
          style={{ paddingLeft: 36, paddingRight: query ? 32 : 12 }}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          autoComplete="off"
        />
        {loading && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)', borderRadius: '50%' }} className="sp-spin" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          {results.map((c) => {
            const isAzienda = c.customer_type === 'azienda';
            const name = isAzienda
              ? c.company_name
              : `${c.first_name || ''} ${c.last_name || ''}`.trim();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: isAzienda ? '#E0E7FF' : '#F0FDF4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isAzienda
                    ? <Building2 size={16} color="#6366F1" />
                    : <User size={16} color="#22C55E" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    {c.email || c.phone || c.code || ''}
                  </div>
                </div>
                {c.card_code && (
                  <span style={{ fontSize: 10, fontFamily: 'monospace', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-secondary)' }}>
                    {c.card_code}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
