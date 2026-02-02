import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Boxes,
  Network,
  Radio,
  Bell,
  Wrench,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Zap,
  User,
  FileText,
  Shield,
} from 'lucide-react';
import { useAuthStore, UserRole } from '../stores/authStore';
import { RoleBadge } from './auth/PermissionGate';
import LanguageSwitcher from './LanguageSwitcher';
import clsx from 'clsx';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roles?: UserRole[];
}

const navigation: NavItem[] = [
  { name: 'dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },
  { name: 'sites', href: '/sites', icon: Building2, permission: 'assets:view' },
  { name: 'assets', href: '/assets', icon: Boxes, permission: 'assets:view' },
  { name: 'topology', href: '/topology', icon: Network, permission: 'topology:view' },
  { name: 'sensors', href: '/sensors', icon: Radio, permission: 'sensors:view' },
  { name: 'alerts', href: '/alerts', icon: Bell, permission: 'alerts:view' },
  { name: 'maintenance', href: '/maintenance', icon: Wrench, permission: 'maintenance:view' },
  { name: 'analytics', href: '/analytics', icon: BarChart3, permission: 'analytics:view', roles: ['administrator', 'analyst'] },
  { name: 'reports', href: '/reports', icon: FileText, permission: 'reports:view', roles: ['administrator', 'analyst'] },
];

export default function Layout() {
  // Persist sidebar state in localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem('canunited-sidebar');
    return stored !== null ? JSON.parse(stored) : true; // Default to open
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Save sidebar state when it changes
  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('canunited-sidebar', JSON.stringify(newState));
  };
  const { user, logout, hasPermission, hasRole } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter navigation based on permissions
  const filteredNavigation = navigation.filter((item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.roles && !hasRole(item.roles)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 bg-circuit-pattern">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        <motion.aside
          initial={{ width: sidebarOpen ? 280 : 80 }}
          animate={{ width: sidebarOpen ? 280 : 80 }}
          transition={{ duration: 0.3 }}
          className="fixed left-0 top-0 h-screen bg-slate-900/80 backdrop-blur-xl border-r border-slate-700/50 z-40 flex flex-col"
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
            <motion.div
              initial={{ opacity: sidebarOpen ? 1 : 0 }}
              animate={{ opacity: sidebarOpen ? 1 : 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              {sidebarOpen && (
                <div>
                  <h1 className="font-display font-bold text-white">{t('app.name')}</h1>
                  <p className="text-xs text-slate-400">{t('app.tagline')}</p>
                </div>
              )}
            </motion.div>
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-slate-400" /> : <Menu className="w-5 h-5 text-slate-400" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary-500/10 text-primary-400 border-l-2 border-primary-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="font-medium"
                  >
                    {t(`nav.${item.name}`)}
                  </motion.span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-slate-700/50">
            {hasPermission('settings:view') && (
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-2',
                    isActive
                      ? 'bg-primary-500/10 text-primary-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )
                }
              >
                <Settings className="w-5 h-5" />
                {sidebarOpen && <span className="font-medium">{t('nav.settings')}</span>}
              </NavLink>
            )}

            <LanguageSwitcher collapsed={!sidebarOpen} />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800/50 transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                {sidebarOpen && (
                  <>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium truncate">{user?.name}</p>
                      {user?.role && <RoleBadge role={user.role} size="sm" />}
                    </div>
                    <ChevronDown className={clsx('w-4 h-4 transition-transform', userMenuOpen && 'rotate-180')} />
                  </>
                )}
              </button>

              <AnimatePresence>
                {userMenuOpen && sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                  >
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700/50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('auth.signOut')}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>

      {/* Main content */}
      <main
        className={clsx(
          'transition-all duration-300 min-h-screen',
          sidebarOpen ? 'ml-[280px]' : 'ml-[80px]'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
