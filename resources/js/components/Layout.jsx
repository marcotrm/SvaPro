import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, stores, clearApiCache, cashMovements as cashApi, reports, exports_, employees as employeesApi } from '../api.jsx';
import { prefetchRoute, eagerPrefetchAll } from '../routePrefetch.js';
import { Toaster } from 'react-hot-toast';
import ChatWidget, { ChatTopbarButtons } from './ChatWidget.jsx';
import StoreStatsDrawer from './StoreStatsDrawer.jsx';
import MichelePanelModal from './MichelePanelModal.jsx';
import { 
  BarChart3, Package, Warehouse, ClipboardList, ShoppingBag,
  Users, Monitor, Truck, Settings, LogOut, Bell,
  FileText, RotateCcw, Gift, Shield, Activity, ChevronDown,
  Receipt, Star, ArrowRightLeft, MapPin, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Link, Fingerprint, Store, AlertCircle,
  LayoutDashboard, ShoppingCart, Megaphone, HandCoins,
  Menu, X, Home, ChevronRight as ChevRight, Calendar, FileSpreadsheet, Zap,
  RefreshCw
} from 'lucide-react';


const allNavigation = [
  // Ã¢â€â‚¬Ã¢â€â‚¬ Principale Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Principale', icon: LayoutDashboard, items: [
    { label: 'POS Cassa',              href: '/',               icon: Monitor,     roles: ['superadmin','admin_cliente','store_manager','dipendente'] },
    { label: 'Report & Analisi',       href: '/reports',        icon: Activity,    roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Fatturato Negozi',       href: '/store-revenue',  icon: BarChart3,   roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Bolle in Arrivo',       href: '/warehouse/delivery-notes', icon: Truck, roles: ['dipendente'] },
    { label: 'Clienti',                href: '/customers',      icon: Users,       roles: ['dipendente'] },
  ]},

  // 4. Magazzino Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Magazzino', icon: Warehouse, items: [
    { label: 'Giacenze & Stock',       href: '/inventory',            icon: Warehouse,      roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Giacenze Locali',        href: '/warehouse/cross-store', icon: MapPin,         roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Prodotti',               href: '/catalog',              icon: Package,        roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Carico Merce (DDT)',     href: '/supplier-delivery',    icon: Truck,          roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Resi',                   href: '/returns',              icon: RotateCcw,      roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Trasferimenti',          href: '/stock-transfers',      icon: ArrowRightLeft, roles: ['superadmin','admin_cliente','store_manager'] },


    { label: 'Ordini Riassortimento', href: '/warehouse/restock',          icon: ClipboardList,  roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Bolle di Scarico',      href: '/warehouse/delivery-notes',   icon: Truck,          roles: ['superadmin','admin_cliente','store_manager','dipendente'] },
    { label: 'Consegne Negozi',       href: '/warehouse/store-deliveries', icon: MapPin,         roles: ['superadmin','admin_cliente','store_manager'] },
  ]},

  // 5. Acquisti / Fornitori Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Acquisti / Fornitori', icon: ShoppingCart, items: [
    { label: 'Ordini Fornitori (PO)',  href: '/purchase-orders',   icon: Receipt,  roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Ricezione Merce',        href: '/store-loading',     icon: Package,  roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Anagrafica Fornitori',   href: '/suppliers',         icon: Truck,    roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Fatture Fornitori',      href: '/supplier-invoices', icon: FileText, roles: ['superadmin','admin_cliente','store_manager'] },
  ]},


  // 7. Marketing Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Marketing', icon: Megaphone, items: [
    { label: 'Promozioni & Bundle',    href: '/promotions',   icon: Gift,        roles: ['superadmin','admin_cliente','store_manager'] },
  ]},

  // 8. Dipendenti Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Dipendenti', icon: Users, items: [
    { label: 'Anagrafica Dipendenti',  href: '/employees',    icon: Users,       roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Presenze & Timbrature',  href: '/attendance',   icon: Fingerprint, roles: ['superadmin'] },
    { label: 'Kiosk Timbratura',       href: '/clock-in',     icon: Fingerprint, roles: ['superadmin'] },
    { label: 'Timbra Entrata/Uscita',  href: '/clock-in',     icon: Fingerprint, roles: ['dipendente'] },
    { label: 'Pianificazione Turni',   href: '/shifts',       icon: Calendar,    roles: ['superadmin','admin_cliente','store_manager','dipendente'] },
    { label: 'Gamification',         href: '/gamification', icon: Star,        roles: ['superadmin','admin_cliente','store_manager','dipendente'] },
  ]},

  // Amministrazione Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Amministrazione', icon: Shield, items: [
    { label: 'Tesoreria & Cassa',      href: '/tesoreria',    icon: HandCoins,        roles: ['superadmin','admin_cliente','store_manager','dipendente'] },
    { label: 'Dashboard Amm.',         href: '/admin-panel',  icon: BarChart3,        roles: ['superadmin'] },
    { label: 'Dashboard QScare',       href: '/qscare-dashboard', icon: Shield,       roles: ['superadmin','admin_cliente','store_manager'] },
    { label: 'Anagrafica Clienti',     href: '/customers',    icon: Users,            roles: ['superadmin'] },
    { label: 'Negozi & Punti Vendita', href: '/stores',       icon: Store,            roles: ['superadmin'] },
    { label: 'Fatturazione',           href: '/invoices',     icon: FileText,         roles: ['superadmin'] },
  ]},


  // ADM Ã¢â‚¬â€ Sezione separata Reportistica Fiscale PLI Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'ADM', icon: FileSpreadsheet, items: [
    { label: 'Report Fiscali PLI',     href: '/adm',          icon: FileSpreadsheet,  roles: ['superadmin','admin_cliente','store_manager'] },
  ]},

  // Automazioni Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Automazioni', icon: Zap, items: [
    { label: 'Automazioni',           href: '/automazioni',  icon: Zap,             roles: ['superadmin','admin_cliente','store_manager'] },
  ]},

  // 10. Impostazioni Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  { section: 'Impostazioni', icon: Settings, items: [
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

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // Close drawer on route change
  useEffect(() => { setMobileDrawerOpen(false); }, [location.pathname]);
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [mobileDrawerOpen]);

  const userRoles = useMemo(() => user?.roles || [], [user]);

  useEffect(() => { eagerPrefetchAll(); loadStores(); }, []);

  const loadStores = async () => {
    try {
      const response = await stores.getStores();
      let slist = response.data?.data || [];
      // Se ÃƒÂ¨ un dipendente e ha un negozio assegnato, mostra solo quello
      if (user?.roles?.includes('dipendente') && user?.employee_store_id) {
        slist = slist.filter(s => String(s.id) === String(user.employee_store_id));
        if (slist.length > 0 && String(selectedStoreId) !== String(user.employee_store_id)) {
          setSelectedStoreId(user.employee_store_id);
          localStorage.setItem('selectedStoreId', user.employee_store_id);
        }
      }
      setStoresList(slist);
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

  // Conta prodotti sotto soglia dai dati caricati (placeholder per ora)
  const [lowStockCount, setLowStockCount] = React.useState(0);
  const [showStoreStats, setShowStoreStats] = React.useState(false);

  // â”€â”€â”€ Notifiche cassa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const CASH_THRESHOLD = 1000;
  const SNOOZE_MS = 3 * 60 * 60 * 1000; // 3 ore
  const SNOOZE_KEY = 'svapro_notif_snooze_v1';

  const [cashAlertStores, setCashAlertStores] = React.useState([]);
  const [showNotifPanel, setShowNotifPanel]   = React.useState(false);
  const [unreadAlerts,   setUnreadAlerts]     = React.useState(0);
  const [showMichelePanel, setShowMichelePanel] = React.useState(false);
  const [dailyReportAvailable, setDailyReportAvailable] = React.useState(false);
  const [dailyReportBody, setDailyReportBody] = React.useState('');
  // â”€â”€ Notifiche dipendente (pacco monete ecc.) â”€â”€
  const [empNotifs, setEmpNotifs]           = React.useState([]);
  const [unreadEmpNotifs, setUnreadEmpNotifs] = React.useState(0);
  const prevAlertIdsRef = useRef(new Set());
  const notifPanelRef   = useRef();

  // Legge le snooze attive dal localStorage
  const getSnoozed = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
      const now = Date.now();
      // Rimuovi snooze scaduti
      const fresh = Object.fromEntries(Object.entries(raw).filter(([, ts]) => now - ts < SNOOZE_MS));
      if (Object.keys(fresh).length !== Object.keys(raw).length) {
        localStorage.setItem(SNOOZE_KEY, JSON.stringify(fresh));
      }
      return fresh;
    } catch { return {}; }
  };

  const snoozeAlerts = (storeIds) => {
    const now = Date.now();
    const current = getSnoozed();
    storeIds.forEach(id => { current[String(id)] = now; });
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(current));
  };

  // Poll cassa ogni 30s
  useEffect(() => {
    const checkCash = async () => {
      try {
        const res = await cashApi.balances();
        const balances = res.data?.data || [];
        const allAlerts = balances.filter(b => parseFloat(b.balance) >= CASH_THRESHOLD);
        const snoozed = getSnoozed();
        // Mostra solo allerte non in snooze
        const visibleAlerts = allAlerts.filter(a => !snoozed[String(a.store_id ?? a.id)]);
        setCashAlertStores(visibleAlerts);
        // Conta solo le nuove allerte visibili (store che non erano giÃ  in alert)
        const newAlerts = visibleAlerts.filter(a => !prevAlertIdsRef.current.has(a.store_id ?? a.id));
        if (newAlerts.length > 0) {
          setUnreadAlerts(prev => prev + newAlerts.length);
          newAlerts.forEach(a => prevAlertIdsRef.current.add(a.store_id ?? a.id));
        }
        // Rimuovi dalla lista prev gli store che non sono piÃ¹ in allerta
        const alertIds = new Set(visibleAlerts.map(a => a.store_id ?? a.id));
        [...prevAlertIdsRef.current].forEach(id => { if (!alertIds.has(id)) prevAlertIdsRef.current.delete(id); });
      } catch { /* silent */ }
    };
    checkCash();
    const t = setInterval(checkCash, 30000);
    return () => clearInterval(t);
  }, []);

  // Poll report chiusura ogni 5 minuti
  useEffect(() => {
    const checkReport = async () => {
      try {
        const res = await reports.dailyLatest();
        if (res.data?.available) {
          setDailyReportAvailable(prev => {
            if (!prev) setUnreadAlerts(u => u + 1);
            return true;
          });
          setDailyReportBody(res.data.message);
        } else {
          setDailyReportAvailable(false);
        }
      } catch { /* silent */ }
    };
    if (!userRoles.includes('dipendente')) {
      checkReport();
      const t2 = setInterval(checkReport, 300000);
      return () => clearInterval(t2);
    }
  }, [userRoles]);

  // Poll notifiche dipendente (pacco monete, ecc.) ogni 30s
  useEffect(() => {
    if (!userRoles.includes('dipendente')) return;
    const empId = user?.employee_id;
    if (!empId) return;
    const pollEmpNotifs = async () => {
      try {
        const res = await employeesApi.getNotifications(empId, { is_read: 0 });
        const notifs = res.data?.data || [];
        setEmpNotifs(notifs);
        setUnreadEmpNotifs(notifs.length);
      } catch { /* silent */ }
    };
    pollEmpNotifs();
    const t3 = setInterval(pollEmpNotifs, 30000);
    return () => clearInterval(t3);
  }, [userRoles, user?.employee_id]);

  // Chiudi pannello notifiche cliccando fuori
  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e) => { if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) setShowNotifPanel(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);

  const openNotifPanel = () => {
    setShowNotifPanel(v => !v);
    setUnreadAlerts(0); // segna come lette
    // Marca come lette le notifiche dipendente
    if (unreadEmpNotifs > 0 && user?.employee_id) {
      employeesApi.markAllNotificationsRead(user.employee_id).catch(() => {});
      setUnreadEmpNotifs(0);
    }
  };

  // Chiude il pannello e silenzia le allerte correnti per 3 ore
  const dismissNotifPanel = () => {
    const ids = cashAlertStores.map(s => s.store_id ?? s.id);
    if (ids.length > 0) snoozeAlerts(ids);
    setCashAlertStores([]);
    setUnreadAlerts(0);
    prevAlertIdsRef.current.clear();
    setShowNotifPanel(false);
  };


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
            // Accordions always closed â€” navigazione solo via flyout hover
            return (
              <div
                key={section.section}
                className="sp-nav-section"
                onMouseEnter={(e) => handleSectionEnter(section.section, section.items, e)}
                onMouseLeave={scheduleClose}
              >
                {/* Section Header */}
                {!collapsed ? (
                  <div className="flex items-center gap-2 px-3 py-2 mt-2 mb-1 mx-2 rounded-xl cursor-default transition-all hover:bg-slate-800/40" style={{ userSelect: 'none' }}>
                    {section.icon && React.createElement(section.icon, { size: 18, className: "text-indigo-400" })}
                    <span 
                      className="font-black tracking-wide text-slate-200 uppercase" 
                      style={{ fontSize: '12px', letterSpacing: '0.05em', padding: '2px 0', flex: 1 }}
                    >
                      {section.section}
                    </span>
                    <ChevronRight size={14} className="text-slate-400 opacity-60" />
                  </div>
                ) : (
                  <div 
                    className="flex justify-center items-center py-2 mb-1 mx-auto cursor-pointer hover:bg-slate-800/50 rounded-xl transition-all" 
                    style={{ width: 40, height: 40 }}
                    title={section.section}
                  >
                    {section.icon ? React.createElement(section.icon, { size: 18, className: "text-indigo-400" }) : <div className="w-1 h-1 rounded-full bg-slate-500" />}
                  </div>
                )}

                {/* Items: sempre nascosti â€” visibili solo nel flyout */}
                <div style={{ maxHeight: '0px', overflow: 'hidden' }} />
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sp-sidebar-footer" style={{ padding: collapsed ? '12px 4px' : '16px' }}>
          <div
            className="sp-user-card"
            onClick={handleLogout}
            title={collapsed ? `${user?.name || 'Utente'} â€” Logout` : 'Logout'}
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

      {/* â”€â”€ FLYOUT HOVER SUBMENU â”€â”€ */}
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
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.4)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {flyout.section}
          </div>

          {/* Voci */}
          {flyout.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.activeKey);
            return (
              <a
                key={item.activeKey ?? item.href}
                href={item.href}
                onClick={e => { e.preventDefault(); navigate(item.href); setFlyout(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 18px',
                  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  color: active ? '#a5b4fc' : 'rgba(255,255,255,0.85)',
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  textAlign: 'left',
                  transition: 'background 0.12s',
                  borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? 'rgba(99,102,241,0.18)' : 'transparent'; }}
              >
                <Icon size={16} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                <span>{item.label}</span>
              </a>
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
          {/* Mobile hamburger */}
          <button className="sp-mobile-topbar-menu" onClick={() => setMobileDrawerOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sp-topbar-title">
              {location.pathname === '/' && selectedStore 
                ? `${activePageLabel} - ${selectedStore.name}` 
                : activePageLabel}
            </div>
            {/* Chat buttons vicino al titolo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChatTopbarButtons user={user} selectedStoreId={selectedStoreId} />
            </div>
          </div>
          <div className="sp-topbar-actions">
            {storesList.length > 1 && !userRoles.includes('store_manager') && (
              <select 
                className="sp-select sp-desktop-only" 
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
            {/* Bottone Panoramica Generale */}
             <button
              onClick={() => navigate('/dashboard')}
              title="Panoramica Generale"
              className="sp-desktop-only"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: location.pathname === '/dashboard' ? 'linear-gradient(135deg, #5B50B0, #3d3490)' : 'rgba(123,111,208,0.12)',
                color: location.pathname === '/dashboard' ? '#fff' : '#7B6FD0',
                border: '1px solid rgba(123,111,208,0.25)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'linear-gradient(135deg, #7B6FD0, #5B50B0)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = location.pathname === '/dashboard' ? 'linear-gradient(135deg, #5B50B0, #3d3490)' : 'rgba(123,111,208,0.12)'; e.currentTarget.style.color = location.pathname === '/dashboard' ? '#fff' : '#7B6FD0'; }}
            >
              <LayoutDashboard size={16} />
            </button>
            {/* Bottone Scheda (VapeCalc) */}
            <button
              onClick={() => setShowMichelePanel(true)}
              title="Scheda â€” Tabelle Nicotina"
              className="sp-desktop-only"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, flexShrink: 0, fontSize: 17,
                background: showMichelePanel ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'rgba(245,158,11,0.12)',
                color: showMichelePanel ? '#fff' : '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = showMichelePanel ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'rgba(245,158,11,0.12)'; e.currentTarget.style.color = showMichelePanel ? '#fff' : '#f59e0b'; }}
            >
              Scheda
            </button>

            {/* Bottone riepilogo vendite */}
            <button
              onClick={() => setShowStoreStats(true)}
              title={selectedStore ? `Vendite: ${selectedStore.name}` : 'Riepilogo vendite'}
              className="sp-desktop-only"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, #7B6FD0, #5B50B0)',
                color: '#fff', border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(123,111,208,0.35)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <BarChart3 size={16} />
            </button>

            {/* NEW: Bottone aggiorna pagina */}
            <button
              onClick={() => window.location.reload()}
              title="Aggiorna App"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <RefreshCw size={16} />
            </button>

            {/* â”€â”€ CAMPANELLA NOTIFICHE â”€â”€ */}
            <div ref={notifPanelRef} style={{ position: 'relative' }}>
              <button
                className="sp-btn sp-btn-ghost sp-btn-icon"
                title={unreadAlerts > 0 ? `${unreadAlerts} nuov${unreadAlerts === 1 ? 'a allerta' : 'e allerte'} cassa` : cashAlertStores.length > 0 ? `${cashAlertStores.length} negozi in allerta cassa` : 'Notifiche'}
                style={{ position: 'relative' }}
                onClick={openNotifPanel}
              >
                <Bell size={18} />
                {(unreadAlerts > 0 || cashAlertStores.length > 0 || unreadEmpNotifs > 0) && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: unreadEmpNotifs > 0 ? '#f59e0b' : '#EF4444',
                    border: '2px solid white',
                    fontSize: 9, fontWeight: 900, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px',
                    animation: 'spBadgePulse 1.5s ease-out infinite',
                  }}>
                    {unreadEmpNotifs > 0 ? unreadEmpNotifs : cashAlertStores.length}
                  </span>
                )}
              </button>

              {/* Dropdown notifiche */}
              {showNotifPanel && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 300, background: '#1C1B2E',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                  zIndex: 9999, overflow: 'hidden',
                  animation: 'flyoutIn 0.15s ease',
                }}>
                  {/* Header */}
                  <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}> Notifiche Cassa</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Soglia: â‚¬{CASH_THRESHOLD.toLocaleString()}</div>
                  </div>

                  {/* Lista allerte */}
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {/* â”€â”€ Notifiche dipendente (pacco monete) â”€â”€ */}
                  {empNotifs.length > 0 && empNotifs.map(n => (
                    <div key={n.id} style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: 'rgba(245,158,11,0.1)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#fbbf24' }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{n.body}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}

                  {/* â”€â”€ Notifiche cassa (admin) â”€â”€ */}
                  {dailyReportAvailable && (
                      <div style={{
                        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(99,102,241,0.1)', cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        exports_.download(reports.downloadDaily(), 'Report_Serale.pdf');
                        // Non chiudiamo il pannello cosÃ¬ l'utente vede il feedback
                      }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#a5b4fc' }}> Report di Chiusura Pronto</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{dailyReportBody}</div>
                        </div>
                        <div style={{ textAlign: 'right', color: '#a5b4fc', fontSize: 11, fontWeight: 'bold', minWidth: 60 }}>
                          Scarica PDF
                        </div>
                      </div>
                    )}
                    {!dailyReportAvailable && cashAlertStores.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                        âœ… Nessuna allerta attiva
                      </div>
                    ) : (
                      cashAlertStores.map((s, i) => (
                        <div key={s.store_id ?? s.id ?? i} style={{
                          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: i % 2 === 0 ? 'rgba(239,68,68,0.05)' : 'transparent',
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{s.store_name ?? s.name ?? `Negozio ${s.store_id}`}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Saldo cassa attuale</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: 14, color: '#ef4444' }}>
                              {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(s.balance)}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '1px 6px', borderRadius: 8 }}>âš  ALLERTA</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer: shortcuts solo per superadmin/admin */}
                  {!userRoles.includes('dipendente') && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { navigate('/admin-panel'); setShowNotifPanel(false); }}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >Amm. &gt; Tesoreria</button>
                    <button
                      onClick={() => { navigate('/automazioni'); setShowNotifPanel(false); }}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >Automazioni</button>
                  </div>
                  )}
                  {cashAlertStores.length > 0 && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        onClick={dismissNotifPanel}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                        title="Le allerte ricompariranno automaticamente dopo 3 ore se il saldo ÃƒÂ¨ ancora alto"
                      >
                        Ã¢ÂÂ° Chiudi & Ricorda tra 3 ore
                      </button>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </header>

        <section className="sp-content sp-animate-in">
          <Outlet context={{ 
            user, setUser, 
            storesList, selectedStoreId, selectedStore,
            handleStoreChange, displayMode, toggleDisplayMode,
            userRoles,
            setLowStockCount: () => {} 
          }} />
        </section>
      </main>

      {/* DRAWER Vendite Negozio */}
      {showStoreStats && (
        <StoreStatsDrawer
          store={selectedStore || (storesList.length === 1 ? storesList[0] : null)}
          onClose={() => setShowStoreStats(false)}
        />
      )}


      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1C1B2E', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 600 },
          success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />

      {/* â”€â”€ MOBILE DRAWER â”€â”€ */}
      {mobileDrawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="sp-mobile-drawer-overlay"
            style={{ display: 'block' }}
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="sp-mobile-drawer">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 18px 16px', borderBottom: '1px solid #222', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>Sva<span style={{ color: 'var(--color-accent)' }}>Pro</span></div>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Point of Sale System</div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Store selector in drawer */}
            {storesList.length > 0 && !userRoles.includes('store_manager') && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 6 }}>Negozio Attivo</div>
                <select
                  className="sp-select"
                  value={selectedStoreId}
                  onChange={(e) => { handleStoreChange(e.target.value); }}
                  style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: 8, fontSize: 13, padding: '8px 10px' }}
                >
                  <option value="">Tutti i negozi</option>
                  {storesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
              {filteredNav.map((section) => (
                <div key={section.section} style={{ marginBottom: 4 }}>
                  <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {section.icon && React.createElement(section.icon, { size: 12, style: { color: '#6366f1', flexShrink: 0 } })}
                    {section.section}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href, item.activeKey);
                    return (
                      <button
                        key={item.activeKey ?? item.href}
                        onClick={() => { navigate(item.href); setMobileDrawerOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '11px 14px', borderRadius: 10, border: 'none',
                          background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
                          color: active ? '#a5b4fc' : 'rgba(255,255,255,0.75)',
                          fontSize: 14, fontWeight: active ? 700 : 500, textAlign: 'left',
                          cursor: 'pointer', marginBottom: 2,
                          borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                          transition: 'background 0.12s',
                        }}
                      >
                        <Icon size={16} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Drawer footer: user + logout */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid #222', flexShrink: 0 }}>
              <button
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
              >
                <LogOut size={16} />
                <span>Esci â€” {user?.name || 'Utente'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* â”€â”€ MOBILE BOTTOM NAV â€” role-aware â”€â”€ */}
      <nav className="sp-mobile-nav" aria-label="Navigazione principale mobile">
        <div className="sp-mobile-nav-inner">
          {/* POS Cassa â€” tutti i ruoli */}
          <button
            className={`sp-mobile-nav-btn ${location.pathname === '/' || location.pathname === '/pos' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <Monitor size={22} />
            <span>Cassa</span>
          </button>

          {/* DIPENDENTI: Timbra + Bolle */}
          {userRoles.includes('dipendente') && !userRoles.includes('admin_cliente') && !userRoles.includes('store_manager') && !userRoles.includes('superadmin') ? (
            <>
              <button
                className={`sp-mobile-nav-btn ${location.pathname === '/clock-in' ? 'active' : ''}`}
                onClick={() => navigate('/clock-in')}
              >
                <Fingerprint size={22} />
                <span>Timbra</span>
              </button>
              <button
                className={`sp-mobile-nav-btn ${location.pathname === '/warehouse/restock' ? 'active' : ''}`}
                onClick={() => navigate('/warehouse/restock')}
              >
                <Package size={22} />
                <span>Riassort.</span>
              </button>
              <button
                className={`sp-mobile-nav-btn ${location.pathname === '/warehouse/delivery-notes' ? 'active' : ''}`}
                onClick={() => navigate('/warehouse/delivery-notes')}
              >
                <Truck size={22} />
                <span>Bolle</span>
              </button>
            </>
          ) : (
            /* ADMIN: Negozi + Vendite */
            <>
              <button
                className={`sp-mobile-nav-btn ${location.pathname === '/stores' ? 'active' : ''}`}
                onClick={() => navigate('/stores')}
              >
                <Store size={22} />
                <span>Negozi</span>
              </button>
              <button
                className={`sp-mobile-nav-btn ${showStoreStats ? 'active' : ''}`}
                onClick={() => setShowStoreStats(v => !v)}
              >
                <BarChart3 size={22} />
                <span>Vendite</span>
              </button>
              <button
                className={`sp-mobile-nav-btn ${location.pathname.startsWith('/customers') ? 'active' : ''}`}
                onClick={() => navigate('/customers')}
              >
                <Users size={22} />
                <span>Clienti</span>
              </button>
            </>
          )}


          {/* Menu Ã¢â‚¬â€ tutti */}
          <button
            className={`sp-mobile-nav-btn ${mobileDrawerOpen ? 'active' : ''}`}
            onClick={() => setMobileDrawerOpen(true)}
          >
            <Menu size={22} />
            <span>Menu</span>
          </button>
        </div>
      </nav>
      {showMichelePanel && <MichelePanelModal onClose={() => setShowMichelePanel(false)} />}
    </div>
  );
}
