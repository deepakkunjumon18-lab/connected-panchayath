import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import toast from 'react-hot-toast';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Power,
  MapPin,
  Phone
} from 'lucide-react';

const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad'
];

export default function AdminPanchayats() {
  const [panchayats, setPanchayats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPanchayat, setSelectedPanchayat] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Status toggle confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [targetPanchayat, setTargetPanchayat] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    panchayat_name: '',
    panchayat_code: '',
    district: 'Kollam',
    state: 'Kerala',
    address: '',
    contact_no: ''
  });

  const fetchPanchayats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/panchayats');
      if (res.data?.success && res.data?.data) {
        setPanchayats(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch panchayats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanchayats();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedPanchayat(null);
    setFormData({
      panchayat_name: '',
      panchayat_code: '',
      district: 'Kollam',
      state: 'Kerala',
      address: '',
      contact_no: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    setIsEditing(true);
    setSelectedPanchayat(p);
    setFormData({
      panchayat_name: p.panchayat_name || '',
      panchayat_code: p.panchayat_code || '',
      district: p.district || 'Kollam',
      state: p.state || 'Kerala',
      address: p.address || '',
      contact_no: p.contact_no || ''
    });
    setModalOpen(true);
  };

  const handleSavePanchayat = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (isEditing) {
        const res = await axios.put(`/api/admin/panchayats/${selectedPanchayat.panchayat_id}`, {
          panchayat_name: formData.panchayat_name.trim(),
          district: formData.district,
          state: formData.state,
          address: formData.address.trim(),
          contact_no: formData.contact_no.trim()
        });
        if (res.data?.success) {
          toast.success('Panchayat updated successfully');
          setModalOpen(false);
          fetchPanchayats();
        } else {
          toast.error(res.data?.message || 'Update failed');
        }
      } else {
        const res = await axios.post('/api/admin/panchayats', {
          panchayat_name: formData.panchayat_name.trim(),
          panchayat_code: formData.panchayat_code.trim().toUpperCase(),
          district: formData.district,
          state: formData.state,
          address: formData.address.trim(),
          contact_no: formData.contact_no.trim()
        });
        if (res.data?.success) {
          toast.success('Panchayat added successfully');
          setModalOpen(false);
          fetchPanchayats();
        } else {
          toast.error(res.data?.message || 'Creation failed');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!targetPanchayat) return;
    setStatusLoading(true);
    const newStatus = targetPanchayat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      const res = await axios.patch(`/api/admin/panchayats/${targetPanchayat.panchayat_id}/status`, {
        status: newStatus
      });
      if (res.data?.success) {
        toast.success(`Panchayat ${newStatus.toLowerCase()}`);
        setConfirmOpen(false);
        fetchPanchayats();
      } else {
        toast.error(res.data?.message || 'Status update failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    } finally {
      setStatusLoading(false);
    }
  };

  const filtered = panchayats.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.panchayat_name?.toLowerCase().includes(q) ||
      p.panchayat_code?.toLowerCase().includes(q) ||
      p.district?.toLowerCase().includes(q);
    const matchesDistrict = !districtFilter || p.district === districtFilter;
    return matchesSearch && matchesDistrict;
  });

  const columns = [
    {
      header: 'Panchayat Name',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.panchayat_name}</div>
          <div className="text-xs text-ink-muted flex items-center gap-1">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-ink-light">
              {row.panchayat_code}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'District / State',
      accessor: (row) => (
        <div className="text-sm">
          <div className="text-ink font-medium">{row.district}</div>
          <div className="text-xs text-ink-muted">{row.state}</div>
        </div>
      )
    },
    {
      header: 'Contact & Office',
      accessor: (row) => (
        <div className="text-xs text-ink-muted space-y-0.5 max-w-xs">
          {row.contact_no && (
            <div className="flex items-center gap-1 text-ink">
              <Phone className="w-3 h-3 text-ink-light" />
              <span>{row.contact_no}</span>
            </div>
          )}
          <div className="truncate" title={row.address}>
            {row.address}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />
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
              setTargetPanchayat(row);
              setConfirmOpen(true);
            }}
            className={`p-1.5 rounded-lg transition ${
              row.status === 'ACTIVE'
                ? 'text-ink-muted hover:text-danger-600 hover:bg-danger-50'
                : 'text-ink-muted hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.status === 'ACTIVE' ? 'Deactivate Panchayat' : 'Activate Panchayat'}
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
        title="Panchayat Registry"
        subtitle="Configure participating Grama Panchayats in the cross-verification network."
        action={
          <Button variant="primary" icon={Plus} onClick={openCreateModal}>
            Add Panchayat
          </Button>
        }
      />

      {/* Filter toolbar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search panchayat name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />

          <Select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            options={[
              { value: '', label: 'All Districts' },
              ...KERALA_DISTRICTS.map((d) => ({ value: d, label: d }))
            ]}
          />
        </div>
      </Card>

      {/* Table Card */}
      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          keyExtractor={(row) => row.panchayat_id}
          emptyText="No panchayats found matching your filter."
        />
      </Card>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? `Edit Panchayat: ${selectedPanchayat?.panchayat_name}` : 'Add Grama Panchayat'}
      >
        <form onSubmit={handleSavePanchayat} className="space-y-4">
          <Input
            label="Panchayat Name"
            placeholder="e.g. Kollam Grama Panchayat"
            value={formData.panchayat_name}
            onChange={(e) => setFormData({ ...formData, panchayat_name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Panchayat Code"
              placeholder="e.g. KLM"
              value={formData.panchayat_code}
              onChange={(e) => setFormData({ ...formData, panchayat_code: e.target.value })}
              required
              disabled={isEditing}
              helperText={isEditing ? 'Code cannot be altered once registered' : 'Unique 3-10 uppercase chars'}
            />

            <Select
              label="District"
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              options={KERALA_DISTRICTS.map((d) => ({ value: d, label: d }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Phone"
              placeholder="e.g. 0474-2741234"
              value={formData.contact_no}
              onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
            />

            <Input
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Office Address"
            rows={2}
            placeholder="Main office street and landmark"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-line">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={formLoading}
            >
              {isEditing ? 'Save Changes' : 'Add Panchayat'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM STATUS TOGGLE */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        loading={statusLoading}
        title={targetPanchayat?.status === 'ACTIVE' ? 'Deactivate Panchayat' : 'Activate Panchayat'}
        message={`Are you sure you want to ${
          targetPanchayat?.status === 'ACTIVE' ? 'deactivate' : 'activate'
        } "${targetPanchayat?.panchayat_name}"?`}
        confirmText={targetPanchayat?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        variant={targetPanchayat?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />
    </div>
  );
}
