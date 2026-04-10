import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import { prefetchRoute, eagerPrefetchAll } from '../routePrefetch.js';
import { Toaster } from 'react-hot-toast';
import { 
  BarChart3, Package, Warehouse, ClipboardList, ShoppingBag,
  Users, Monitor, Truck, Settings, LogOut, Bell,
  FileText, RotateCcw, Gift, Shield, Activity, ChevronDown,
  Receipt, Star, ArrowRightLeft, MapPin, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Link, Fingerprint, Store
} from 'lucide-react';

const allNavigation = [
  { section: 'Principale', items: [
    { label: 'POS Cassa', href: '/', icon: Monitor, roles: ['superadmin','admin_cliente','dipendente'] },
    { label: 'Dashboard', href: '/dashboard', icon: BarChart3, roles: ['superadmin','admin_cliente'] },
    { label: '⏱ Timbra Entrata/Uscita', href: '/clock-in', icon: Fingerprint, roles: ['dipendente'] },
    { label: 'Prodotti', href: '/catalog', icon: Package, roles: ['dipendente'] },
  ]},
  { section: 'Gestione', items: [
    { label: 'Prodotti', href: '/catalog', icon: Package, roles: ['superadmin','admin_cliente'] },
    { label: 'Magazzino', href: '/inventory', icon: Warehouse, roles: ['superadmin','admin_cliente'] },
    { label: 'Inventario', href: '/inventory/count', icon: ClipboardList, roles: ['superadmin','admin_cliente'] },
    { label: 'Ordini', href: '/orders', icon: ShoppingBag, roles: ['superadmin','admin_cliente'] },
    { label: 'Clienti', href: '/customers', icon: Users, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Supply Chain', items: [
    { label: 'Fornitori', href: '/suppliers', icon: Truck, roles: ['superadmin','admin_cliente'] },
    { label: 'Ordini Acquisto (PO)', href: '/purchase-orders', icon: Receipt, roles: ['superadmin','admin_cliente'] },
    { label: '📦 DDT Fornitore', href: '/supplier-delivery', icon: Truck, roles: ['superadmin','admin_cliente'] },
    { label: 'Fatture Fornitori', href: '/supplier-invoices', icon: FileText, roles: ['superadmin','admin_cliente'] },
    { label: 'Trasferimenti DDT', href: '/stock-transfers', icon: ArrowRightLeft, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Analisi', items: [
    { label: 'Report', href: '/reports', icon: Activity, roles: ['superadmin','admin_cliente'] },
    { label: 'Fatturazione', href: '/invoices', icon: FileText, roles: ['superadmin','admin_cliente'] },
    { label: 'Resi', href: '/returns', icon: RotateCcw, roles: ['superadmin','admin_cliente'] },
    { label: 'Promozioni', href: '/promotions', icon: Gift, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Dipendenti', items: [
    { label: 'Gestione Dipendenti', href: '/employees', icon: Users, roles: ['superadmin','admin_cliente'] },
    { label: '🕐 Timbrature', href: '/attendance', icon: Fingerprint, roles: ['superadmin','admin_cliente'] },
    { label: '🏆 Gamification', href: '/gamification', icon: Activity, roles: ['superadmin','admin_cliente','dipendente'] },
  ]},
  { section: 'Amministrazione', items: [
    { label: 'Negozi',          href: '/stores',            icon: Store,    roles: ['superadmin','admin_cliente'] },
    { label: 'Impostazioni',    href: '/settings',          icon: Settings, roles: ['superadmin','admin_cliente'] },
    { label: 'Ruoli & Permessi',href: '/roles-permissions', icon: Shield,   roles: ['superadmin'] },
    { label: 'Audit Log',       href: '/audit-log',         icon: ClipboardList, roles: ['superadmin'] },
    { label: 'Control Tower',   href: '/control-tower',     icon: Activity, roles: ['superadmin'] },
  ]},
];

export default function Layout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [storesList, setStoresList] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(localStorage.getItem('selectedStoreId') || '');
  const [displayMode, setDisplayMode] = useState(localStorage.getItem('displayMode') || 'name');

  // Sidebar state
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [openSections, setOpenSections] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarOpenSections');
      return saved ? JSON.parse(saved) : { 'Principale': true, 'Gestione': true, 'Supply Chain': true, 'Analisi': true, 'Amministrazione': true };
    } catch { return { 'Principale': true, 'Gestione': true, 'Supply Chain': true, 'Analisi': true, 'Amministrazione': true }; }
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

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href; // exact match — evita doppia attivazione parent/child
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
            const isOpen = collapsed || openSections[section.section] !== false;
            return (
              <div key={section.section} className="sp-nav-section">
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
                    const active = isActive(item.href);
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
