import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import {
  Database,
  Plus,
  Search,
  Edit2,
  Power,
  Layers,
  Sliders
} from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'SETTING', label: 'System Settings & SLA' },
  { value: 'PURPOSE', label: 'Application Purposes' },
  { value: 'OCCUPATION', label: 'Occupations' },
  { value: 'DOCUMENT_TYPE', label: 'Document Types' },
  { value: 'RELATION', label: 'Family Relations' }
];

export default function AdminMasterData() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Status toggle
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [targetItem, setTargetItem] = useState(null);

  // Form
  const [formData, setFormData] = useState({
    category: 'PURPOSE',
    code: '',
    value: '',
    description: ''
  });

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const url = selectedCategory
        ? `/api/admin/master-data?category=${encodeURIComponent(selectedCategory)}`
        : '/api/admin/master-data';
      const res = await axios.get(url);
      if (res.data?.success && res.data?.data) {
        setItems(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load master data items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [selectedCategory]);

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedItem(null);
    setFormData({
      category: selectedCategory || 'PURPOSE',
      code: '',
      value: '',
      description: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditing(true);
    setSelectedItem(item);
    setFormData({
      category: item.category,
      code: item.code || item.item_code || '',
      value: item.value || item.item_value || item.item_name || '',
      description: item.description || ''
    });
    setModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (isEditing) {
        const id = selectedItem.master_id || selectedItem.id;
        const res = await axios.put(`/api/admin/master-data/${id}`, {
          value: formData.value.trim(),
          description: formData.description.trim()
        });
        if (res.data?.success) {
          toast.success('Master data item updated');
          setModalOpen(false);
          fetchMasterData();
        } else {
          toast.error(res.data?.message || 'Update failed');
        }
      } else {
        const res = await axios.post('/api/admin/master-data', {
          category: formData.category,
          code: formData.code.trim().toUpperCase(),
          value: formData.value.trim(),
          description: formData.description.trim()
        });
        if (res.data?.success) {
          toast.success('Master data item added');
          setModalOpen(false);
          fetchMasterData();
        } else {
          toast.error(res.data?.message || 'Creation failed');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!targetItem) return;
    setStatusLoading(true);
    const newStatus = targetItem.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const id = targetItem.master_id || targetItem.id;

    try {
      const res = await axios.patch(`/api/admin/master-data/${id}/status`, {
        status: newStatus
      });
      if (res.data?.success) {
        toast.success(`Item ${newStatus.toLowerCase()}`);
        setConfirmOpen(false);
        fetchMasterData();
      } else {
        toast.error(res.data?.message || 'Status update failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    } finally {
      setStatusLoading(false);
    }
  };

  const filtered = items.filter((it) => {
    const q = search.toLowerCase();
    const code = it.code || it.item_code || '';
    const val = it.value || it.item_value || it.item_name || '';
    const cat = it.category || '';
    const desc = it.description || '';
    return (
      code.toLowerCase().includes(q) ||
      val.toLowerCase().includes(q) ||
      cat.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      header: 'Category',
      accessor: (row) => (
        <Badge variant="purple" size="sm">
          {row.category}
        </Badge>
      )
    },
    {
      header: 'Code / Key',
      accessor: (row) => (
        <span className="font-mono text-xs font-semibold text-ink bg-slate-100 px-2 py-0.5 rounded">
          {row.code || row.item_code}
        </span>
      )
    },
    {
      header: 'Value / Label',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-ink text-sm">
            {row.value || row.item_name || row.item_value}
          </div>
          {row.description && (
            <div className="text-xs text-ink-muted truncate max-w-xs">{row.description}</div>
          )}
        </div>
      )
    },
    {
      header: 'Description',
      accessor: (row) => (
        <span className="text-xs text-ink-muted">
          {row.description || '—'}
        </span>
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
            title="Edit Item"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setTargetItem(row);
              setConfirmOpen(true);
            }}
            className={`p-1.5 rounded-lg transition ${
              row.status === 'ACTIVE'
                ? 'text-ink-muted hover:text-danger-600 hover:bg-danger-50'
                : 'text-ink-muted hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.status === 'ACTIVE' ? 'Deactivate Item' : 'Activate Item'}
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
        title="Master Data & Parameters"
        subtitle="Manage system-wide dropdown categories, application purposes, and SLA configuration settings."
        action={
          <Button variant="primary" icon={Plus} onClick={openCreateModal}>
            Add Item
          </Button>
        }
      />

      {/* Filter toolbar */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search by code, label or value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />

          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={CATEGORIES}
          />
        </div>
      </Card>

      {/* Master Data Table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          keyExtractor={(row) => row.master_id || row.id}
          emptyText="No master data items found for the selected category."
        />
      </Card>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? `Edit Master Data: ${selectedItem?.code || selectedItem?.item_code}` : 'Add Master Data Item'}
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={CATEGORIES.filter((c) => c.value)}
              disabled={isEditing}
              required
            />

            <Input
              label="Item Code (Key)"
              placeholder="e.g. OVERDUE_DAYS"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
              disabled={isEditing}
              helperText={isEditing ? 'Code cannot be altered' : 'Unique identifier for logic'}
            />
          </div>

          <div>
            <Input
              label="Value / Label"
              placeholder="e.g. 3 or Education / Admission"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              required
            />
          </div>

          <Textarea
            label="Description / Context"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              {isEditing ? 'Save Changes' : 'Add Item'}
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
        title={targetItem?.status === 'ACTIVE' ? 'Deactivate Master Data Item' : 'Activate Item'}
        message={`Are you sure you want to ${
          targetItem?.status === 'ACTIVE' ? 'deactivate' : 'activate'
        } "${targetItem?.code || targetItem?.value || targetItem?.item_name}"?`}
        confirmText={targetItem?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        variant={targetItem?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />
    </div>
  );
}
