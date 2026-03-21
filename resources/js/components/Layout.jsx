import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../api.jsx';

const navGroups = [
  {
    label: 'Principale',
    items: [
      {
        label: 'Dashboard', href: '/',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11l8-8 8 8v7a1 1 0 01-1 1h-5v-4H6v4H3a1 1 0 01-1-1v-7z"/></svg>,
      },
      {
        label: 'Prodotti', href: '/catalog',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" clipRule="evenodd"/></svg>,
      },
      {
        label: 'Magazzino', href: '/inventory', badge: true,
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
      },
    ],
  },
  {
    label: 'Vendite',
    items: [
      {
        label: 'Ordini', href: '/orders',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zm14 15a2 2 0 11-4 0 2 2 0 014 0zM5 17a2 2 0 110-4 2 2 0 010 4z"/></svg>,
      },
      {
        label: 'Clienti', href: '/customers',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
      },
    ],
  },
  {
    label: 'Analisi',
    items: [
      {
        label: 'Smart Reorder', href: '/inventory/smart-reorder',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,
      },
      {
        label: 'Loyalty', href: '/analytics/loyalty',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/></svg>,
      },
    ],
  },
  {
    label: 'Gestione',
    items: [
      {
        label: 'Dipendenti', href: '/employees',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>,
      },
    ],
  },
];

const pageTitles = {
  '/': 'Dashboard',
  '/catalog': 'Prodotti',
  '/orders': 'Ordini',
  '/inventory': 'Magazzino',
  '/inventory/smart-reorder': 'Smart Reorder',
  '/customers': 'Clienti',
  '/employees': 'Dipendenti',
  '/analytics/loyalty': 'Loyalty Analytics',
};

export default function Layout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [lowStockCount, setLowStockCount] = useState(0);

  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantCode');
    setUser(null);
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase();

  const tenantCode = localStorage.getItem('tenantCode') || 'DEMO';
  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <a className="logo" href="/" onClick={e => { e.preventDefault(); navigate('/'); }}>
          <div className="logo-icon">S</div>
          <div className="logo-text">Sva<span>Pro</span></div>
        </a>

        <nav className="nav">
          {navGroups.map(group => (
            <React.Fragment key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(item => {
                const isActive = item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                return (
                  <a
                    key={item.href}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    href={item.href}
                    onClick={e => { e.preventDefault(); navigate(item.href); }}
                  >
                    {item.icon}
                    {item.label}
                    {item.badge && lowStockCount > 0 && (
                      <span className="nav-badge">{lowStockCount}</span>
                    )}
                  </a>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{user?.name || user?.email}</div>
              <div className="user-role">{user?.role || 'Operatore'}</div>
            </div>
            <svg style={{ marginLeft: 'auto', opacity: .4 }} width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"/>
            </svg>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="page-title">{pageTitle}</div>

          <div className="location-select">
            <div className="location-dot"></div>
            <span>{tenantCode}</span>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: .5 }}>
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </div>

          <div className="topbar-actions">
            <div className="icon-btn" data-tip="Notifiche">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
              </svg>
              {lowStockCount > 0 && <span className="dot"></span>}
            </div>
            <button className="icon-btn" data-tip="Logout" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="content">
          <Outlet context={{ setLowStockCount }} />
        </div>
      </div>
    </div>
  );
}

