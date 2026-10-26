import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Building,
  User,
  Calendar,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export default function VerifyCertificatePage() {
  const { code: paramCode } = useParams();
  const [searchParams] = useSearchParams();

  const queryCode = searchParams.get('v') || searchParams.get('code') || '';
  const isQr = searchParams.get('src') === 'qr';

  const [verificationCode, setVerificationCode] = useState(paramCode || queryCode || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const performVerification = async (codeVal) => {
    if (!codeVal || !codeVal.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResult(null);

    try {
      const qrQuery = isQr ? '?src=qr' : '';
      const endpoint = `/api/certificates/verify/${encodeURIComponent(codeVal.trim())}${qrQuery}`;

      const res = await axios.get(endpoint);
      if (res.data?.success && res.data?.data) {
        setResult(res.data.data);
      } else {
        setResult({
          valid: false,
          status: 'NOT_FOUND',
          message: res.data?.message || 'Certificate verification failed'
        });
      }
    } catch (err) {
      setResult({
        valid: false,
        status: 'NOT_FOUND',
        message: err.response?.data?.message || 'Certificate not found in official Panchayat registry'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const codeToVerify = paramCode || queryCode;
    if (codeToVerify) {
      performVerification(codeToVerify);
    }
  }, [paramCode, queryCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    performVerification(verificationCode);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Centered Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-blue-600 mb-1 shadow-xs">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Public Certificate Verification
        </h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Verify the authenticity, cryptographic provenance, and digital integrity of any certificate issued by Kerala Panchayats.
        </p>
      </div>

      {/* Verification Query Card */}
      <Card className="p-6 shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-700 mb-1.5 tracking-wider">
              Enter Verification Code
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. CP-9X4K2M or scan QR code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                className="w-full text-base sm:text-lg font-mono font-bold pl-4 pr-12 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
                required
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <QrCode className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              The verification code is printed at the bottom of the certificate and encoded in the QR code.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={ShieldCheck}
              className="w-full sm:w-auto justify-center"
            >
              Verify Certificate
            </Button>
          </div>
        </form>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" className="text-primary-600 mb-3" />
          <p className="text-slate-600 text-sm font-medium">Checking official Panchayat registry and document hash...</p>
        </div>
      )}

      {/* Result State */}
      {hasSearched && !loading && result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {result.valid ? (
            /* VALID CERTIFICATE DISPLAY */
            <div className="space-y-6">
              {/* Green Success Banner */}
              <div className="p-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-emerald-950">
                      Authentic & Valid Certificate
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                      This certificate was officially issued and recorded in the Connected Panchayat registry.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" size="md">
                    STATUS: {result.status}
                  </Badge>
                  {result.integrity?.fileHashMatches && (
                    <Badge variant="info" size="md">
                      SHA-256 HASH MATCH
                    </Badge>
                  )}
                </div>
              </div>

              {/* Integrity Notice if Hash Mismatch */}
              {result.integrity && !result.integrity.fileHashMatches && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3 text-amber-900 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Integrity Warning:</strong>
                    The cryptographic SHA-256 hash does not match the file on record. The certificate document may have been altered or modified.
                  </div>
                </div>
              )}

              {/* Certificate Details Card */}
              <Card className="p-6 shadow-sm border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                      Certificate Type
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                      {result.certificate_name}
                    </h2>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Certificate Number</span>
                    <span className="font-mono font-bold text-slate-900 text-base">
                      {result.certificate_no}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-5 border-b border-slate-200 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Issued To (Citizen)</div>
                      <div className="font-semibold text-slate-900 text-base mt-0.5">
                        {result.holder_name}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        (Privacy notice: Aadhaar and address are withheld on public verification)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Issuing Authority</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {result.issuing_panchayat}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Local Self Government, Kerala
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Date of Issue</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {result.issue_date ? (
                          new Date(result.issue_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Validity Period</div>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {result.valid_until ? (
                          new Date(result.valid_until).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        ) : (
                          'Permanent Validity'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with verification metadata */}
                <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    <span>
                      Verification Code: <strong className="font-mono text-slate-800">{result.verification_code}</strong>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Logged in official verification audit trail
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            /* INVALID / EXPIRED / REVOKED / NOT FOUND DISPLAY */
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/30 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <XCircle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-red-950">
                    {result.status === 'EXPIRED'
                      ? 'Certificate Expired'
                      : result.status === 'REVOKED'
                      ? 'Certificate Revoked'
                      : 'Certificate Not Verified / Invalid'}
                  </h3>
                  <p className="text-xs sm:text-sm text-red-900 mt-1 leading-relaxed">
                    {result.message || 'The specified verification code does not match an authentic, active certificate issued in the Connected Panchayat registry.'}
                  </p>
                </div>
              </div>

              <Card className="p-6">
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                  Verification Guidance
                </h4>
                <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1.5 leading-relaxed">
                  <li>Double-check that the code has been entered exactly as printed on the document footer.</li>
                  <li>Scan the QR code printed directly on the physical or digital document for automatic lookup.</li>
                  <li>If the certificate is expired or revoked, contact the issuing Panchayat office.</li>
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
