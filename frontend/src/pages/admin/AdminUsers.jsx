import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/ui/Badge';
import Tooltip from '../../components/ui/Tooltip';
import toast from 'react-hot-toast';
import {
  UserPlus,
  Search,
  Shield,
  Key,
  Edit2,
  Power,
  RotateCcw,
  CheckCircle2,
  Copy,
  Info
} from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [panchayatFilter, setPanchayatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Options
  const [panchayats, setPanchayats] = useState([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createdKeyFingerprint, setCreatedKeyFingerprint] = useState(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusTargetUser, setStatusTargetUser] = useState(null);

  // Create form state
  const [createRole, setCreateRole] = useState('OFFICER');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    mobile: '',
    panchayat_id: '',
    designation: 'Panchayat Secretary',
    employee_id: '',
    aadhaar_no: '',
    date_of_birth: '',
    gender: 'MALE',
    address: ''
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    mobile: '',
    designation: '',
    employee_id: '',
    address: ''
  });

  // Fetch panchayats list for dropdowns
  const fetchPanchayats = async () => {
    try {
      const res = await axios.get('/api/panchayats/public');
      if (res.data?.success && res.data?.data) {
        setPanchayats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load panchayats:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(panchayatFilter && { panchayat_id: panchayatFilter }),
        ...(statusFilter && { status: statusFilter })
      });

      const res = await axios.get(`/api/admin/users?${params.toString()}`);
      if (res.data?.success && res.data?.data) {
        setUsers(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      }
    } catch (err) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanchayats();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, limit, roleFilter, panchayatFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const payload = {
        role: createRole,
        username: formData.username.trim(),
        password: formData.password,
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim(),
        panchayat_id: formData.panchayat_id ? Number(formData.panchayat_id) : undefined,
        ...(createRole === 'OFFICER' && {
          designation: formData.designation.trim(),
          employee_id: formData.employee_id.trim()
        }),
        ...(createRole === 'CITIZEN' && {
          aadhaar_no: formData.aadhaar_no.trim(),
          date_of_birth: formData.date_of_birth,
          gender: formData.gender,
          address: formData.address.trim()
        })
      };

      const res = await axios.post('/api/admin/users', payload);
      if (res.data?.success) {
        toast.success(`User ${formData.username} created successfully`);
        if (createRole === 'OFFICER' && res.data.data?.key_fingerprint) {
          setCreatedKeyFingerprint(res.data.data.key_fingerprint);
        } else {
          setCreateModalOpen(false);
        }
        fetchUsers();
      } else {
        toast.error(res.data?.message || 'Failed to create user');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      mobile: user.mobile || '',
      designation: user.designation || '',
      employee_id: user.employee_id || '',
      address: user.address || ''
    });
    setEditModalOpen(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);

    try {
      const res = await axios.put(`/api/admin/users/${editingUser.user_id}`, editFormData);
      if (res.data?.success) {
        toast.success('User details updated');
        setEditModalOpen(false);
        fetchUsers();
      } else {
        toast.error(res.data?.message || 'Failed to update user');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setResetLoading(true);
    try {
      const res = await axios.post(`/api/admin/users/${resetTargetUser.user_id}/reset-password`, {
        new_password: newPassword
      });
      if (res.data?.success) {
        toast.success(`Password reset for ${resetTargetUser.username}`);
        setResetModalOpen(false);
        setNewPassword('');
      } else {
        toast.error(res.data?.message || 'Failed to reset password');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTargetUser) return;
    setStatusLoading(true);
    const newStatus = statusTargetUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      const res = await axios.patch(`/api/admin/users/${statusTargetUser.user_id}/status`, {
        status: newStatus
      });
      if (res.data?.success) {
        toast.success(`User account ${newStatus.toLowerCase()}`);
        setStatusConfirmOpen(false);
        fetchUsers();
      } else {
        toast.error(res.data?.message || 'Failed to update status');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const columns = [
    {
      header: 'User / Name',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.full_name || row.username}</div>
          <div className="text-xs text-ink-muted">@{row.username}</div>
          {row.employee_id && (
            <span className="text-[11px] text-ink-light">Emp ID: {row.employee_id}</span>
          )}
        </div>
      )
    },
    {
      header: 'Role',
      accessor: (row) => {
        const variants = {
          ADMIN: 'danger',
          OFFICER: 'warning',
          CITIZEN: 'info'
        };
        return (
          <Badge variant={variants[row.role_name] || 'neutral'} size="sm">
            {row.role_name}
          </Badge>
        );
      }
    },
    {
      header: 'Panchayat',
      accessor: (row) => (
        <span className="text-sm text-ink">
          {row.panchayat_name ? (
            <div>
              <div className="font-medium">{row.panchayat_name}</div>
              <span className="text-xs text-ink-light">{row.panchayat_code}</span>
            </div>
          ) : (
            <span className="text-ink-muted text-xs">—</span>
          )}
        </span>
      )
    },
    {
      header: 'Contact',
      accessor: (row) => (
        <div className="text-xs text-ink space-y-0.5">
          <div>{row.mobile}</div>
          <div className="text-ink-muted">{row.email}</div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Signature Key',
      accessor: (row) => {
        if (row.role_name !== 'OFFICER') {
          return <span className="text-xs text-ink-light">N/A</span>;
        }
        return row.key_fingerprint ? (
          <Tooltip content={`Full SHA-256: ${row.key_fingerprint}`}>
            <span className="font-mono text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-primary-700 cursor-pointer">
              {row.key_fingerprint.slice(0, 12)}...
            </span>
          </Tooltip>
        ) : (
          <span className="text-xs text-danger-600">Pending</span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
            title="Edit Details"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setResetTargetUser(row);
              setNewPassword('');
              setResetModalOpen(true);
            }}
            className="p-1.5 text-ink-muted hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
            title="Reset Password"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setStatusTargetUser(row);
              setStatusConfirmOpen(true);
            }}
            className={`p-1.5 rounded-lg transition ${
              row.status === 'ACTIVE'
                ? 'text-ink-muted hover:text-danger-600 hover:bg-danger-50'
                : 'text-ink-muted hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Accounts"
        subtitle="Provision and manage Panchayat officers, RSA cryptographic keys, and registered citizens."
        action={
          <Button
            variant="primary"
            icon={UserPlus}
            onClick={() => {
              setCreatedKeyFingerprint(null);
              setCreateModalOpen(true);
            }}
          >
            Create User
          </Button>
        }
      />

      {/* Filter Toolbar Card */}
      <Card>
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Input
            placeholder="Search name, username, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />

          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'OFFICER', label: 'Officer' },
              { value: 'CITIZEN', label: 'Citizen' },
              { value: 'ADMIN', label: 'Admin' }
            ]}
          />

          <Select
            value={panchayatFilter}
            onChange={(e) => {
              setPanchayatFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Panchayats' },
              ...panchayats.map((p) => ({
                value: p.panchayat_id,
                label: p.panchayat_name
              }))
            ]}
          />

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' }
            ]}
          />

          <Button type="submit" variant="secondary" icon={Search}>
            Filter
          </Button>
        </form>
      </Card>

      {/* Users Table Card */}
      <Card padding="none">
        <Table
          columns={columns}
          data={users}
          loading={loading}
          keyExtractor={(row) => row.user_id}
          emptyText="No users found matching your filters."
        />

        <div className="p-4 border-t border-line">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / limit) || 1}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setCreatedKeyFingerprint(null);
        }}
        title="Provision New User"
        size="lg"
      >
        {createdKeyFingerprint ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-emerald-950">Officer Key Generated</h4>
                <p className="text-xs text-emerald-800 mt-1">
                  An RSA-2048 cryptographic keypair was generated and encrypted into the secure keystore.
                </p>
                <div className="mt-3 p-2 bg-white rounded border border-emerald-300 font-mono text-xs text-emerald-900 break-all select-all">
                  {createdKeyFingerprint}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  setCreateModalOpen(false);
                  setCreatedKeyFingerprint(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl mb-4">
              {['OFFICER', 'CITIZEN', 'ADMIN'].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setCreateRole(r)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                    createRole === r
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="Official / Citizen Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />

              <Input
                label="Username"
                placeholder="e.g. deepak_k"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="Min 8 chars, 1 upper, 1 digit"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />

              <Input
                label="Mobile Number"
                placeholder="10-digit mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                required
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              {(createRole === 'OFFICER' || createRole === 'CITIZEN') && (
                <Select
                  label={createRole === 'OFFICER' ? 'Assigned Panchayat' : 'Home Panchayat'}
                  value={formData.panchayat_id}
                  onChange={(e) => setFormData({ ...formData, panchayat_id: e.target.value })}
                  options={[
                    { value: '', label: 'Select Panchayat' },
                    ...panchayats.map((p) => ({
                      value: p.panchayat_id,
                      label: `${p.panchayat_name} (${p.district})`
                    }))
                  ]}
                  required
                />
              )}
            </div>

            {/* Officer Specific Fields */}
            {createRole === 'OFFICER' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
                <Input
                  label="Employee ID"
                  placeholder="e.g. SEC-KLM-001"
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  required
                />
                <Input
                  label="Designation"
                  placeholder="e.g. Panchayat Secretary"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                />
                <div className="sm:col-span-2 p-3 bg-primary-50 rounded-xl text-xs text-primary-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Creating an officer will automatically generate an RSA-2048 keypair, encrypted with AES-256-GCM.
                  </span>
                </div>
              </div>
            )}

            {/* Citizen Specific Fields */}
            {createRole === 'CITIZEN' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line">
                <Input
                  label="Aadhaar Number"
                  placeholder="12 digits"
                  value={formData.aadhaar_no}
                  onChange={(e) => setFormData({ ...formData, aadhaar_no: e.target.value })}
                  required
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  required
                />
                <Select
                  label="Gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  options={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' }
                  ]}
                />
                <div className="sm:col-span-2">
                  <Textarea
                    label="Residential Address"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={createLoading}
              >
                Create Account
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit User: ${editingUser?.username}`}
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <Input
            label="Full Name"
            value={editFormData.full_name}
            onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />
            <Input
              label="Mobile Number"
              value={editFormData.mobile}
              onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
              required
            />
          </div>

          {editingUser?.role_name === 'OFFICER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Designation"
                value={editFormData.designation}
                onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
              />
              <Input
                label="Employee ID"
                value={editFormData.employee_id}
                onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
              />
            </div>
          )}

          {editingUser?.role_name === 'CITIZEN' && (
            <Textarea
              label="Residential Address"
              rows={2}
              value={editFormData.address}
              onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={editLoading}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Reset Password for ${resetTargetUser?.username}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-ink-muted">
            Set a new temporary password for this user. The password must be at least 8 characters and contain uppercase, lowercase, and a number.
          </p>

          <Input
            label="New Password"
            type="password"
            placeholder="Enter new strong password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={resetLoading}
            >
              Confirm Reset
            </Button>
          </div>
        </form>
      </Modal>

      {/* STATUS TOGGLE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={statusConfirmOpen}
        onClose={() => setStatusConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        loading={statusLoading}
        title={statusTargetUser?.status === 'ACTIVE' ? 'Deactivate User Account' : 'Activate User Account'}
        message={`Are you sure you want to ${
          statusTargetUser?.status === 'ACTIVE' ? 'deactivate' : 'activate'
        } user "${statusTargetUser?.username}"? ${
          statusTargetUser?.status === 'ACTIVE'
            ? 'The user will immediately be barred from logging into the portal.'
            : 'The user will regain full access to their dashboard.'
        }`}
        confirmText={statusTargetUser?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        variant={statusTargetUser?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />
    </div>
  );
}
