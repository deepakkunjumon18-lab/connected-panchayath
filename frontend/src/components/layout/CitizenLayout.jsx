import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Landmark,
  LayoutDashboard,
  FilePlus2,
  FileText,
  Award,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function CitizenLayout({ children }) {
  const { user, logout } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', to: '/citizen', icon: LayoutDashboard, end: true },
    { label: 'New Application', to: '/citizen/apply', icon: FilePlus2 },
    { label: 'My Applications', to: '/citizen/applications', icon: FileText },
    { label: 'My Certificates', to: '/citizen/certificates', icon: Award },
    { label: 'Profile', to: '/citizen/profile', icon: User }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-line shadow-soft-sm">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-muted hover:text-ink hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link to="/citizen" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-soft-sm">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-base text-primary-600">Connected</span>
                <span className="font-bold text-base text-ink">Panchayat</span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                  Citizen
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center text-xs text-muted bg-slate-50 border border-line px-3 py-1.5 rounded-xl">
              <span className="font-medium text-ink mr-1">Home Panchayat:</span>
              <span className="text-primary-700 font-semibold">{user?.panchayat_name || 'Kerala GP'}</span>
            </div>

            <NotificationBell />

            {/* User Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center border border-primary-200">
                  {user?.full_name?.charAt(0) || 'C'}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-ink leading-tight">{user?.full_name || 'Citizen'}</p>
                  <p className="text-[10px] text-muted">Citizen</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted hidden sm:block" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-soft border border-line py-1 z-50 animate-scaleUp">
                  <div className="px-4 py-2 border-b border-line sm:hidden">
                    <p className="text-xs font-semibold text-ink">{user?.full_name}</p>
                    <p className="text-[10px] text-muted">{user?.panchayat_name}</p>
                  </div>
                  <Link
                    to="/citizen/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-ink hover:bg-slate-50 transition"
                  >
                    <User className="w-4 h-4 text-muted" />
                    <span>Profile & Security</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body with Sidebar and Main Area */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-line shadow-soft-sm p-4 sticky top-24">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-soft-sm'
                          : 'text-muted hover:text-ink hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-8 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-soft p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-line">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-ink">Connected Panchayat</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="p-1 rounded-lg text-muted hover:text-ink hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl mb-4 text-xs">
                  <p className="font-semibold text-ink">{user?.full_name}</p>
                  <p className="text-muted mt-0.5">{user?.panchayat_name}</p>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                            isActive
                              ? 'bg-primary-600 text-white shadow-soft-sm'
                              : 'text-muted hover:text-ink hover:bg-slate-50'
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

              <div className="pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
