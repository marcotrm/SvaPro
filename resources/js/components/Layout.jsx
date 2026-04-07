import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import { prefetchRoute, eagerPrefetchAll } from '../routePrefetch.js';
import { 
  BarChart3, Package, Warehouse, ClipboardList, ShoppingBag,
  Users, Monitor, Truck, Settings, LogOut, Search, Bell,
  FileText, RotateCcw, Gift, Shield, Activity, ChevronDown,
  Receipt, Star, ArrowRightLeft, MapPin
} from 'lucide-react';

const allNavigation = [
  { section: 'Principale', items: [
    { label: 'POS Cassa', href: '/', icon: Monitor, roles: ['superadmin','admin_cliente','dipendente'] },
    { label: 'Dashboard', href: '/dashboard', icon: BarChart3, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Gestione', items: [
    { label: 'Prodotti', href: '/catalog', icon: Package, roles: ['superadmin','admin_cliente','dipendente'] },
    { label: 'Magazzino', href: '/inventory', icon: Warehouse, roles: ['superadmin','admin_cliente'] },
    { label: 'Inventario', href: '/inventory/count', icon: ClipboardList, roles: ['superadmin','admin_cliente'] },
    { label: 'Ordini', href: '/orders', icon: ShoppingBag, roles: ['superadmin','admin_cliente'] },
    { label: 'Clienti', href: '/customers', icon: Users, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Supply Chain', items: [
    { label: 'Fornitori', href: '/suppliers', icon: Truck, roles: ['superadmin','admin_cliente'] },
    { label: 'Ordini Acquisto', href: '/purchase-orders', icon: Receipt, roles: ['superadmin','admin_cliente'] },
    { label: 'Fatture Fornitori', href: '/supplier-invoices', icon: FileText, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Analisi', items: [
    { label: 'Report', href: '/reports', icon: Activity, roles: ['superadmin','admin_cliente'] },
    { label: 'Fatturazione', href: '/invoices', icon: FileText, roles: ['superadmin','admin_cliente'] },
    { label: 'Resi', href: '/returns', icon: RotateCcw, roles: ['superadmin','admin_cliente'] },
    { label: 'Promozioni', href: '/promotions', icon: Gift, roles: ['superadmin','admin_cliente'] },
  ]},
  { section: 'Amministrazione', items: [
    { label: 'Dipendenti', href: '/employees', icon: Users, roles: ['superadmin','admin_cliente'] },
    { label: 'Impostazioni', href: '/settings', icon: Settings, roles: ['superadmin','admin_cliente'] },
    { label: 'Ruoli & Permessi', href: '/roles-permissions', icon: Shield, roles: ['superadmin'] },
    { label: 'Audit Log', href: '/audit-log', icon: ClipboardList, roles: ['superadmin'] },
    { label: 'Control Tower', href: '/control-tower', icon: Activity, roles: ['superadmin'] },
  ]},
];

export default function Layout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [storesList, setStoresList] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(localStorage.getItem('selectedStoreId') || '');
  const [displayMode, setDisplayMode] = useState(localStorage.getItem('displayMode') || 'name');

  const userRoles = useMemo(() => user?.roles || [], [user]);

  useEffect(() => {
    eagerPrefetchAll();
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await stores.getStores();
      setStoresList(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load stores');
    }
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

  // Filter navigation by user roles
  const filteredNav = useMemo(() => {
    return allNavigation.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.roles.some(r => userRoles.includes(r))
      )
    })).filter(section => section.items.length > 0);
  }, [userRoles]);

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>

      {/* SIDEBAR */}
      <aside className="sp-sidebar">
        <div className="sp-sidebar-brand">
          <h1>Sva<span>Pro</span></h1>
          <div className="sp-brand-sub">Point of Sale System</div>
        </div>

        <nav className="sp-sidebar-nav">
          {filteredNav.map((section) => (
            <div key={section.section} className="sp-nav-section">
              <div className="sp-nav-section-title">{section.section}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className={`sp-nav-item ${isActive(item.href) ? 'active' : ''}`}
                  >
                    <Icon size={18} className="sp-nav-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sp-sidebar-footer">
          <div className="sp-user-card" onClick={handleLogout} title="Logout">
            <div className="sp-user-avatar">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="sp-user-info">
              <div className="sp-user-name">{user?.name || 'Utente'}</div>
              <div className="sp-user-role">{userRoles[0] || 'operator'}</div>
            </div>
            <LogOut size={16} style={{ color: '#666', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="sp-main">
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
    </div>
  );
}
