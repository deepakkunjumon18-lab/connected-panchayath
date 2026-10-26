import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Shield, Zap, HeartHandshake, ArrowRight, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

export default function LoginPage() {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState('CITIZEN'); // 'CITIZEN' | 'OFFICIAL'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    await login(identifier.trim(), password, activeTab);
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-line shadow-soft overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Blue Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-primary-600 to-navy-900 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-white">Connected Panchayat</span>
            </Link>

            <div className="space-y-2 pt-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                One Certificate.<br />Two Panchayats.<br />Seamless.
              </h2>
              <p className="text-sm text-primary-100 leading-relaxed pt-1">
                Inter-panchayat digital verification system for Kerala local self-governments.
              </p>
            </div>

            {/* Three feature chips */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2 rounded-xl text-xs font-medium">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Faster Process — No Physical Transit</span>
              </div>
              <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2 rounded-xl text-xs font-medium">
                <Shield className="w-4 h-4 text-emerald-300" />
                <span>Digital Verification — RSA Cryptography</span>
              </div>
              <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2 rounded-xl text-xs font-medium">
                <HeartHandshake className="w-4 h-4 text-sky-200" />
                <span>Citizen Friendly — Real-time Tracking</span>
              </div>
            </div>
          </div>

          {/* SVG Illustration in Left Panel */}
          <div className="relative z-10 pt-8 flex justify-center">
            <svg viewBox="0 0 240 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-48 h-auto opacity-90">
              <rect x="15" y="40" width="55" height="50" rx="8" fill="#FFFFFF" fillOpacity="0.15" stroke="#FFFFFF" strokeWidth="1.5" />
              <polygon points="42.5 18 72 40 13 40" fill="#FFFFFF" fillOpacity="0.3" />
              <rect x="33" y="65" width="20" height="25" rx="3" fill="#FFFFFF" fillOpacity="0.3" />

              <path d="M 75 55 C 100 35, 140 35, 165 55" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="4 4" />

              <rect x="170" y="40" width="55" height="50" rx="8" fill="#FFFFFF" fillOpacity="0.15" stroke="#FFFFFF" strokeWidth="1.5" />
              <polygon points="197.5 18 227 40 168 40" fill="#FFFFFF" fillOpacity="0.3" />
              <rect x="188" y="65" width="20" height="25" rx="3" fill="#FFFFFF" fillOpacity="0.3" />
            </svg>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-between">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-ink">Welcome Back</h3>
              <p className="text-sm text-muted mt-1">Please select your portal and enter your credentials.</p>
            </div>

            {/* Tab switch: Panchayat Official | Citizen */}
            <div className="bg-slate-100 p-1 rounded-2xl flex">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('CITIZEN');
                  setIdentifier('');
                  setPassword('');
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition duration-150 ${
                  activeTab === 'CITIZEN'
                    ? 'bg-white text-primary-600 shadow-soft-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Citizen Portal
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('OFFICIAL');
                  setIdentifier('');
                  setPassword('');
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition duration-150 ${
                  activeTab === 'OFFICIAL'
                    ? 'bg-white text-primary-600 shadow-soft-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Panchayat Official
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={activeTab === 'CITIZEN' ? 'Mobile Number / Username' : 'Official Username / Email'}
                placeholder={activeTab === 'CITIZEN' ? 'e.g. 9876500001' : 'e.g. officer.kottarakara or admin'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(true)}
                    className="text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full mt-2"
                icon={ArrowRight}
                iconPosition="right"
              >
                Sign In to {activeTab === 'CITIZEN' ? 'Citizen Account' : 'Official Portal'}
              </Button>
            </form>

            {/* Note & Registration links */}
            <div className="pt-4 border-t border-line text-xs text-muted space-y-2 text-center">
              {activeTab === 'CITIZEN' ? (
                <p>
                  Don't have an account yet?{' '}
                  <Link to="/register" className="font-semibold text-primary-600 hover:underline">
                    Register as Citizen
                  </Link>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-line">
                  For new panchayat officials: contact your district administrator to get access.
                </p>
              )}
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 mt-6">
            Academic MCA Project Demo · Government of Kerala Local Self Government Services
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Forgot Password"
        subtitle="Password recovery assistance"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-sm text-muted">
          <p>
            Please contact your local Panchayat office or District System Administrator to initiate a secure password reset for your account.
          </p>
          <div className="p-3 bg-primary-50 rounded-xl border border-primary-100 text-xs text-primary-800">
            <strong>Administrator Contact:</strong> admin@connectedpanchayat.test
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setForgotModalOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
