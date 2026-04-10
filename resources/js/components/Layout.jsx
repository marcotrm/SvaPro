import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import { prefetchRoute, eagerPrefetchAll } from '../routePrefetch.js';
import { Toaster } from 'react-hot-toast';
import ChatWidget from './ChatWidget.jsx';
import { 
  BarChart3, Package, Warehouse, ClipboardList, ShoppingBag,
  Users, Monitor, Truck, Settings, LogOut, Bell,
  FileText, RotateCcw, Gift, Shield, Activity, ChevronDown,
  Receipt, Star, ArrowRightLeft, MapPin, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Link, Fingerprint, Store, AlertCircle
} from 'lucide-react';

const allNavigation = [
  // ── Principale ───────────────────────────────────────────────────
  { section: 'Principale', items: [
    { label: 'POS Cassa',              href: '/',             icon: Monitor,     roles: ['superadmin','admin_cliente','dipendente'] },
    { label: 'Panoramica Generale',    href: '/dashboard',    icon: BarChart3,   roles: ['superadmin','admin_cliente'] },
    { label: 'Report & Analisi',       href: '/reports',      icon: Activity,    roles: ['superadmin','admin_cliente'] },
    { label: '⏱ Timbra Entrata/Uscita', href: '/clock-in',    icon: Fingerprint, roles: ['dipendente'] },
    { label: '📦 Carico Negozio',        href: '/store-loading', icon: Package,  roles: ['dipendente'] },
    { label: 'Clienti',                href: '/customers',    icon: Users,       roles: ['dipendente'] },
  ]},

  // 4. Magazzino ────────────────────────────────────────────────────
  { section: 'Magazzino', items: [
    { label: 'Giacenze & Stock',       href: '/inventory',    icon: Warehouse,   roles: ['superadmin','admin_cliente'] },
    { label: 'Prodotti',               href: '/catalog',      icon: Package,     roles: ['superadmin','admin_cliente'] },
    { label: 'Carico Merce (DDT)',     href: '/supplier-delivery', icon: Truck,  roles: ['superadmin','admin_cliente'] },
    { label: 'Resi',                   href: '/returns',      icon: RotateCcw,   roles: ['superadmin','admin_cliente'] },
    { label: 'Trasferimenti',          href: '/stock-transfers', icon: ArrowRightLeft, roles: ['superadmin','admin_cliente'] },
    { label: 'Inventario Guidato',     href: '/inventory/count', icon: ClipboardList, roles: ['superadmin','admin_cliente'] },
  ]},

  // 5. Acquisti / Fornitori ─────────────────────────────────────────
  { section: 'Acquisti / Fornitori', items: [
    { label: 'Ordini Fornitori (PO)',  href: '/purchase-orders',   icon: Receipt,  roles: ['superadmin','admin_cliente'] },
    { label: 'Ricezione Merce',        href: '/store-loading',     icon: Package,  roles: ['superadmin','admin_cliente'] },
    { label: 'Anagrafica Fornitori',   href: '/suppliers',         icon: Truck,    roles: ['superadmin','admin_cliente'] },
    { label: 'Fatture Fornitori',      href: '/supplier-invoices', icon: FileText, roles: ['superadmin','admin_cliente'] },
  ]},


  // 7. Marketing ────────────────────────────────────────────────────
  { section: 'Marketing', items: [
    { label: 'Promozioni & Bundle',    href: '/promotions',   icon: Gift,        roles: ['superadmin','admin_cliente'] },
    { label: '🏆 Gamification',         href: '/gamification', icon: Star,        roles: ['superadmin','admin_cliente','dipendente'] },
  ]},

  // 8. Dipendenti ───────────────────────────────────────────────────
  { section: 'Dipendenti', items: [
    { label: 'Anagrafica Dipendenti',  href: '/employees',    icon: Users,       roles: ['superadmin','admin_cliente'] },
    { label: 'Presenze & Timbrature',  href: '/attendance',   icon: Fingerprint, roles: ['superadmin','admin_cliente'] },
    { label: 'Kiosk Timbratura',       href: '/clock-in',     icon: Fingerprint, roles: ['superadmin','admin_cliente'] },
  ]},

  // Amministrazione ──────────────────────────────────────────────
  { section: 'Amministrazione', items: [
    { label: 'Dashboard Amm.',         href: '/admin-panel',  icon: BarChart3,   roles: ['superadmin','admin_cliente'] },
    { label: 'Anagrafica Clienti',     href: '/customers',    icon: Users,       roles: ['superadmin','admin_cliente'] },
    { label: 'Negozi & Punti Vendita', href: '/stores',       icon: Store,       roles: ['superadmin','admin_cliente'] },
    { label: 'Fatturazione',           href: '/invoices',     icon: FileText,    roles: ['superadmin','admin_cliente'] },
  ]},

  // 10. Impostazioni ────────────────────────────────────────────────
  { section: 'Impostazioni', items: [
    { label: 'Configurazione',         href: '/settings',          icon: Settings,      roles: ['superadmin','admin_cliente'] },
    { label: 'Ruoli & Permessi',       href: '/roles-permissions', icon: Shield,        roles: ['superadmin'] },
    { label: 'Audit Log',              href: '/audit-log',         icon: ClipboardList, roles: ['superadmin'] },
    { label: 'Control Tower',          href: '/control-tower',     icon: Activity,      roles: ['superadmin'] },
  ]},
];

export default function Layout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [storesList, setStoresList] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(localStorage.getItem('selectedStoreId') || '');
  const [displayMode, setDisplayMode] = useState(localStorage.getItem('displayMode') || 'name');

  // Flyout hover state
  const [flyout, setFlyout] = useState(null); // { section, items, top }
  const flyoutTimer = useRef(null);

  const cancelTimer = useCallback(() => {
    if (flyoutTimer.current) { clearTimeout(flyoutTimer.current); flyoutTimer.current = null; }
  }, []);

  const scheduleClose = useCallback(() => {
    flyoutTimer.current = setTimeout(() => setFlyout(null), 150);
  }, []);

  const handleSectionEnter = useCallback((section, items, e) => {
    cancelTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyout({ section, items, top: rect.top });
  }, [cancelTimer]);

  // Sidebar state
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarOpenSections');
      return saved ? JSON.parse(saved) : { 'Principale': true };
    } catch { return { 'Principale': true }; }
  });

  const userRoles = useMemo(() => user?.roles || [], [user]);

  useEffect(() => { eagerPrefetchAll(); loadStores(); }, []);

  const loadStores = async () => {
    try {
      const response = await stores.getStores();
      setStoresList(response.data?.data || []);
    } catch (err) { console.error('Failed to load stores'); }
  };

  const handleStoreChange = (id) => {
    setSelectedStoreId(id);
    localStorage.setItem('selectedStoreId', id);
    clearApiCache();
  };

  const toggleDisplayMode = () => {
    const next = displayMode === 'name' ? 'sku' : 'name';
    setDisplayMode(next);
    localStorage.setItem('displayMode', next);
  };

  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    localStorage.clear();
    setUser(null);
    navigate('/login');
  };

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  }, []);

  const toggleSection = useCallback((sectionName) => {
    if (collapsed) return; // no accordion when collapsed
    setOpenSections(prev => {
      const next = { ...prev, [sectionName]: !prev[sectionName] };
      localStorage.setItem('sidebarOpenSections', JSON.stringify(next));
      return next;
    });
  }, [collapsed]);

  // Filter navigation by user roles
  const filteredNav = useMemo(() => {
    return allNavigation.map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.some(r => userRoles.includes(r)))
    })).filter(section => section.items.length > 0);
  }, [userRoles]);

  const isActive = (href, activeKey) => {
    const key = activeKey ?? href;
    if (key === '/') return location.pathname === '/';
    return location.pathname === key;
  };

  // Auto-open section of active item
  useEffect(() => {
    for (const section of filteredNav) {
      if (section.items.some(item => isActive(item.href))) {
        setOpenSections(prev => {
          if (prev[section.section]) return prev;
          const next = { ...prev, [section.section]: true };
          localStorage.setItem('sidebarOpenSections', JSON.stringify(next));
          return next;
        });
      }
    }
  }, [location.pathname]);

  const activePageLabel = useMemo(() => {
    for (const section of allNavigation) {
      for (const item of section.items) {
        if (isActive(item.href)) return item.label;
      }
    }
    return 'SvaPro';
  }, [location.pathname]);

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return storesList.find(s => String(s.id) === String(selectedStoreId)) || null;
  }, [selectedStoreId, storesList]);

  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>

      {/* SIDEBAR */}
      <aside
        className={`sp-sidebar ${collapsed ? 'sp-sidebar-collapsed' : ''}`}
        style={{ width: sidebarWidth, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* Brand + Toggle */}
        <div className="sp-sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '20px 0' : '20px 16px 20px 20px' }}>
          {!collapsed && (
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>Sva<span style={{ color: 'var(--color-accent)' }}>Pro</span></h1>
              <div className="sp-brand-sub">Point of Sale System</div>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="sp-sidebar-toggle"
            title={collapsed ? 'Espandi sidebar' : 'Nascondi sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="sp-sidebar-nav" style={{ padding: collapsed ? '8px 0' : '12px 10px' }}>
          {filteredNav.map((section) => {
            const isOpen = collapsed || openSections[section.section] === true;
            return (
              <div
                key={section.section}
                className="sp-nav-section"
                onMouseEnter={(e) => handleSectionEnter(section.section, section.items, e)}
                onMouseLeave={scheduleClose}
              >
                {/* Section Header (accordion trigger) */}
                {!collapsed ? (
                  <button
                    className="sp-nav-section-header"
                    onClick={() => toggleSection(section.section)}
                    aria-expanded={isOpen}
                  >
                    <span className="sp-nav-section-title" style={{ marginBottom: 0, padding: 0 }}>
                      {section.section}
                    </span>
                    <ChevronDown
                      size={12}
                      className="sp-nav-section-chevron"
                      style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
                    />
                  </button>
                ) : (
                  <div className="sp-nav-section-divider" />
                )}

                {/* Items */}
                <div
                  className="sp-nav-section-items"
                  style={{
                    maxHeight: isOpen ? '500px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href, item.activeKey);
                    return (
                      <button
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className={`sp-nav-item ${active ? 'active' : ''} ${collapsed ? 'sp-nav-item-collapsed' : ''}`}
                        title={collapsed ? item.label : undefined}
                        style={collapsed ? { justifyContent: 'center', padding: '10px 0', width: '100%' } : {}}
                      >
                        <Icon size={18} className="sp-nav-icon" />
                        {!collapsed && <span>{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sp-sidebar-footer" style={{ padding: collapsed ? '12px 4px' : '16px' }}>
          <div
            className="sp-user-card"
            onClick={handleLogout}
            title={collapsed ? `${user?.name || 'Utente'} — Logout` : 'Logout'}
            style={collapsed ? { justifyContent: 'center', padding: '8px 0' } : {}}
          >
            <div className="sp-user-avatar" style={{ flexShrink: 0 }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <>
                <div className="sp-user-info">
                  <div className="sp-user-name">{user?.name || 'Utente'}</div>
                  <div className="sp-user-role">{userRoles[0] || 'operator'}</div>
                </div>
                <LogOut size={16} style={{ color: '#666', flexShrink: 0 }} />
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── FLYOUT HOVER SUBMENU ── */}
      {flyout && (
        <div
          onMouseEnter={cancelTimer}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed',
            left: sidebarWidth,
            top: Math.max(8, Math.min(flyout.top, window.innerHeight - (flyout.items.length * 48 + 60))),
            zIndex: 9999,
            minWidth: 220,
            background: '#1C1B2E',
            borderRadius: '0 12px 12px 0',
            boxShadow: '4px 4px 24px rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderLeft: 'none',
            overflow: 'hidden',
            animation: 'flyoutIn 0.15s ease',
          }}
        >
          {/* Intestazione sezione */}
          <div style={{
            padding: '10px 16px 8px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.35)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {flyout.section}
          </div>

          {/* Voci */}
          {flyout.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.activeKey);
            return (
              <button
                key={item.activeKey ?? item.href}
                onClick={() => { navigate(item.href); setFlyout(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '11px 16px',
                  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? '#a5b4fc' : 'rgba(255,255,255,0.75)',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  textAlign: 'left',
                  transition: 'background 0.12s',
                  borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* MAIN */}
      <main
        className="sp-main"
        style={{ marginLeft: sidebarWidth, transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}
      >
        <header className="sp-topbar">
          <div className="sp-topbar-title">{activePageLabel}</div>
          <div className="sp-topbar-actions">
            {storesList.length > 1 && (
              <select 
                className="sp-select" 
                style={{ width: 200 }}
                value={selectedStoreId} 
                onChange={(e) => handleStoreChange(e.target.value)}
              >
                <option value="">Tutti i negozi</option>
                {storesList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <button className="sp-btn sp-btn-ghost sp-btn-icon" title="Notifiche">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <section className="sp-content sp-animate-in">
          <Outlet context={{ 
            user, setUser, 
            storesList, selectedStoreId, selectedStore,
            handleStoreChange, displayMode, toggleDisplayMode,
            setLowStockCount: () => {} 
          }} />
        </section>
      </main>

      <ChatWidget />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1C1B2E', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 600 },
          success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
    </div>
  );
}
