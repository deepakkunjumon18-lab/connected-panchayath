import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Checkbox from '../../components/ui/Checkbox';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import {
  FileCheck,
  Edit2,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
  FileText,
  Users
} from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'IDENTITY_PROOF', label: 'Identity Proof (Aadhaar/Voter)' },
  { value: 'INCOME_CERTIFICATE', label: 'Income Certificate / Salary Slip' },
  { value: 'LAND_DOCUMENT', label: 'Land Deed / Tax Receipt' },
  { value: 'RATION_CARD', label: 'Ration Card' },
  { value: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
  { value: 'RESIDENCE_PROOF', label: 'Proof of Residence' },
  { value: 'OTHER', label: 'Other Document' }
];

const RELATED_TO_OPTIONS = [
  { value: 'APPLICANT', label: 'Applicant' },
  { value: 'FATHER', label: "Father" },
  { value: 'MOTHER', label: "Mother" },
  { value: 'PROPERTY', label: 'Property Asset' }
];

const PARTY_CHOICES = [
  { id: 'FATHER', label: "Father's Home Panchayat", desc: "Cross-verify father's income and residence in their registered Panchayat" },
  { id: 'MOTHER', label: "Mother's Home Panchayat", desc: "Cross-verify mother's income and residence in their registered Panchayat" },
  { id: 'PROPERTY', label: "Property Panchayat", desc: "Cross-verify land/building assets in the Panchayat where property is situated" }
];

export default function AdminCertificateTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // Form Fields
  const [typeName, setTypeName] = useState('');
  const [description, setDescription] = useState('');
  const [validityMonths, setValidityMonths] = useState(12);
  const [status, setStatus] = useState('ACTIVE');

  // Visual Builder: Required Documents
  const [requiredDocs, setRequiredDocs] = useState([]);

  // Visual Builder: Verification Parties
  const [verificationParties, setVerificationParties] = useState([]);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/certificate-types');
      if (res.data?.success && res.data?.data) {
        setTypes(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load certificate types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const openEditModal = (t) => {
    setEditingType(t);
    setTypeName(t.name || t.certificate_name || '');
    setDescription(t.description || '');
    setValidityMonths(t.validity_months || 12);
    setStatus(t.status || 'ACTIVE');

    // Parse required_documents safely
    let docs = [];
    if (typeof t.required_documents === 'string') {
      try {
        docs = JSON.parse(t.required_documents);
      } catch (e) {
        docs = [];
      }
    } else if (Array.isArray(t.required_documents)) {
      docs = [...t.required_documents];
    }
    setRequiredDocs(docs);

    // Parse verification_parties safely
    let parties = [];
    if (typeof t.verification_parties === 'string') {
      try {
        parties = JSON.parse(t.verification_parties);
      } catch (e) {
        parties = [];
      }
    } else if (Array.isArray(t.verification_parties)) {
      parties = [...t.verification_parties];
    }
    setVerificationParties(parties);

    setModalOpen(true);
  };

  const handleAddDocRow = () => {
    setRequiredDocs([
      ...requiredDocs,
      {
        type: 'IDENTITY_PROOF',
        label: '',
        related_to: 'APPLICANT',
        mandatory: true
      }
    ]);
  };

  const handleRemoveDocRow = (index) => {
    setRequiredDocs(requiredDocs.filter((_, i) => i !== index));
  };

  const handleDocChange = (index, field, value) => {
    const updated = [...requiredDocs];
    updated[index] = { ...updated[index], [field]: value };
    setRequiredDocs(updated);
  };

  const toggleParty = (partyId) => {
    if (verificationParties.includes(partyId)) {
      setVerificationParties(verificationParties.filter((p) => p !== partyId));
    } else {
      setVerificationParties([...verificationParties, partyId]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingType) return;
    setSaveLoading(true);

    try {
      const payload = {
        name: typeName.trim(),
        description: description.trim(),
        validity_months: Number(validityMonths) || 12,
        status,
        required_documents: requiredDocs,
        verification_parties: verificationParties
      };

      const id = editingType.certificate_type_id || editingType.type_id;
      const res = await axios.put(`/api/admin/certificate-types/${id}`, payload);
      if (res.data?.success) {
        toast.success('Certificate type configuration updated');
        setModalOpen(false);
        fetchTypes();
      } else {
        toast.error(res.data?.message || 'Update failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update certificate type');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate Types"
        subtitle="Configure government certificates, document checklist schemas, and cross-panchayat verification rules."
      />

      {/* Grid of Certificate Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {types.map((t) => {
          let docs = [];
          try {
            docs = typeof t.required_documents === 'string' ? JSON.parse(t.required_documents) : t.required_documents || [];
          } catch (e) {
            docs = [];
          }

          let parties = [];
          try {
            parties = typeof t.verification_parties === 'string' ? JSON.parse(t.verification_parties) : t.verification_parties || [];
          } catch (e) {
            parties = [];
          }

          return (
            <Card key={t.certificate_type_id || t.type_id} className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-line">
                  <div>
                    <span className="font-mono text-xs font-semibold text-primary-600 uppercase bg-primary-50 px-2 py-0.5 rounded">
                      {t.certificate_code || t.code}
                    </span>
                    <h3 className="text-xl font-bold text-ink mt-1">
                      {t.name || t.certificate_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Edit Configuration"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-ink-muted my-4">
                  {t.description || 'No description provided.'}
                </p>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Clock className="w-4 h-4 text-ink-light" />
                    <span>Validity Period: <strong className="text-ink">{t.validity_months} Months</strong></span>
                  </div>

                  <div className="flex items-start gap-2 text-ink-muted">
                    <FileText className="w-4 h-4 text-ink-light mt-0.5" />
                    <div>
                      <span className="font-medium text-ink">Required Documents ({docs.length}):</span>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-ink-light">
                        {docs.map((d, i) => (
                          <li key={i}>
                            {d.label || d.type} {d.mandatory ? '(Mandatory)' : '(Optional)'} — <span className="font-semibold text-ink">{d.related_to}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-ink-muted">
                    <Users className="w-4 h-4 text-ink-light mt-0.5" />
                    <div>
                      <span className="font-medium text-ink">Cross-Verification Parties:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parties.length > 0 ? (
                          parties.map((p, i) => (
                            <Badge key={i} variant="purple" size="sm">
                              {p}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[11px] text-ink-light">None (Local only)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-line flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Edit2}
                  onClick={() => openEditModal(t)}
                >
                  Configure Schema
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* EDIT CERTIFICATE TYPE MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Configure: ${editingType?.name || editingType?.certificate_name}`}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Certificate Name"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Validity (Months)"
                type="number"
                min="1"
                max="120"
                value={validityMonths}
                onChange={(e) => setValidityMonths(e.target.value)}
                required
              />

              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' }
                ]}
              />
            </div>

            <div className="sm:col-span-2">
              <Textarea
                label="Description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* VISUAL BUILDER: Required Documents */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-line space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-ink text-sm">Required Document Checklist</h4>
                <p className="text-xs text-ink-muted">
                  Configure documents citizens must attach during application submission.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={handleAddDocRow}
              >
                Add Document
              </Button>
            </div>

            {requiredDocs.length === 0 ? (
              <p className="text-xs text-ink-light italic py-2">No required documents configured yet.</p>
            ) : (
              <div className="space-y-2.5">
                {requiredDocs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-line flex flex-col md:flex-row items-center gap-3"
                  >
                    <div className="w-full md:w-1/3">
                      <Select
                        label="Document Type"
                        value={doc.type}
                        onChange={(e) => handleDocChange(idx, 'type', e.target.value)}
                        options={DOCUMENT_TYPES}
                      />
                    </div>

                    <div className="w-full md:w-1/3">
                      <Input
                        label="Label / Instruction"
                        placeholder="e.g. Applicant Aadhaar Card"
                        value={doc.label}
                        onChange={(e) => handleDocChange(idx, 'label', e.target.value)}
                        required
                      />
                    </div>

                    <div className="w-full md:w-1/4">
                      <Select
                        label="Related To"
                        value={doc.related_to}
                        onChange={(e) => handleDocChange(idx, 'related_to', e.target.value)}
                        options={RELATED_TO_OPTIONS}
                      />
                    </div>

                    <div className="flex items-center justify-between md:justify-center gap-3 w-full md:w-auto pt-2 md:pt-4">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={doc.mandatory}
                          onChange={(e) => handleDocChange(idx, 'mandatory', e.target.checked)}
                          className="rounded text-primary-600 focus:ring-primary-500"
                        />
                        <span>Mandatory</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveDocRow(idx)}
                        className="p-1.5 text-danger-500 hover:text-danger-700 hover:bg-danger-50 rounded-lg transition"
                        title="Delete Document Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VISUAL BUILDER: Verification Parties */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-line space-y-3">
            <div>
              <h4 className="font-bold text-ink text-sm">Inter-Panchayat Verification Parties</h4>
              <p className="text-xs text-ink-muted">
                Select which parties require mandatory cross-verification from other Panchayats.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PARTY_CHOICES.map((party) => {
                const checked = verificationParties.includes(party.id);
                return (
                  <div
                    key={party.id}
                    onClick={() => toggleParty(party.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      checked
                        ? 'bg-primary-50 border-primary-400 text-primary-950'
                        : 'bg-white border-line text-ink hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} // handled by div
                      className="mt-0.5 rounded text-primary-600 focus:ring-primary-500 pointer-events-none"
                    />
                    <div>
                      <div className="font-semibold text-xs">{party.label}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                        {party.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
              loading={saveLoading}
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
