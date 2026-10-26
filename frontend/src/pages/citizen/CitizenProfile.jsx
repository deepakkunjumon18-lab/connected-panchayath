import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { User, Shield, Lock, Save, KeyRound, Building, Phone, Mail, CreditCard, Calendar } from 'lucide-react';

export default function CitizenProfile() {
  const { user, refreshUser } = useAuth();

  // Profile Form state
  const [profileLoading, setProfileLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Password Form state
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setAddress(user.address || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const res = await axios.put('/api/auth/profile', {
        email: email.trim(),
        address: address.trim()
      });

      if (res.data?.success) {
        toast.success('Profile details updated successfully');
        if (refreshUser) await refreshUser();
      } else {
        toast.error(res.data?.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('New password must contain uppercase, lowercase, and a digit');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await axios.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });

      if (res.data?.success) {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.data?.message || 'Failed to change password');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Current password incorrect or validation failed');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Citizen Profile"
        subtitle="Manage your personal details, home panchayat association, and account security."
      />

      {/* Profile Overview Card (Read-only official details) */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-line gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-2xl">
              {user?.full_name?.charAt(0) || 'C'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">{user?.full_name || 'Citizen'}</h2>
              <p className="text-sm text-ink-muted">Username: {user?.username || user?.mobile}</p>
            </div>
          </div>
          <Badge variant="info" size="md">
            Role: CITIZEN
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-ink-muted">Aadhaar Number</div>
              <div className="font-mono font-medium text-ink">
                {user?.aadhaar_no || 'XXXX XXXX 1234'}
              </div>
              <span className="text-[10px] text-ink-light">Masked for privacy</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-ink-muted">Home Panchayat</div>
              <div className="font-medium text-ink">
                {user?.panchayat_name || 'Assigned Panchayat'}
              </div>
              <span className="text-xs text-ink-light uppercase">
                {user?.panchayat_code}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-ink-muted">Registered Mobile</div>
              <div className="font-medium text-ink">{user?.mobile}</div>
            </div>
          </div>

          {user?.date_of_birth && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Date of Birth</div>
                <div className="font-medium text-ink">
                  {new Date(user.date_of_birth).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          )}

          {user?.gender && (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Gender</div>
                <div className="font-medium text-ink capitalize">
                  {user.gender.toLowerCase()}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Editable Contact Details Card */}
      <Card title="Update Contact Information">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="citizen@example.com"
            icon={Mail}
            helperText="Official notifications and issued certificate copies will be sent here."
          />

          <Textarea
            label="Residential Address"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter full address as per records"
            helperText="Permanent address within your registered Panchayat jurisdiction."
          />

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={profileLoading}
              icon={Save}
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Change Password Card */}
      <Card title="Security & Password">
        {passwordError && (
          <Alert
            type="danger"
            message={passwordError}
            className="mb-4"
          />
        )}

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
              icon={Shield}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="secondary"
              loading={passwordLoading}
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
