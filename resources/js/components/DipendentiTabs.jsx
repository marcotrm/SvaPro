import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Fingerprint, Monitor } from 'lucide-react';

const TABS = [
  { href: '/employees',  label: 'Anagrafica',          icon: Users,        match: '/employees' },
  { href: '/attendance', label: 'Presenze & Timbrature', icon: Fingerprint,  match: '/attendance' },
  { href: '/clock-in',   label: 'Kiosk Timbratura',    icon: Monitor,      match: '/clock-in', newTab: true },
];

/**
 * Sub-tab bar condivisa tra EmployeesPage, AttendancePage, ClockInPage.
 * Mostra le 3 voci Dipendenti come tabs orizzontali nella parte alta della pagina.
 */
export default function DipendentiTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      marginBottom: 24,
      background: 'var(--color-surface)',
      borderRadius: 14,
      padding: 4,
      border: '1px solid var(--color-border)',
      width: 'fit-content',
    }}>
      {TABS.map(tab => {
        const isActive = location.pathname === tab.match || location.pathname.startsWith(tab.match + '/');
        const Icon = tab.icon;
        return (
          <button
            key={tab.href}
            onClick={() => {
              if (tab.newTab) {
                window.open(tab.href, '_blank');
              } else {
                navigate(tab.href);
              }
            }}
            title={tab.newTab ? 'Apre in una nuova scheda (vista kiosk)' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              transition: 'all 0.15s',
              background: isActive
                ? 'linear-gradient(135deg, var(--color-accent), #6d5fd5)'
                : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
              boxShadow: isActive ? '0 2px 8px rgba(123,111,208,0.35)' : 'none',
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--color-bg)';
                e.currentTarget.style.color = 'var(--color-text)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            <Icon size={14} />
            {tab.label}
            {tab.newTab && (
              <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>↗</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
