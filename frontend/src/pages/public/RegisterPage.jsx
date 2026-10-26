import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, ArrowRight, UserPlus, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { panchayatsApi } from '../../api/panchayats';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Card from '../../components/ui/Card';

export default function RegisterPage() {
  const { register } = useAuth();
  const [panchayats, setPanchayats] = useState([]);
  const [loadingPanchayats, setLoadingPanchayats] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    full_name: '',
    mobile: '',
    email: '',
    password: '',
    confirm_password: '',
    aadhaar_no: '',
    date_of_birth: '',
    gender: 'MALE',
    address: '',
    panchayat_id: ''
  });

  useEffect(() => {
    async function loadPanchayats() {
      try {
        const res = await panchayatsApi.getPublic();
        if (res.success && res.data) {
          setPanchayats(res.data);
        }
      } catch (err) {
        console.error('Failed to load panchayats:', err);
      } finally {
        setLoadingPanchayats(false);
      }
    }
    loadPanchayats();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!/^[6-9]\d{9}$/.test(formData.mobile)) {
      newErrors.mobile = 'Enter a valid 10-digit Indian mobile starting with 6-9';
    }
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!formData.password || formData.password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Must be at least 8 chars with uppercase, lowercase, and digit';
    }
    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }
    if (!/^\d{12}$/.test(formData.aadhaar_no)) {
      newErrors.aadhaar_no = 'Aadhaar must be exactly 12 digits';
    }
    if (!formData.date_of_birth) {
      newErrors.date_of_birth = 'Date of birth is required';
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Residential address is required';
    }
    if (!formData.panchayat_id) {
      newErrors.panchayat_id = 'Please select your home panchayat';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const payload = {
      full_name: formData.full_name.trim(),
      mobile: formData.mobile.trim(),
      email: formData.email.trim(),
      password: formData.password,
      aadhaar_no: formData.aadhaar_no.trim(),
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      address: formData.address.trim(),
      panchayat_id: Number(formData.panchayat_id)
    };

    const res = await register(payload);
    if (!res.success && res.errors) {
      setErrors(res.errors);
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Card className="p-6 sm:p-10">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-line">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </span>
              <h2 className="text-2xl font-bold text-ink">Citizen Registration</h2>
            </div>
            <p className="text-sm text-muted mt-1">
              Create an account with your Home Panchayat to apply for certificates.
            </p>
          </div>
          <Link to="/login" className="text-xs text-primary-600 hover:underline font-medium hidden sm:block">
            Already registered? Sign In
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal Details */}
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
              1. Personal Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Full Name (as per Aadhaar)"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Akhil K S"
                  error={errors.full_name}
                  required
                />
              </div>

              <Input
                label="Date of Birth"
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                error={errors.date_of_birth}
                required
              />

              <Select
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'OTHER', label: 'Other' }
                ]}
                placeholder=""
                required
              />

              <Input
                label="Aadhaar Number (12 digits)"
                name="aadhaar_no"
                value={formData.aadhaar_no}
                onChange={handleChange}
                placeholder="123456789012"
                maxLength={12}
                error={errors.aadhaar_no}
                required
              />

              <Select
                label="Home Grama Panchayat"
                name="panchayat_id"
                value={formData.panchayat_id}
                onChange={handleChange}
                placeholder={loadingPanchayats ? 'Loading panchayats...' : 'Select your home panchayat'}
                options={panchayats.map((p) => ({
                  value: String(p.panchayat_id),
                  label: `${p.panchayat_name} (${p.panchayat_code}) — ${p.district}`
                }))}
                error={errors.panchayat_id}
                required
              />
            </div>
          </div>

          {/* Section 2: Contact & Address */}
          <div className="pt-4 border-t border-line">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
              2. Contact & Residential Address
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mobile Number (Login ID)"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="9876500001"
                maxLength={10}
                error={errors.mobile}
                required
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                error={errors.email}
                required
              />

              <div className="sm:col-span-2">
                <Textarea
                  label="Permanent Address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="House Name, Post Office, Village, District, PIN..."
                  error={errors.address}
                  rows={2}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: Account Password */}
          <div className="pt-4 border-t border-line">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
              3. Set Password
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                helperText="Must include uppercase, lowercase, and number"
                error={errors.password}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                placeholder="Re-enter password"
                error={errors.confirm_password}
                required
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted">
              By registering, you agree all declared information corresponds to Kerala local records.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              icon={ArrowRight}
              iconPosition="right"
              className="w-full sm:w-auto shrink-0"
            >
              Complete Registration
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
