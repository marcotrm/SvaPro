import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, stores, clearApiCache } from '../api.jsx';
import { prefetchRoute, eagerPrefetchAll } from '../routePrefetch.js';
import { useTranslation } from '../i18n/index.jsx';

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
      {
        label: 'Inventario Guidato', href: '/inventory/count',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 12a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM11 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zm2 2V5h1v1h-1zM11 12a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3zm2 2v-1h1v1h-1z" clipRule="evenodd"/></svg>,
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
        label: 'Alert Stock', href: '/orders/stock-alerts',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.591c.75 1.334-.213 2.99-1.743 2.99H3.482c-1.53 0-2.493-1.656-1.743-2.99L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>,
      },
      {
        label: 'Clienti', href: '/customers',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
      },
      {
        label: 'Fatture', href: '/invoices',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-.847.99l-1-.116-.86 1.148a1 1 0 01-1.586 0L11 14.874l-.707.942a1 1 0 01-1.586 0L8 14.874l-.707.942a1 1 0 01-1.586 0L4.847 14.69A1 1 0 014 14V4zm2 2a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>,
      },
      {
        label: 'Resi', href: '/returns',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/></svg>,
      },
      {
        label: 'POS Cassa', href: '/pos',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>,
      },
      {
        label: 'Spedizioni', href: '/shipping',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10V5H4zM13 5v9h-1V5h4l3 3v4h-1.05a2.5 2.5 0 00-4.9 0H13z"/></svg>,
      },
      {
        label: 'Promozioni', href: '/promotions',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm2 0a1 1 0 10-1-1v1h1z" clipRule="evenodd"/><path d="M9 11H3v5a2 2 0 002 2h4v-7zm2 7h4a2 2 0 002-2v-5h-6v7z"/></svg>,
      },
    ],
  },
  {
    label: 'Approvvigionamento',
    items: [
      {
        label: 'Fornitori', href: '/suppliers',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-2a1 1 0 00-.293-.707l-3-3A1 1 0 0016 3h-3a1 1 0 00-1 1v5H4V5a1 1 0 00-1-1z"/></svg>,
      },
      {
        label: 'Ordini Acquisto', href: '/purchase-orders',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
      },
      {
        label: 'Fatture Passive', href: '/supplier-invoices',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>,
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
      {
        label: 'Loyalty Tiers', href: '/loyalty/tiers',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>,
      },
      {
        label: 'Push Monitor', href: '/analytics/loyalty/push-monitor',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 00-4 4v1.268A2 2 0 005 9v5l-1 1v1h12v-1l-1-1V9a2 2 0 00-1-1.732V6a4 4 0 00-4-4zm2 5.1V6a2 2 0 10-4 0v1.1A2 2 0 007 9v5h6V9a2 2 0 00-1-1.9z"/></svg>,
      },
      {
        label: 'Report & Export', href: '/reports',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd"/></svg>,
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
      {
        label: 'KPI Dipendenti', href: '/employees/kpi',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,
      },
      {
        label: 'Registro Attività', href: '/audit-log',
        icon: <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>,
      },
    ],
  },
];

const pageTitles = {
  '/': 'Dashboard',
  '/catalog': 'Prodotti',
  '/orders': 'Ordini',
  '/orders/stock-alerts': 'Alert Stock',
  '/inventory': 'Magazzino',
  '/inventory/smart-reorder': 'Smart Reorder',
  '/customers': 'Clienti',
  '/employees': 'Dipendenti',
  '/analytics/loyalty': 'Loyalty Analytics',
  '/analytics/loyalty/push-monitor': 'Loyalty Push Monitor',
  '/control-tower': 'Control Tower',
  '/audit-log': 'Registro Attività',
  '/settings': 'Impostazioni',
  '/roles-permissions': 'Ruoli & Permessi',
  '/invoices': 'Fatture',
  '/reports': 'Report & Export',
  '/suppliers': 'Fornitori',
  '/purchase-orders': 'Ordini Acquisto',
  '/returns': 'Resi & Rimborsi',
  '/supplier-invoices': 'Fatture Passive',
  '/pos': 'POS Cassa',
  '/shipping': 'Spedizioni',
  '/promotions': 'Promozioni',
  '/loyalty/tiers': 'Loyalty Tiers',
  '/employees/kpi': 'KPI Dipendenti',
  '/inventory/count': 'Inventario Guidato',
};

const labelToI18nKey = {
  Principale: 'main',
  Vendite: 'sales',
  Analisi: 'analysis',
  Gestione: 'management',
  Dashboard: 'dashboard',
  Prodotti: 'products',
  Magazzino: 'warehouse',
  Ordini: 'orders',
  'Alert Stock': 'stock_alerts',
  Clienti: 'customers',
  Fatture: 'invoices',
  'Smart Reorder': 'smart_reorder',
  Loyalty: 'loyalty',
  'Push Monitor': 'push_monitor',
  'Report & Export': 'reports',
  Dipendenti: 'employees',
  'Registro Attività': 'audit_log',
  Resi: 'returns',
  'POS Cassa': 'pos',
  Fornitori: 'suppliers',
  'Ordini Acquisto': 'purchase_orders',
  'Fatture Passive': 'supplier_invoices',
  Approvvigionamento: 'procurement',
  Spedizioni: 'shipping',
  Promozioni: 'promotions',
  'Loyalty Tiers': 'loyalty_tiers',
  'KPI Dipendenti': 'employee_kpi',
  'Inventario Guidato': 'inventory_count',
};

export default function Layout({ user, setUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [tenantsList, setTenantsList] = useState([]);
  const [switchableUsers, setSwitchableUsers] = useState([]);
  const [switchUserId, setSwitchUserId] = useState('');
  const [switchingUser, setSwitchingUser] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [storesList, setStoresList] = useState([]);
  const [storesReady, setStoresReady] = useState(false);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);
  const [selectedTenantCode, setSelectedTenantCode] = useState(localStorage.getItem('tenantCode') || user?.tenant_code || 'DEMO');
  const [selectedStoreId, setSelectedStoreId] = useState(localStorage.getItem('selectedStoreId') || '');
  const isSuperAdmin = (user?.roles || []).includes('superadmin');

  const loadStores = async () => {
    try {
      const response = await stores.getStores();
      const list = response.data?.data || [];
      setStoresList(list);

      if (!list.length) {
        localStorage.removeItem('selectedStoreId');
        setSelectedStoreId('');
        return;
      }

      const current = localStorage.getItem('selectedStoreId');
      const isCurrentValid = current ? list.some((store) => String(store.id) === String(current)) : false;

      if (!isCurrentValid) {
        const mainStore = list.find((store) => store.is_main) || list[0];
        if (mainStore) {
          const nextId = String(mainStore.id);
          localStorage.setItem('selectedStoreId', nextId);
          setSelectedStoreId(nextId);
        }
      }
    } catch {
      setStoresList([]);
      localStorage.removeItem('selectedStoreId');
      setSelectedStoreId('');
    } finally {
      setStoresReady(true);
    }
  };

  const loadTenants = async () => {
    try {
      const response = await stores.getTenants();
      const list = response.data?.data || [];
      setTenantsList(list);
    } catch {
      setTenantsList([]);
    }
  };

  const loadSwitchableUsers = async (tenantCodeOverride = selectedTenantCode) => {
    if (!isSuperAdmin) {
      setSwitchableUsers([]);
      setSwitchUserId('');
      return;
    }

    try {
      const response = await auth.switchableUsers({ tenant_code: tenantCodeOverride });
      const list = response.data?.data || [];
      setSwitchableUsers(list);
      setSwitchUserId(list[0] ? String(list[0].id) : '');
    } catch {
      setSwitchableUsers([]);
      setSwitchUserId('');
    }
  };

  useEffect(() => {
    localStorage.setItem('tenantCode', selectedTenantCode);
    loadStores();
  }, [selectedTenantCode]);

  // Tenants & switchable users — lazy-load only when panel opens
  useEffect(() => {
    if (userPanelOpen && !tenantsLoaded) {
      setTenantsLoaded(true);
      loadTenants();
      if (isSuperAdmin) loadSwitchableUsers(selectedTenantCode);
    }
  }, [userPanelOpen]);

  useEffect(() => {
    eagerPrefetchAll();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!isSuperAdmin && user.tenant_code) {
      const currentTenant = selectedTenantCode;
      const userTenant = user.tenant_code;
      if (currentTenant !== userTenant) {
        setStoresReady(false);
        setSelectedTenantCode(userTenant);
        localStorage.setItem('tenantCode', userTenant);
        localStorage.removeItem('selectedStoreId');
        setSelectedStoreId('');
      }
    }
  }, [user, isSuperAdmin]);

  const selectedStore = useMemo(
    () => storesList.find((store) => String(store.id) === String(selectedStoreId)) || null,
    [storesList, selectedStoreId]
  );

  const handleStoreChange = (event) => {
    const nextValue = event.target.value;
    setSelectedStoreId(nextValue);

    if (nextValue) {
      localStorage.setItem('selectedStoreId', nextValue);
    } else {
      localStorage.removeItem('selectedStoreId');
    }
  };

  const handleTenantChange = (event) => {
    const nextTenantCode = event.target.value;
    setStoresReady(false);
    setSelectedTenantCode(nextTenantCode);
    localStorage.setItem('tenantCode', nextTenantCode);
    localStorage.removeItem('selectedStoreId');
    setSelectedStoreId('');
    clearApiCache();
    loadSwitchableUsers(nextTenantCode);
    setUserPanelOpen(false);
  };

  const handleSwitchAdmin = async () => {
    if (!switchUserId || switchingUser) {
      return;
    }

    setSwitchingUser(true);
    try {
      const response = await auth.impersonate(Number(switchUserId));
      clearApiCache();
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('tenantCode', response.data.user.tenant_code || 'DEMO');
      localStorage.removeItem('selectedStoreId');
      setUser(response.data.user);
      setUserPanelOpen(false);
      navigate('/');
    } finally {
      setSwitchingUser(false);
    }
  };

  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    clearApiCache();
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantCode');
    localStorage.removeItem('selectedStoreId');
    setUser(null);
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] || 'U').toUpperCase();

  const primaryRole = user?.roles?.[0] || 'operatore';

  const tenantCode = selectedTenantCode || localStorage.getItem('tenantCode') || 'DEMO';
  const pageTitle = t(labelToI18nKey[pageTitles[location.pathname] || 'Dashboard'] || (pageTitles[location.pathname] || 'Dashboard'));

  const trLabel = (label) => t(labelToI18nKey[label] || label);

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <a className="logo" href="/" onClick={e => { e.preventDefault(); navigate('/'); }}>
          <div className="logo-icon">
            <img src="/brand-mark.svg" alt="SvaPro" className="logo-mark" />
          </div>
          <div className="logo-text">Sva<span>Pro</span></div>
        </a>

        <nav className="nav">
          {navGroups.map(group => (
            <React.Fragment key={group.label}>
              <div className="nav-label">{trLabel(group.label)}</div>
              {group.items.map(item => {
                const isActive = item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                return (
                  <a
                    key={item.href}
                    className={`nav-item${isActive ? ' active' : ''}`}
                    href={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onClick={e => { e.preventDefault(); navigate(item.href); }}
                  >
                    {item.icon}
                    {trLabel(item.label)}
                    {item.badge && lowStockCount > 0 && (
                      <span className="nav-badge">{lowStockCount}</span>
                    )}
                  </a>
                );
              })}
            </React.Fragment>
          ))}

          {/* Superadmin-only section */}
          {isSuperAdmin && (
            <>
              <div className="nav-label">Superadmin</div>
              <a
                className={`nav-item${location.pathname === '/control-tower' ? ' active' : ''}`}
                href="/control-tower"
                onMouseEnter={() => prefetchRoute('/control-tower')}
                onClick={e => { e.preventDefault(); navigate('/control-tower'); }}
              >
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                Control Tower
              </a>
              <a
                className={`nav-item${location.pathname === '/roles-permissions' ? ' active' : ''}`}
                href="/roles-permissions"
                onMouseEnter={() => prefetchRoute('/roles-permissions')}
                onClick={e => { e.preventDefault(); navigate('/roles-permissions'); }}
              >
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Ruoli & Permessi
              </a>
              <a
                className={`nav-item${location.pathname === '/settings' ? ' active' : ''}`}
                href="/settings"
                onMouseEnter={() => prefetchRoute('/settings')}
                onClick={e => { e.preventDefault(); navigate('/settings'); }}
              >
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>
                Impostazioni
              </a>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {userPanelOpen && (
            <div className="user-panel">
              <div className="user-panel-title">Pannello Utente</div>
              <div className="user-panel-row">
                <span>Ruolo</span>
                <strong>{primaryRole}</strong>
              </div>
              <div className="user-panel-row">
                <span>Tenant</span>
                <strong>{tenantCode}</strong>
              </div>
              {isSuperAdmin && (
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label">Switch Tenant</label>
                  <select className="form-select" value={selectedTenantCode} onChange={handleTenantChange}>
                    {tenantsList.map((tenant) => (
                      <option key={tenant.id} value={tenant.code}>
                        {tenant.name} ({tenant.code})
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-gold"
                    style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                    onClick={() => {
                      setUserPanelOpen(false);
                      navigate('/');
                    }}
                  >
                    Entra nel tenant
                  </button>

                  <label className="form-label" style={{ marginTop: 10 }}>Switch Admin</label>
                  <select className="form-select" value={switchUserId} onChange={(event) => setSwitchUserId(event.target.value)}>
                    {switchableUsers.length === 0 ? (
                      <option value="">Nessun admin disponibile</option>
                    ) : (
                      switchableUsers.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} ({entry.tenant_code})
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    className="btn btn-ghost"
                    disabled={!switchUserId || switchingUser}
                    style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
                    onClick={handleSwitchAdmin}
                  >
                    {switchingUser ? 'Cambio account...' : 'Passa a questo admin'}
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="user-card" onClick={() => setUserPanelOpen((prev) => !prev)} style={{width: '100%', border: 'none', background: 'transparent', padding: 0}}>
            <div className="user-avatar">{initials}</div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div className="user-name">{user?.name || user?.email}</div>
              <div className="user-role">{primaryRole}</div>
            </div>
            <svg style={{ marginLeft: 'auto', opacity: .55 }} width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 8l4 4 4-4"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="page-title">{pageTitle}</div>

          <div className="session-chip" title="Contesto sessione">
            <span className="session-chip-label">Tenant</span>
            <strong>{tenantCode}</strong>
            <span className="session-chip-sep">•</span>
            <span className="session-chip-label">Store</span>
            <strong>{selectedStore?.name || 'Tutti'}</strong>
          </div>

          <div className="location-select">
            <div className="location-dot"></div>
            <select
              className="form-select"
              style={{ border: 'none', background: 'transparent', padding: 0, minWidth: 180 }}
              value={selectedStoreId}
              onChange={handleStoreChange}
            >
              {storesList.length === 0 ? (
                <option value="">{tenantCode}</option>
              ) : (
                <>
                  <option value="">Tutti gli store</option>
                  {storesList.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="topbar-actions">
            <button className="icon-btn" data-tip="Notifiche" onClick={() => navigate('/analytics/loyalty/push-monitor')}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
              </svg>
              {lowStockCount > 0 && <span className="dot"></span>}
            </button>
            <button className="icon-btn" data-tip="Logout" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="content">
          <Outlet context={{ setLowStockCount, user, setUser, storesList, selectedStoreId, selectedStore, storesReady }} />
        </div>
      </div>
    </div>
  );
}

