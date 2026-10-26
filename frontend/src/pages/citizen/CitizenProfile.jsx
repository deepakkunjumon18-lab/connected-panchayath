import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { User, Shield, Lock, Save, KeyRound, Building, Phone, Mail, CreditCard, Calendar, Home } from 'lucide-react';

export default function CitizenProfile() {
  const { user, refreshUser } = useAuth();

  // Profile Form state
  const [profileLoading, setProfileLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Password Form state
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Refresh user data from API on component mount
  useEffect(() => {
    if (refreshUser) {
      refreshUser();
    }
  }, []);

  // Sync form inputs when user context changes
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setAddress(user.address || '');
      setGender(user.gender || '');
      if (user.date_of_birth) {
        try {
          const d = new Date(user.date_of_birth);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setDateOfBirth(`${yyyy}-${mm}-${dd}`);
          } else {
            setDateOfBirth(String(user.date_of_birth).slice(0, 10));
          }
        } catch {
          setDateOfBirth(String(user.date_of_birth).slice(0, 10));
        }
      } else {
        setDateOfBirth('');
      }
    }
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const payload = {
        email: email.trim(),
        address: address.trim(),
        gender: gender || undefined,
        date_of_birth: dateOfBirth || undefined
      };

      const res = await axios.put('/api/auth/profile', payload);

      // Handle axios interceptor data unpacking: res can be unpacked user profile or standard envelope
      const isSuccess = Boolean(
        res?.success ||
        res?.user_id ||
        res?.data?.success ||
        res?.data?.user_id ||
        (res && typeof res === 'object' && !res.error && !res.response)
      );

      if (isSuccess) {
        toast.success('Profile details updated successfully');
        if (refreshUser) await refreshUser();
      } else {
        toast.error(res?.message || res?.data?.message || 'Failed to update profile');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update profile');
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

      const isSuccess = Boolean(
        res?.success ||
        res?.data?.success ||
        (res && typeof res === 'object' && !res.error && !res.response)
      );

      if (isSuccess) {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res?.message || res?.data?.message || 'Failed to change password');
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
                {user?.aadhaar_masked || user?.aadhaar_no || 'XXXX XXXX 1234'}
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
              <div className="font-medium text-ink">{user?.mobile || '—'}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-ink-muted">Date of Birth</div>
              <div className="font-medium text-ink">
                {user?.date_of_birth
                  ? new Date(user.date_of_birth).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Not specified'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-ink-muted">Gender</div>
              <div className="font-medium text-ink capitalize">
                {user?.gender ? user.gender.toLowerCase() : 'Not specified'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-ink-muted">Email Address</div>
              <div className="font-medium text-ink truncate max-w-[200px]">
                {user?.email || 'Not specified'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 sm:col-span-2 lg:col-span-3 pt-3 border-t border-line">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Home className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-ink-muted">Registered Address</div>
              <div className="font-medium text-ink text-sm mt-0.5">
                {user?.address || 'Not specified'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Editable Contact Details Card */}
      <Card title="Update Personal & Contact Information">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="citizen@example.com"
              icon={Mail}
              helperText="Official notifications will be sent here."
            />

            <Select
              label="Gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              options={[
                { value: '', label: 'Select Gender...' },
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER', label: 'Other' }
              ]}
              helperText="Official gender as per Aadhaar/records."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              icon={Calendar}
              helperText="Format: YYYY-MM-DD"
            />
          </div>

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
