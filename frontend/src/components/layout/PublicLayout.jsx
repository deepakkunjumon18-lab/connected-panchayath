import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Landmark, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

export default function PublicLayout() {
  const { isAuthenticated, user, getHomeRoute } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-line shadow-soft-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-soft-sm group-hover:bg-primary-700 transition">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-lg text-primary-600">Connected</span>
                <span className="font-bold text-lg text-ink">Panchayat</span>
              </div>
              <p className="text-[10px] text-muted -mt-1 hidden sm:block tracking-wide">
                Bridging Panchayats • Empowering Citizens
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-muted hover:text-ink px-3 py-1.5 rounded-lg transition"
            >
              Home
            </Link>
            <Link
              to="/verify"
              className="text-sm font-medium text-muted hover:text-ink px-3 py-1.5 rounded-lg transition hidden sm:inline-block"
            >
              Verify Certificate
            </Link>

            {isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(getHomeRoute(user.role))}
                icon={ArrowRight}
                iconPosition="right"
              >
                Go to Dashboard
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="secondary" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-line py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary-600 text-white flex items-center justify-center">
              <Landmark className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-ink">Connected Panchayat</span>
            <span>·</span>
            <span>Local Self Government Verification Network</span>
          </div>

          <p>© 2026 Connected Panchayat · Kerala · Academic MCA project</p>
        </div>
      </footer>
    </div>
  );
}
