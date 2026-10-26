import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Landmark,
  LayoutDashboard,
  Users,
  FileCode2,
  Database,
  BarChart3,
  ShieldCheck,
  History,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Panchayats', to: '/admin/panchayats', icon: Landmark },
    { label: 'Certificate Types', to: '/admin/certificate-types', icon: FileCode2 },
    { label: 'Master Data', to: '/admin/master-data', icon: Database },
    { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
    { label: 'Signatures Audit', to: '/admin/signatures', icon: ShieldCheck },
    { label: 'Audit Logs', to: '/admin/audit-logs', icon: History }
  ];

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop Sidebar (Navy gradient) */}
      <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-navy-900 to-navy-800 text-white shrink-0 p-4 justify-between">
        <div>
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-3 py-4 mb-4 border-b border-navy-700/60">
            <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-soft-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-base text-primary-400">Connected</span>
                <span className="font-bold text-base text-white">Panchayat</span>
              </div>
              <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">
                System Admin
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-soft-sm font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="pt-4 border-t border-navy-700/60">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                A
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">Administrator</p>
                <p className="text-[11px] text-slate-300 truncate">{user?.email || 'admin@connectedpanchayat.test'}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-red-400 hover:bg-white/5 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-line px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-soft-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-muted hover:text-ink hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">System Administration</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                Root Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-navy-900 to-navy-800 text-white p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-navy-700/60">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-white">Connected Panchayat</span>
                  </div>
                  <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg text-slate-300 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                            isActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-navy-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
