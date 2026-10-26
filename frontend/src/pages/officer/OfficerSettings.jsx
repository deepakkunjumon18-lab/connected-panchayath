import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';
import { 
  Shield, 
  KeyRound, 
  Lock, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  Info,
  Calendar,
  Cpu
} from 'lucide-react';
import { getOfficerPublicKey } from '../../api/dashboard';

export default function OfficerSettings() {
  const { user } = useAuth();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  // Key state
  const [keyData, setKeyData] = useState(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  useEffect(() => {
    async function loadKey() {
      setKeyLoading(true);
      try {
        const res = await getOfficerPublicKey();
        setKeyData(res.data?.data || res.data);
      } catch (err) {
        console.error('Failed to load key info:', err);
      } finally {
        setKeyLoading(false);
      }
    }
    loadKey();
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPwError('Password must contain uppercase, lowercase, and a number');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match');
      return;
    }

    setPwLoading(true);
    try {
      const res = await axios.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      if (res.data?.success) {
        toast.success('Officer password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.data?.message || 'Failed to update password');
      }
    } catch (err) {
      setPwError(err.response?.data?.message || 'Current password incorrect');
    } finally {
      setPwLoading(false);
    }
  };

  const handleCopyFingerprint = () => {
    if (!keyData?.fingerprint) return;
    navigator.clipboard.writeText(keyData.fingerprint);
    setCopiedFingerprint(true);
    toast.success('Key fingerprint copied to clipboard');
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  const handleDownloadPublicKey = () => {
    if (!keyData?.pem) {
      toast.error('Public key not available');
      return;
    }
    const blob = new Blob([keyData.pem], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${keyData.panchayat_code || user?.panchayat_code || 'officer'}_public_key.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Public key PEM downloaded');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <PageHeader
        title="Officer Settings & Security"
        subtitle="Manage your credentials, cryptographic signing keys, and administrative profile."
      />

      {/* 1. Profile Card (Read-only) */}
      <Card title="Official Profile">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="text-slate-500 block">Officer Name</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{user?.full_name}</span>
              <span className="text-[11px] text-slate-400">Designation: {user?.designation || 'Verification Officer'}</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="text-slate-500 block">Assigned Panchayat</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{user?.panchayat_name}</span>
              <span className="text-[11px] text-slate-400">Code: {user?.panchayat_code} • Role: {user?.role}</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="text-slate-500 block">Official Email</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{user?.email}</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
              <Phone className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="text-slate-500 block">Official Mobile</span>
              <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{user?.mobile}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Digital Signing Key Card */}
      <Card title="Digital Signing Key (RSA-2048)">
        {keyLoading ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Spinner size="md" className="text-primary-600 mb-2" />
            <p className="text-xs text-slate-500">Loading cryptographic credentials...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key specs banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                      Cryptographic Algorithm
                    </span>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>RSA-2048 / SHA-256</span>
                      <Badge variant="success" size="sm">ACTIVE</Badge>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleDownloadPublicKey}
                >
                  Download public key (.pem)
                </Button>
              </div>

              {/* Fingerprint row with copy button */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Public Key SHA-256 Fingerprint:
                </span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex-1 break-all">
                    {keyData?.fingerprint || 'Not available'}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={copiedFingerprint ? Check : Copy}
                    onClick={handleCopyFingerprint}
                  >
                    {copiedFingerprint ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Key Created Date */}
              {keyData?.key_created_at && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Key generated on: {new Date(keyData.key_created_at).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Explanatory Callout: How signing works */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <h4 className="font-bold text-blue-950">How Inter-Panchayat Signing Works</h4>
                <p>
                  When you approve or reject a verification request, Connected Panchayat constructs a canonical JSON payload of the decision, hashes it with SHA-256, and signs the digest using your <strong>RSA-2048 private key</strong> (decrypted in memory only for the duration of the signing operation using your session password).
                </p>
                <p>
                  The requesting Panchayat independently verifies this signature against your registered public key. Decisions are cryptographically tamper-proof and legally attributable under the <strong>Information Technology Act, 2000</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Change Password Form */}
      <Card title="Change Password">
        {pwError && <Alert type="danger" message={pwError} className="mb-4" />}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            icon={KeyRound}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Min 8 characters with upper, lower, & number."
              required
              icon={Lock}
            />

            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              icon={Lock}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={pwLoading}
              icon={Lock}
            >
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
