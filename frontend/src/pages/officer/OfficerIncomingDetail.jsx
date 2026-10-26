import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Key, 
  FileText, 
  User, 
  Building2, 
  Eye, 
  FileCheck, 
  Lock, 
  Info,
  Calendar,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import SignaturePanel from '../../components/common/SignaturePanel';
import { getVerificationRequestById, respondVerificationRequest } from '../../api/verification';

export default function OfficerIncomingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);

  // Signing Modal State
  const [signModal, setSignModal] = useState({
    open: false,
    decision: 'APPROVED',
    remarks: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const res = await getVerificationRequestById(id);
      setRequest(res.data || res);
    } catch (err) {
      toast.error('Failed to load verification request');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  const handleOpenSignModal = (decision) => {
    setSignModal({
      open: true,
      decision,
      remarks: decision === 'APPROVED' ? 'Verified against local Panchayat register records.' : '',
      password: ''
    });
    setShowPassword(false);
  };

  const handleSignAndSubmit = async (e) => {
    e.preventDefault();
    if (!signModal.password) {
      toast.error('Password is required to unlock your RSA private key');
      return;
    }
    if (signModal.decision === 'REJECTED' && !signModal.remarks.trim()) {
      toast.error('A reason is required when rejecting a verification request');
      return;
    }

    setSubmitting(true);
    try {
      const res = await respondVerificationRequest(id, {
        decision: signModal.decision,
        remarks: signModal.remarks,
        password: signModal.password
      });

      toast.success(
        `Verification response ${signModal.decision.toLowerCase()} and digitally signed with RSA-2048!`
      );
      setSignModal({ open: false, decision: 'APPROVED', remarks: '', password: '' });
      fetchRequest();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sign verification response');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading incoming request details...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-base text-slate-700">Verification request not found.</p>
        <Link to="/officer/incoming">
          <Button variant="secondary" icon={ArrowLeft}>Back to Incoming Requests</Button>
        </Link>
      </div>
    );
  }

  const isPending = request.status === 'PENDING';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div>
        <Link
          to="/officer/incoming"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Incoming Requests
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                {request.request_no}
              </h1>
              <StatusBadge status={request.status} isOverdue={request.is_overdue} />
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Received on {new Date(request.request_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • Due by {new Date(request.due_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Action Bar for Pending Requests */}
          {isPending && (
            <div className="flex items-center space-x-3">
              <Button
                variant="danger"
                icon={XCircle}
                onClick={() => handleOpenSignModal('REJECTED')}
              >
                Reject & Sign
              </Button>
              <Button
                variant="primary"
                icon={ShieldCheck}
                onClick={() => handleOpenSignModal('APPROVED')}
              >
                Approve & Sign
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Overdue Banner */}
      {request.is_overdue && isPending && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-center space-x-3">
          <Clock className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <strong className="block font-semibold">This verification request is OVERDUE!</strong>
            <span>
              The due date ({new Date(request.due_at).toLocaleDateString('en-IN')}) has passed. Please verify your Panchayat registers and dispatch the digitally signed response immediately.
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Subject Person / Target Details */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <User className="w-4 h-4 text-purple-600" />
              <span>Target Resident in Your Jurisdiction</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Subject Name</span>
                <span className="font-bold text-slate-900 text-sm">{request.subject_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Subject Relationship</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 inline-block mt-0.5">
                  {request.subject_party}
                </span>
              </div>

              {/* Unmasked Aadhaar */}
              <div className="sm:col-span-2 bg-blue-50/70 p-3 rounded-lg border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-blue-900 font-semibold block text-xs">
                    Subject Aadhaar Number (Official Verification View)
                  </span>
                  <span className="font-mono text-base font-bold text-blue-950 tracking-wider">
                    {request.subject_aadhaar ? (
                      request.subject_aadhaar.replace(/(\d{4})/g, '$1 ').trim()
                    ) : (
                      'Not provided'
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-blue-700 bg-white px-2.5 py-1 rounded border border-blue-200 shadow-2xs">
                  <Info className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                  Unmasked solely for register cross-reference
                </div>
              </div>

              {request.subject_details && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Declared Facts & Property Details</span>
                  <span className="font-medium text-slate-800">{request.subject_details}</span>
                </div>
              )}

              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">Requesting Officer Instructions</span>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-1">
                  {request.request_details || 'Please verify local residency and declared facts.'}
                </p>
              </div>
            </div>
          </Card>

          {/* 2. Required Panchayat Records to Verify */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Required Verification Checks (Local Records)</span>
            </h3>

            <p className="text-xs text-slate-600 mb-3">
              Verify your physical Panchayat registers or local e-records against the following checklist before recording your decision:
            </p>

            <div className="space-y-2.5">
              {(request.required_records || []).map((bullet, idx) => (
                <div 
                  key={idx}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="p-1 rounded bg-blue-100 text-blue-700 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-slate-800">{bullet}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 3. Relevant Attachments for this Subject */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Attached Documents for {request.subject_party}</span>
            </h3>

            {(!request.documents || request.documents.length === 0) ? (
              <p className="text-xs text-slate-500 italic">No specific documents attached for this party.</p>
            ) : (
              <div className="space-y-3">
                {request.documents.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 block">{doc.document_name}</span>
                      <span className="text-slate-500 text-[11px] font-mono">{doc.document_type} • {(doc.file_size / 1024).toFixed(1)} KB</span>
                    </div>

                    <a
                      href={`/api/documents/${doc.document_id}/file?token=${localStorage.getItem('cp_token') || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      View Attachment
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 4. If Already Responded: Show Signature Panel */}
          {!isPending && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Recorded Decision & Cryptographic Proof</span>
              </h3>

              <Card className="p-4 space-y-3">
                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-1">Official Response Remarks:</span>
                  <p>{request.response_remarks || 'No remarks provided.'}</p>
                </div>

                <SignaturePanel
                  verificationId={request.verification_id}
                  signatureCheck={request.signature_check}
                  signerName={request.signer_name}
                  panchayatName={request.verifying_panchayat_name}
                  signedAt={request.signed_at}
                  payloadJson={request.payload_json}
                  payloadHash={request.payload_hash}
                  signature={request.signature}
                  signerPublicKey={request.signer_public_key}
                  fingerprint={request.signer_key_fingerprint}
                />
              </Card>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Origin / Application Context */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Origin Application Context</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Originating Panchayat</span>
                <span className="font-bold text-slate-900">
                  {request.home_panchayat_name || request.requesting_panchayat?.panchayat_name || request.requesting_panchayat_name}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Certificate Requested</span>
                <span className="font-semibold text-slate-900">{request.certificate_name}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Applicant Name</span>
                <span className="font-medium text-slate-800">
                  {request.applicant_name || request.applicant?.full_name}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Application Purpose</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 mt-1">
                  {request.application_purpose || request.purpose}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <span className="text-slate-500 block">Application Number</span>
                <span className="font-mono font-medium text-slate-900">{request.application_no}</span>
              </div>
            </div>
          </Card>

          {/* Cryptography Information Card */}
          <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100">
            <div className="flex items-center space-x-2 text-emerald-400 mb-2">
              <Key className="w-4 h-4" />
              <h4 className="font-semibold text-xs uppercase tracking-wider">Digital Signatures</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When you submit your decision, your AES-256-GCM encrypted RSA-2048 private key is unlocked with your password in memory. The response is signed with SHA-256 and verified automatically by the requesting Panchayat.
            </p>
          </Card>
        </div>
      </div>

      {/* ================= SIGN & SUBMIT RESPONSE MODAL ================= */}
      <Modal
        isOpen={signModal.open}
        onClose={() => setSignModal({ ...signModal, open: false })}
        title={`Sign & ${signModal.decision} Verification: ${request.request_no}`}
      >
        <form onSubmit={handleSignAndSubmit} className="space-y-4">
          <div className={`p-3 rounded-lg border text-xs flex items-center space-x-2.5 ${
            signModal.decision === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            {signModal.decision === 'APPROVED' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <div>
              <span className="font-bold block">
                You are recording a decision of: {signModal.decision}
              </span>
              <span>
                Subject: {request.subject_name} ({request.subject_party}) for {request.home_panchayat_name || request.requesting_panchayat?.panchayat_name || request.requesting_panchayat_name}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Official Remarks / Register Verification Findings {signModal.decision === 'REJECTED' && '*'}
            </label>
            <textarea
              rows={3}
              placeholder={signModal.decision === 'APPROVED' ? 'e.g. Verified against Panchayat register. Resident confirmed.' : 'e.g. Resident not found in register...'}
              value={signModal.remarks}
              onChange={(e) => setSignModal({ ...signModal, remarks: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required={signModal.decision === 'REJECTED'}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Enter Login Password to Unlock Private Key *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your account password"
                value={signModal.password}
                onChange={(e) => setSignModal({ ...signModal, password: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 pr-10 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Cryptographic Guarantee</span>
            </div>
            <p>
              Your password temporarily decrypts your RSA private key to generate a SHA-256 digital signature over the decision payload. Any subsequent change to the database will invalidate the signature.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSignModal({ ...signModal, open: false })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={signModal.decision === 'APPROVED' ? 'primary' : 'danger'}
              loading={submitting}
              icon={ShieldCheck}
            >
              Sign & Dispatch Response
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
