import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Landmark,
  LayoutDashboard,
  CheckSquare,
  Inbox,
  Award,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import { notificationsApi } from '../../api/notifications';
import { getVerificationCounts } from '../../api/verification';

export default function OfficerLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingIncomingCount, setPendingIncomingCount] = useState(0);

  useEffect(() => {
    async function loadCounts() {
      try {
        const notifRes = await notificationsApi.getUnreadCount();
        if (notifRes.success && notifRes.data) {
          setUnreadCount(notifRes.data.unread_count);
        }
      } catch {
        // quiet fail
      }

      try {
        const vrRes = await getVerificationCounts();
        const pending = vrRes.data?.incoming?.pending || 0;
        setPendingIncomingCount(pending);
      } catch {
        // quiet fail
      }
    }

    loadCounts();
    // Poll every 30 seconds (Section 10 / Prompt 4)
    const interval = setInterval(loadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { label: 'Dashboard', to: '/officer', icon: LayoutDashboard, end: true },
    { label: 'Verify & Request', to: '/officer/applications', icon: CheckSquare },
    { label: 'Incoming Requests', to: '/officer/incoming', icon: Inbox, badge: pendingIncomingCount > 0 ? pendingIncomingCount : null },
    { label: 'Issued Certificates', to: '/officer/certificates', icon: Award },
    { label: 'Panchayat Directory', to: '/officer/directory', icon: BookOpen },
    { label: 'Reports', to: '/officer/reports', icon: BarChart3 },
    { label: 'Settings', to: '/officer/settings', icon: Settings }
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
              <span className="text-[10px] text-slate-300 font-medium tracking-wider uppercase">
                Officer Portal
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
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-soft-sm font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="pt-4 border-t border-navy-700/60">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {user?.full_name?.charAt(0) || 'O'}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
                <p className="text-[11px] text-slate-300 truncate">{user?.panchayat_name}</p>
              </div>
            </div>
            {user?.designation && (
              <p className="text-[10px] text-primary-300 mt-1 truncate">{user?.designation}</p>
            )}
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
            <div className="text-sm font-semibold text-ink">
              {user?.panchayat_name} <span className="text-muted font-normal">({user?.panchayat_code})</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted bg-slate-50 border border-line px-3 py-1.5 rounded-xl">
              <Shield className="w-3.5 h-3.5 text-primary-600" />
              <span>Digital Key:</span>
              <span className="font-mono text-ink font-medium">
                {user?.key_fingerprint ? `${user.key_fingerprint.slice(0, 10)}...` : 'Active'}
              </span>
            </div>
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
                          `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                            isActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }`
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
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
