import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { 
  Send, 
  Inbox, 
  Award, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  FileCheck, 
  Search, 
  Building2, 
  Plus, 
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getOfficerDashboard } from '../../api/dashboard';
import { getApplications } from '../../api/applications';
import { getPanchayats } from '../../api/panchayats';
import { createVerificationRequest } from '../../api/verification';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Quick Action: Send New Request Modal State
  const [newReqModalOpen, setNewReqModalOpen] = useState(false);
  const [openApplications, setOpenApplications] = useState([]);
  const [activePanchayats, setActivePanchayats] = useState([]);
  const [loadingOpenApps, setLoadingOpenApps] = useState(false);
  const [submittingReq, setSubmittingReq] = useState(false);

  const [reqForm, setReqForm] = useState({
    application_id: '',
    verifying_panchayat_id: '',
    subject_party: 'FATHER',
    subject_name: '',
    subject_aadhaar: '',
    subject_details: '',
    purpose: '',
    request_details: ''
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await getOfficerDashboard();
      setData(res.data || res);
    } catch (err) {
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleOpenNewRequestModal = async () => {
    setNewReqModalOpen(true);
    setLoadingOpenApps(true);
    try {
      const [appsRes, panchRes] = await Promise.all([
        getApplications({ status: 'SUBMITTED', limit: 50 }),
        getPanchayats({ status: 'ACTIVE' })
      ]);
      const appItems = appsRes.data?.items || appsRes.data || [];
      const panchItems = panchRes.data?.items || panchRes.data || [];
      // Exclude own panchayat from verification targets
      const targets = panchItems.filter((p) => p.panchayat_id !== user?.panchayat_id);

      setOpenApplications(appItems);
      setActivePanchayats(targets);

      if (appItems.length > 0) {
        setReqForm((prev) => ({
          ...prev,
          application_id: appItems[0].application_id,
          purpose: appItems[0].purpose || ''
        }));
      }
    } catch (err) {
      toast.error('Failed to load applications for request dispatch');
    } finally {
      setLoadingOpenApps(false);
    }
  };

  const handleNewRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reqForm.application_id) {
      toast.error('Please select an application');
      return;
    }
    if (!reqForm.verifying_panchayat_id) {
      toast.error('Please select the verifying panchayat');
      return;
    }
    if (!reqForm.subject_name.trim()) {
      toast.error('Subject full name is required');
      return;
    }

    setSubmittingReq(true);
    try {
      await createVerificationRequest({
        ...reqForm,
        application_id: Number(reqForm.application_id),
        verifying_panchayat_id: Number(reqForm.verifying_panchayat_id)
      });
      toast.success('Verification request dispatched successfully!');
      setNewReqModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch verification request');
    } finally {
      setSubmittingReq(false);
    }
  };

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Spinner size="lg" className="text-primary-600 mb-3" />
        <p className="text-sm text-slate-500">Loading officer portal metrics...</p>
      </div>
    );
  }

  const {
    total_requests = 0,
    pending_incoming = 0,
    completed_certificates = 0,
    overdue = { total: 0, incoming: 0, outgoing: 0 },
    current_request = null,
    recent_requests = []
  } = data || {};

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header with greeting and today's date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome, {user?.full_name || 'Officer'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>{user?.panchayat_name || 'Home Panchayat'} ({user?.panchayat_code || 'GP'})</span>
            <span className="text-slate-300">•</span>
            <span className="font-medium text-slate-700">{user?.designation || 'Verification Officer'}</span>
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-xs uppercase font-semibold text-slate-600 tracking-wider block">Today</span>
          <span className="text-sm font-semibold text-slate-900">{todayStr}</span>
        </div>
      </div>

      {/* 2. 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Requests"
          value={total_requests}
          subtitle="Last 30 days (in & out)"
          icon={Send}
        />
        <StatCard
          title="Pending Verification"
          value={pending_incoming}
          subtitle="Awaiting your response"
          icon={Inbox}
          trend={pending_incoming > 0 ? { direction: 'neutral', label: 'Action needed' } : null}
        />
        <StatCard
          title="Completed"
          value={completed_certificates}
          subtitle="Certificates issued (30d)"
          icon={Award}
        />
        <StatCard
          title="Overdue"
          value={overdue.total}
          subtitle={
            overdue.incoming > 0 
              ? `${overdue.incoming} incoming overdue` 
              : 'Requests past due date'
          }
          icon={AlertTriangle}
          className={overdue.total > 0 ? 'border-red-300 bg-red-50/20' : ''}
        />
      </div>

      {/* 3. Certificate Process 4-Step Strip */}
      <Card className="p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Certificate Issuance Lifecycle
          </h3>
          <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Real Cryptographic Workflow
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 relative">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Local Verification</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Review submitted physical registers and uploaded citizen documents.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 relative">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Send Request</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Dispatch inter-panchayat verification requests for external family members.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 relative">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Receive & Approve</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Automatic RSA-2048 signature verification confirms response integrity.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 relative">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              4
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Issue Certificate</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Issue official PDF with QR code & SHA-256 integrity hash for instant citizen access.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN (2 Cols): Recent Inter-Panchayat Requests */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Recent Inter-Panchayat Requests</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest verification inquiries routed between your Panchayat and peer Panchayats.
                </p>
              </div>
              <Link
                to="/officer/incoming"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <span>View All</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {recent_requests.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No recent inter-panchayat verification requests recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent_requests.map((req) => (
                  <div
                    key={req.verification_id}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      req.is_overdue ? 'bg-red-50/30 px-3 -mx-3 rounded-lg' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {req.request_no}
                        </span>
                        <StatusBadge status={req.status} />
                        {req.is_overdue && (
                          <Badge variant="danger" size="sm">
                            OVERDUE
                          </Badge>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {req.direction}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-800">{req.applicant_name}</span>
                        <span className="text-slate-300">•</span>
                        <span>{req.certificate_name}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500">
                          {req.requesting_panchayat_name} → {req.verifying_panchayat_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (req.direction === 'INCOMING') {
                            navigate(`/officer/incoming/${req.verification_id}`);
                          } else {
                            navigate(`/officer/applications/${req.application_id}`);
                          }
                        }}
                      >
                        {req.direction === 'INCOMING' ? 'Review & Sign' : 'View App'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN (1 Col): Current Request, Quick Actions, Promo Card */}
        <div className="space-y-6">
          
          {/* Current Urgent Request Card */}
          <Card className="p-5 border-2 border-amber-300/80 bg-amber-50/20 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-amber-200/80 mb-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Current Priority Request</span>
              </div>
              {current_request?.is_overdue && (
                <Badge variant="danger" size="sm">
                  PAST DUE
                </Badge>
              )}
            </div>

            {current_request ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm block">
                    {current_request.request_no}
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    App: {current_request.application_no} • {current_request.certificate_name}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-amber-200/60 space-y-1 text-slate-700">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Subject Party:</span>
                    <span className="font-medium text-slate-900 ml-1">{current_request.subject_name} ({current_request.subject_party})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">From:</span>
                    <span className="font-medium text-slate-900 ml-1">{current_request.requesting_panchayat_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Due Date:</span>
                    <span className={`font-semibold ml-1 ${current_request.is_overdue ? 'text-red-600' : 'text-slate-800'}`}>
                      {new Date(current_request.due_at).toLocaleDateString('en-IN')}
                      {current_request.is_overdue && ` (${current_request.days_overdue} days ago)`}
                    </span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full justify-center bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs"
                  onClick={() => navigate(`/officer/incoming/${current_request.verification_id}`)}
                >
                  Process Decision Now
                </Button>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-700">Queue Clear</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No pending incoming requests requiring your decision.</p>
              </div>
            )}
          </Card>

          {/* Quick Actions Card */}
          <Card className="p-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-3 border-b border-slate-200 mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start text-xs font-semibold py-2.5"
                icon={Plus}
                onClick={handleOpenNewRequestModal}
              >
                Send New Verification Request
              </Button>

              <Link to="/officer/applications?status=SUBMITTED" className="block">
                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs font-semibold py-2.5"
                  icon={FileCheck}
                >
                  Verify Local Records (Submitted)
                </Button>
              </Link>

              <Link to="/officer/applications?status=APPROVED" className="block">
                <Button
                  variant="secondary"
                  className="w-full justify-start text-xs font-semibold py-2.5 text-emerald-700 hover:text-emerald-800"
                  icon={Award}
                >
                  Issue Ready Certificates (Approved)
                </Button>
              </Link>
            </div>
          </Card>

          {/* Soft Promo Card with Inline SVG */}
          <Card className="p-5 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-200/80">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-blue-950 text-sm">Two Panchayats. One Certificate.</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Cryptographically bridged local governance. Digital decisions signed with RSA-2048 keys under the IT Act.
            </p>

            {/* Inline SVG Diagram */}
            <div className="p-3 bg-white/90 rounded-xl border border-blue-100 flex items-center justify-between text-center">
              <div className="space-y-1 flex-1">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 mx-auto flex items-center justify-center font-bold text-xs">
                  GP A
                </div>
                <span className="text-[10px] font-semibold text-slate-700 block">Home</span>
              </div>

              <div className="flex flex-col items-center px-2">
                <div className="w-16 h-0.5 bg-blue-300 relative my-1">
                  <div className="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-blue-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                </div>
                <span className="text-[9px] font-mono text-blue-600 font-semibold">RSA-2048</span>
              </div>

              <div className="space-y-1 flex-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center font-bold text-xs">
                  GP B
                </div>
                <span className="text-[10px] font-semibold text-slate-700 block">Verifying</span>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {/* ================= MODAL: SEND NEW VERIFICATION REQUEST ================= */}
      <Modal
        isOpen={newReqModalOpen}
        onClose={() => setNewReqModalOpen(false)}
        title="Dispatch Verification Request"
        size="lg"
      >
        {loadingOpenApps ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Spinner size="md" className="text-primary-600 mb-2" />
            <p className="text-xs text-slate-500">Loading open applications and target panchayats...</p>
          </div>
        ) : openApplications.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 space-y-3">
            <p>No open submitted applications available to dispatch external verification for.</p>
            <Button variant="secondary" size="sm" onClick={() => setNewReqModalOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleNewRequestSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Open Application *
              </label>
              <select
                value={reqForm.application_id}
                onChange={(e) => {
                  const selApp = openApplications.find((a) => String(a.application_id) === e.target.value);
                  setReqForm({
                    ...reqForm,
                    application_id: e.target.value,
                    purpose: selApp?.purpose || reqForm.purpose
                  });
                }}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
                required
              >
                {openApplications.map((app) => (
                  <option key={app.application_id} value={app.application_id}>
                    {app.application_no} — {app.applicant_name} ({app.certificate_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verifying Panchayat *
                </label>
                <select
                  value={reqForm.verifying_panchayat_id}
                  onChange={(e) => setReqForm({ ...reqForm, verifying_panchayat_id: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select target panchayat...</option>
                  {activePanchayats.map((p) => (
                    <option key={p.panchayat_id} value={p.panchayat_id}>
                      {p.panchayat_name} ({p.panchayat_code} - {p.district})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Party Relation *
                </label>
                <select
                  value={reqForm.subject_party}
                  onChange={(e) => setReqForm({ ...reqForm, subject_party: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="PROPERTY">Property / Land</option>
                  <option value="OTHER">Other Relative</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramachandran Nair"
                  value={reqForm.subject_name}
                  onChange={(e) => setReqForm({ ...reqForm, subject_name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject Aadhaar Number (optional)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="12 digit Aadhaar"
                  value={reqForm.subject_aadhaar}
                  onChange={(e) => setReqForm({ ...reqForm, subject_aadhaar: e.target.value.replace(/\D/g, '') })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purpose of Verification *
              </label>
              <input
                type="text"
                placeholder="e.g. Verification of father's residence for EWS certificate"
                value={reqForm.purpose}
                onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specific Request Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Please verify against your local registers and sign the decision..."
                value={reqForm.request_details}
                onChange={(e) => setReqForm({ ...reqForm, request_details: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setNewReqModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submittingReq}
                icon={Send}
              >
                Dispatch Request
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
