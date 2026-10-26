import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Send, 
  Search, 
  RefreshCw, 
  Clock, 
  ExternalLink, 
  Bell, 
  XCircle, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Tabs from '../../components/ui/Tabs';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { getApplications } from '../../api/applications';
import { 
  getVerificationRequests, 
  remindVerificationRequest, 
  cancelVerificationRequest,
  createVerificationRequest 
} from '../../api/verification';
import { getPanchayats } from '../../api/panchayats';
import { issueCertificate } from '../../api/certificates';

export default function OfficerApplications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('applications');

  // Applications Tab State
  const initialStatus = searchParams.get('status') || '';
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [appTotal, setAppTotal] = useState(0);
  const [appPage, setAppPage] = useState(1);
  const [appStatus, setAppStatus] = useState(initialStatus);
  const [appSearch, setAppSearch] = useState('');

  useEffect(() => {
    const qStatus = searchParams.get('status');
    if (qStatus !== null && qStatus !== appStatus) {
      setAppStatus(qStatus);
      setAppPage(1);
    }
  }, [searchParams]);

  // Outgoing Requests Tab State
  const [outgoing, setOutgoing] = useState([]);
  const [loadingOutgoing, setLoadingOutgoing] = useState(true);
  const [outTotal, setOutTotal] = useState(0);
  const [outPage, setOutPage] = useState(1);
  const [outStatus, setOutStatus] = useState('');
  const [outSearch, setOutSearch] = useState('');

  // Modals & Action States
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState({ open: false, request: null });
  const [newRequestModal, setNewRequestModal] = useState(false);
  const [activePanchayats, setActivePanchayats] = useState([]);
  const [quickIssueModal, setQuickIssueModal] = useState({ open: false, app: null });
  const [quickIssueLoading, setQuickIssueLoading] = useState(false);

  // New Request Form State
  const [newReqForm, setNewReqForm] = useState({
    application_id: '',
    verifying_panchayat_id: '',
    subject_party: 'FATHER',
    subject_name: '',
    subject_aadhaar: '',
    subject_details: '',
    purpose: '',
    request_details: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // 1. Fetch Applications
  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const res = await getApplications({
        page: appPage,
        limit: 10,
        status: appStatus || undefined,
        search: appSearch || undefined
      });
      const data = res.data || res;
      setApplications(data.items || []);
      setAppTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load applications');
    } finally {
      setLoadingApps(false);
    }
  };

  // 2. Fetch Outgoing Requests
  const fetchOutgoing = async () => {
    setLoadingOutgoing(true);
    try {
      const res = await getVerificationRequests({
        direction: 'outgoing',
        page: outPage,
        limit: 10,
        status: outStatus || undefined,
        search: outSearch || undefined
      });
      const data = res.data || res;
      setOutgoing(data.items || []);
      setOutTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load outgoing verification requests');
    } finally {
      setLoadingOutgoing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'applications') {
      fetchApplications();
    } else {
      fetchOutgoing();
    }
  }, [activeTab, appPage, appStatus, outPage, outStatus]);

  // Load active panchayats for new request modal
  const loadPanchayats = async () => {
    try {
      const res = await getPanchayats({ status: 'ACTIVE' });
      const items = res.data?.items || res.data || [];
      setActivePanchayats(items);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenNewRequest = () => {
    loadPanchayats();
    setNewReqForm({
      application_id: applications[0]?.application_id || '',
      verifying_panchayat_id: '',
      subject_party: 'FATHER',
      subject_name: '',
      subject_aadhaar: '',
      subject_details: '',
      purpose: '',
      request_details: ''
    });
    setFormErrors({});
    setNewRequestModal(true);
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!newReqForm.application_id) errors.application_id = 'Application is required';
    if (!newReqForm.verifying_panchayat_id) errors.verifying_panchayat_id = 'Target panchayat is required';
    if (!newReqForm.subject_name.trim()) errors.subject_name = 'Subject name is required';
    if (!newReqForm.purpose.trim()) errors.purpose = 'Purpose is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setActionLoading(true);
    try {
      await createVerificationRequest(newReqForm);
      toast.success('Verification request created and dispatched');
      setNewRequestModal(false);
      fetchOutgoing();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch verification request');
    } finally {
      setActionLoading(false);
    }
  };

  // Remind Request Action
  const handleRemind = async (reqItem) => {
    setActionLoading(true);
    try {
      const res = await remindVerificationRequest(reqItem.verification_id);
      toast.success(res.message || `Reminder dispatched to ${reqItem.verifying_panchayat_name}`);
      fetchOutgoing();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch reminder');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Request Action
  const handleCancelRequest = async () => {
    if (!cancelModal.request) return;
    setActionLoading(true);
    try {
      await cancelVerificationRequest(cancelModal.request.verification_id);
      toast.success(`Request ${cancelModal.request.request_no} cancelled`);
      setCancelModal({ open: false, request: null });
      fetchOutgoing();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Issue Certificate for Approved Applications
  const handleQuickIssueConfirm = async () => {
    if (!quickIssueModal.app) return;
    setQuickIssueLoading(true);
    try {
      await issueCertificate(quickIssueModal.app.application_id);
      toast.success(`Certificate issued for application ${quickIssueModal.app.application_no}!`);
      setQuickIssueModal({ open: false, app: null });
      fetchApplications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue certificate');
    } finally {
      setQuickIssueLoading(false);
    }
  };

  const tabs = [
    { id: 'applications', label: 'Home Applications', count: appTotal },
    { id: 'outgoing', label: 'Outgoing Requests', count: outTotal }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verify & Request"
        subtitle="Review applications submitted to your Panchayat and manage outbound verification requests to other Panchayats."
        action={
          activeTab === 'outgoing' && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleOpenNewRequest}
            >
              New Verification Request
            </Button>
          )
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ================= APPLICATIONS TAB ================= */}
      {activeTab === 'applications' && (
        <Card>
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <form 
                onSubmit={(e) => { e.preventDefault(); setAppPage(1); fetchApplications(); }}
                className="relative flex-1 max-w-md"
              >
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by app no, certificate, or applicant..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </form>

              <Select
                value={appStatus}
                onChange={(e) => { setAppStatus(e.target.value); setAppPage(1); }}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'SUBMITTED', label: 'Submitted' },
                  { value: 'PENDING_EXTERNAL', label: 'Pending External' },
                  { value: 'READY_FOR_DECISION', label: 'Ready for Decision' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                  { value: 'CERTIFICATE_ISSUED', label: 'Certificate Issued' }
                ]}
                className="sm:w-48"
              />
            </div>

            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchApplications}
              loading={loadingApps}
              size="sm"
            >
              Refresh
            </Button>
          </div>

          {/* Table */}
          <Table
            columns={[
              {
                header: 'Application No',
                accessor: 'application_no',
                render: (val, row) => (
                  <Link
                    to={`/officer/applications/${row.application_id}`}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {val}
                  </Link>
                )
              },
              {
                header: 'Certificate Type',
                accessor: 'certificate_name',
                render: (val, row) => (
                  <div>
                    <span className="font-medium text-slate-800">{val}</span>
                    <span className="block text-xs text-slate-500 font-mono">{row.certificate_code}</span>
                  </div>
                )
              },
              {
                header: 'Applicant',
                accessor: 'applicant_name'
              },
              {
                header: 'Submitted At',
                accessor: 'submitted_at',
                render: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '—'
              },
              {
                header: 'Inter-Panchayat Status',
                accessor: 'pending_requests_count',
                render: (val, row) => {
                  const totalReq = row.total_requests_count || 0;
                  if (totalReq === 0) {
                    return <span className="text-xs text-slate-500">Internal only</span>;
                  }
                  const pending = Number(val || 0);
                  const completed = totalReq - pending;
                  return (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      pending > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {completed}/{totalReq} verified
                    </span>
                  );
                }
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (val) => <StatusBadge status={val} />
              },
              {
                header: 'Action',
                render: (_, row) => (
                  <div className="flex items-center space-x-1.5">
                    {row.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Award}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => setQuickIssueModal({ open: true, app: row })}
                      >
                        Issue
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/officer/applications/${row.application_id}`)}
                    >
                      Review
                    </Button>
                  </div>
                )
              }
            ]}
            data={applications}
            loading={loadingApps}
            emptyMessage="No applications found matching your criteria."
          />

          {appTotal > 10 && (
            <div className="p-4 border-t border-slate-200">
              <Pagination
                page={appPage}
                total={appTotal}
                limit={10}
                onPageChange={setAppPage}
              />
            </div>
          )}
        </Card>
      )}

      {/* ================= OUTGOING REQUESTS TAB ================= */}
      {activeTab === 'outgoing' && (
        <Card>
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <form 
                onSubmit={(e) => { e.preventDefault(); setOutPage(1); fetchOutgoing(); }}
                className="relative flex-1 max-w-md"
              >
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by request no, subject, or applicant..."
                  value={outSearch}
                  onChange={(e) => setOutSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </form>

              <Select
                value={outStatus}
                onChange={(e) => { setOutStatus(e.target.value); setOutPage(1); }}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                  { value: 'CANCELLED', label: 'Cancelled' }
                ]}
                className="sm:w-44"
              />
            </div>

            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchOutgoing}
              loading={loadingOutgoing}
              size="sm"
            >
              Refresh
            </Button>
          </div>

          {/* Table */}
          <Table
            columns={[
              {
                header: 'Request No',
                accessor: 'request_no',
                render: (val, row) => (
                  <div>
                    <span className="font-mono font-semibold text-slate-900 block">{val}</span>
                    <Link
                      to={`/officer/applications/${row.application_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      App: {row.application_no}
                    </Link>
                  </div>
                )
              },
              {
                header: 'Target Panchayat',
                accessor: 'verifying_panchayat_name',
                render: (val, row) => (
                  <div>
                    <span className="font-medium text-slate-800">{val}</span>
                    <span className="block text-xs text-slate-500">Code: {row.verifying_panchayat_code}</span>
                  </div>
                )
              },
              {
                header: 'Subject / Party',
                accessor: 'subject_name',
                render: (val, row) => (
                  <div>
                    <span className="font-medium text-slate-800">{val}</span>
                    <span className="block text-xs text-slate-500 capitalize">{row.subject_party} of {row.applicant_name}</span>
                  </div>
                )
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (val, row) => (
                  <div className="space-y-1">
                    <StatusBadge status={val} isOverdue={row.is_overdue} />
                    {row.reminder_count > 0 && (
                      <span className="block text-[11px] text-slate-500">
                        {row.reminder_count} reminder(s) sent
                      </span>
                    )}
                  </div>
                )
              },
              {
                header: 'Timeline',
                render: (_, row) => (
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>Sent: {new Date(row.request_date).toLocaleDateString('en-IN')}</div>
                    <div className={row.is_overdue ? 'text-red-600 font-semibold' : ''}>
                      Due: {new Date(row.due_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                )
              },
              {
                header: 'Actions',
                render: (_, row) => (
                  <div className="flex items-center space-x-1.5">
                    {row.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleRemind(row)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                          title="Send reminder notification to verifying officers"
                        >
                          <Bell className="w-3 h-3 inline mr-1" />
                          Remind
                        </button>
                        <button
                          onClick={() => setCancelModal({ open: true, request: row })}
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                          title="Cancel this verification request"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => navigate(`/officer/applications/${row.application_id}`)}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100"
                    >
                      View
                    </button>
                  </div>
                )
              }
            ]}
            data={outgoing}
            loading={loadingOutgoing}
            emptyMessage="No outgoing verification requests dispatched yet."
          />

          {outTotal > 10 && (
            <div className="p-4 border-t border-slate-200">
              <Pagination
                page={outPage}
                total={outTotal}
                limit={10}
                onPageChange={setOutPage}
              />
            </div>
          )}
        </Card>
      )}

      {/* ================= CANCEL REQUEST CONFIRM MODAL ================= */}
      <ConfirmDialog
        isOpen={cancelModal.open}
        title="Cancel Verification Request"
        message={`Are you sure you want to cancel request ${cancelModal.request?.request_no} sent to ${cancelModal.request?.verifying_panchayat_name}? This will mark the request as CANCELLED.`}
        confirmText="Yes, Cancel Request"
        confirmVariant="danger"
        loading={actionLoading}
        onConfirm={handleCancelRequest}
        onCancel={() => setCancelModal({ open: false, request: null })}
      />

      {/* ================= NEW VERIFICATION REQUEST MODAL ================= */}
      <Modal
        isOpen={newRequestModal}
        onClose={() => setNewRequestModal(false)}
        title="Dispatch New Verification Request"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <p className="text-xs text-slate-600">
            Dispatch a manual verification request to another Panchayat for an active application in your jurisdiction.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Application *
            </label>
            <select
              value={newReqForm.application_id}
              onChange={(e) => {
                const appId = e.target.value;
                const found = applications.find(a => String(a.application_id) === String(appId));
                setNewReqForm({
                  ...newReqForm,
                  application_id: appId,
                  purpose: found ? found.purpose : newReqForm.purpose
                });
              }}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose an application --</option>
              {applications.map((app) => (
                <option key={app.application_id} value={app.application_id}>
                  {app.application_no} — {app.applicant_name} ({app.certificate_name})
                </option>
              ))}
            </select>
            {formErrors.application_id && (
              <p className="text-xs text-red-500 mt-1">{formErrors.application_id}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Verifying Panchayat (Target) *
            </label>
            <select
              value={newReqForm.verifying_panchayat_id}
              onChange={(e) => setNewReqForm({ ...newReqForm, verifying_panchayat_id: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select target panchayat --</option>
              {activePanchayats.map((p) => (
                <option key={p.panchayat_id} value={p.panchayat_id}>
                  {p.panchayat_name} ({p.panchayat_code}) — {p.district}
                </option>
              ))}
            </select>
            {formErrors.verifying_panchayat_id && (
              <p className="text-xs text-red-500 mt-1">{formErrors.verifying_panchayat_id}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subject Party *
              </label>
              <select
                value={newReqForm.subject_party}
                onChange={(e) => setNewReqForm({ ...newReqForm, subject_party: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="PROPERTY">Property</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                placeholder="Full name of person / property title"
                value={newReqForm.subject_name}
                onChange={(e) => setNewReqForm({ ...newReqForm, subject_name: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
              />
              {formErrors.subject_name && (
                <p className="text-xs text-red-500 mt-1">{formErrors.subject_name}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Subject Aadhaar (12 digits, optional)
            </label>
            <input
              type="text"
              maxLength={12}
              placeholder="e.g. 123456789012"
              value={newReqForm.subject_aadhaar}
              onChange={(e) => setNewReqForm({ ...newReqForm, subject_aadhaar: e.target.value.replace(/\D/g, '') })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Purpose *
            </label>
            <input
              type="text"
              placeholder="e.g. Higher education scholarship"
              value={newReqForm.purpose}
              onChange={(e) => setNewReqForm({ ...newReqForm, purpose: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
            />
            {formErrors.purpose && (
              <p className="text-xs text-red-500 mt-1">{formErrors.purpose}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Request Details / Specific Instructions
            </label>
            <textarea
              rows={3}
              placeholder="Please verify that the declared facts match your Panchayat records..."
              value={newReqForm.request_details}
              onChange={(e) => setNewReqForm({ ...newReqForm, request_details: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setNewRequestModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={actionLoading}
              icon={Send}
            >
              Dispatch Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= QUICK ISSUE CERTIFICATE CONFIRM DIALOG ================= */}
      <ConfirmDialog
        isOpen={quickIssueModal.open}
        title="Issue Official Certificate"
        message={`Are you sure you want to issue the certificate for ${quickIssueModal.app?.applicant_name} (${quickIssueModal.app?.certificate_name})? This will generate the signed PDF with QR code and notify the citizen.`}
        confirmText="Yes, Issue Certificate"
        confirmVariant="primary"
        loading={quickIssueLoading}
        onConfirm={handleQuickIssueConfirm}
        onCancel={() => setQuickIssueModal({ open: false, app: null })}
      />
    </div>
  );
}
