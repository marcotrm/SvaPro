import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, Home, Package, ShoppingCart, Warehouse, Users, Briefcase, TrendingUp, BarChart3, X } from 'lucide-react';
import { auth } from '../api.jsx';
import clsx from 'clsx';

const menuItems = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Catalogo', href: '/catalog', icon: Package },
  { label: 'Ordini', href: '/orders', icon: ShoppingCart },
  { label: 'Magazzino', href: '/inventory', icon: Warehouse },
  { label: 'Smart Reorder', href: '/inventory/smart-reorder', icon: TrendingUp },
  { label: 'Clienti', href: '/customers', icon: Users },
  { label: 'Dipendenti', href: '/employees', icon: Briefcase },
  { label: 'Loyalty', href: '/analytics/loyalty', icon: BarChart3 },
];

export default function Layout({ user, setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantCode');
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={clsx(
          'bg-gradient-to-b from-indigo-900 to-indigo-800 text-white transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-indigo-700">
          {sidebarOpen && (
            <div className="font-bold text-lg">SvaPro</div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-indigo-700 p-2 rounded transition"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition duration-200',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-indigo-100 hover:bg-indigo-700 hover:text-white'
                )}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-indigo-700">
          <button
            onClick={handleLogout}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition duration-200',
              'text-indigo-100 hover:bg-indigo-700 hover:text-white'
            )}
            title="Logout"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Gestionale SvaPro</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-500">{user?.roles?.[0] || 'user'}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="font-bold text-indigo-600">
                {(user?.name || user?.email)?.[0]?.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
