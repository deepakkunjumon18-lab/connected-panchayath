import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Zap,
  Eye,
  ArrowRight,
  FileText,
  Search,
  CheckCircle2,
  Lock,
  Building2
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';

export default function LandingPage() {
  const { isAuthenticated, user, getHomeRoute } = useAuth();
  const navigate = useNavigate();

  const handleApplyClick = () => {
    if (isAuthenticated) {
      navigate('/citizen/apply');
    } else {
      navigate('/register');
    }
  };

  const handleTrackClick = () => {
    if (isAuthenticated) {
      navigate('/citizen/applications');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100/70 text-primary-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse" />
              Kerala Inter-Panchayat Verification Network
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink tracking-tight leading-[1.15]">
              Simplifying Panchayat Services{' '}
              <span className="text-primary-600">Together</span>
            </h1>

            <p className="text-base sm:text-lg text-muted max-w-2xl leading-relaxed">
              No more traveling between taluks and panchayats for certificates. When your family records or land are in another panchayat, Connected Panchayat digitally routes verification requests between officers with real cryptographic security.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                size="lg"
                variant="primary"
                onClick={handleApplyClick}
                icon={ArrowRight}
                iconPosition="right"
              >
                Apply for EWS Certificate
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={handleTrackClick}
                icon={Search}
              >
                Track Application
              </Button>
            </div>

            <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-muted border-t border-line">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary-600" />
                <span>RSA-2048 Digital Signatures</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>QR-Verifiable Certificates</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary-600" />
                <span>Zero Raw Record Exposure</span>
              </div>
            </div>
          </div>

          {/* Hero Inline SVG Illustration */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-white rounded-3xl border border-line shadow-soft p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full blur-2xl -z-0" />
              
              <div className="relative z-10 text-center space-y-6">
                <div className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                  Inter-Panchayat Digital Bridge
                </div>

                {/* SVG Illustration: Two Panchayat offices with digital arrow and encrypted document */}
                <svg
                  viewBox="0 0 360 180"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-auto mx-auto"
                >
                  {/* Left Office: Home Panchayat A */}
                  <g id="office-a">
                    <rect x="20" y="70" width="80" height="80" rx="12" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
                    <polygon points="60 35 105 70 15 70" fill="#2563EB" />
                    <rect x="45" y="110" width="30" height="40" rx="4" fill="#1D4ED8" />
                    <rect x="32" y="85" width="16" height="16" rx="3" fill="#DBEAFE" />
                    <rect x="72" y="85" width="16" height="16" rx="3" fill="#DBEAFE" />
                    <text x="60" y="165" fontSize="10" fontWeight="600" fill="#0F172A" textAnchor="middle">Panchayat A</text>
                    <text x="60" y="176" fontSize="8" fill="#64748B" textAnchor="middle">(Applicant)</text>
                  </g>

                  {/* Connecting Digital Arrow */}
                  <g id="bridge-flow">
                    <path
                      d="M 105 100 C 145 60, 215 60, 255 100"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                      fill="none"
                    />
                    {/* Moving document bubble in center */}
                    <circle cx="180" cy="75" r="22" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.05))" />
                    {/* Shield / Document icon inside */}
                    <path
                      d="M 174 69 L 186 69 L 186 81 L 174 81 Z"
                      fill="#DBEAFE"
                    />
                    <path
                      d="M 180 67 L 185 71 L 185 78 C 185 81 180 83 180 83 C 180 83 175 81 175 78 L 175 71 Z"
                      fill="#2563EB"
                    />
                    <text x="180" y="115" fontSize="9" fontWeight="600" fill="#2563EB" textAnchor="middle">
                      Signed Decision
                    </text>
                    <text x="180" y="126" fontSize="8" fill="#64748B" textAnchor="middle">
                      RSA-SHA256
                    </text>
                  </g>

                  {/* Right Office: Verifying Panchayat B */}
                  <g id="office-b">
                    <rect x="260" y="70" width="80" height="80" rx="12" fill="#F4F7FB" stroke="#94A3B8" strokeWidth="2" />
                    <polygon points="300 35 345 70 255 70" fill="#0B1F4B" />
                    <rect x="285" y="110" width="30" height="40" rx="4" fill="#12306B" />
                    <rect x="272" y="85" width="16" height="16" rx="3" fill="#CBD5E1" />
                    <rect x="312" y="85" width="16" height="16" rx="3" fill="#CBD5E1" />
                    <text x="300" y="165" fontSize="10" fontWeight="600" fill="#0F172A" textAnchor="middle">Panchayat B</text>
                    <text x="300" y="176" fontSize="8" fill="#64748B" textAnchor="middle">(Records held)</text>
                  </g>
                </svg>

                <div className="p-3 bg-slate-50 rounded-2xl border border-line text-xs text-muted flex items-center justify-between">
                  <span className="font-medium text-ink">Zero Data Leakage:</span>
                  <span className="text-primary-700 font-semibold">YES/NO + Remarks Only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card hover className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink">Digital Verification</h3>
            <p className="text-sm text-muted leading-relaxed">
              Verifying officers manually inspect local registers and sign decisions using tamper-proof RSA-2048 cryptography with SHA-256 integrity verification.
            </p>
          </Card>

          <Card hover className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink">Less Delays</h3>
            <p className="text-sm text-muted leading-relaxed">
              No physical paper transit. Automated deadline reminders and overdue tracking ensure certificate requests are processed without administrative bottlenecks.
            </p>
          </Card>

          <Card hover className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#6D28D9] flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-ink">Transparent Process</h3>
            <p className="text-sm text-muted leading-relaxed">
              Citizens track real-time application timeline progress and receive instant notifications. Every issued certificate carries a public verification QR code.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works Strip */}
      <section className="bg-white border-y border-line py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink">How Connected Panchayat Works</h2>
            <p className="text-sm text-muted">A clear four-step process connecting citizens and local governing bodies.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-surface rounded-2xl p-5 border border-line space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                1
              </div>
              <h4 className="font-bold text-ink">Citizen Applies</h4>
              <p className="text-xs text-muted leading-relaxed">
                Applicant chooses certificate type, enters applicant details, and specifies panchayats where parents or property records are held.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-line space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                2
              </div>
              <h4 className="font-bold text-ink">Digital Routing</h4>
              <p className="text-xs text-muted leading-relaxed">
                If records belong to another panchayat, the system automatically routes an isolated verification request directly to that panchayat’s officers.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-line space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                3
              </div>
              <h4 className="font-bold text-ink">Officer Cryptographic Sign</h4>
              <p className="text-xs text-muted leading-relaxed">
                Verifying officer checks manual records, provides YES/NO decision with remarks, and signs with an officer-specific RSA key pair.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-line space-y-3">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">
                4
              </div>
              <h4 className="font-bold text-ink">Certificate Issued</h4>
              <p className="text-xs text-muted leading-relaxed">
                Home officer verifies the digital signature and issues the certificate. Citizen receives an email and downloads the tamper-proof PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-3xl p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-soft">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-bold">Ready to apply for your certificate?</h3>
            <p className="text-sm text-slate-300 max-w-xl">
              Register as a citizen or log in to manage, verify, and track your panchayat service requests.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="primary" size="lg" onClick={handleApplyClick}>
              Get Started Now
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
