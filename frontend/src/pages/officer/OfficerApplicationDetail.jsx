import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileCheck, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  User, 
  MapPin, 
  Building2, 
  CreditCard, 
  Send, 
  RefreshCw, 
  ShieldCheck, 
  Info,
  Calendar,
  Bell,
  Award,
  Download,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';
import SignaturePanel from '../../components/common/SignaturePanel';
import { getApplicationById } from '../../api/applications';
import { 
  verifyDocument, 
  decideApplication, 
  remindVerificationRequest, 
  cancelVerificationRequest 
} from '../../api/verification';
import { issueCertificate, downloadCertificateBlob } from '../../api/certificates';

export default function OfficerApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Document Verification Modal
  const [docModal, setDocModal] = useState({
    open: false,
    document: null,
    status: 'VERIFIED',
    remarks: ''
  });
  const [docLoading, setDocLoading] = useState(false);

  // Decision Modals (Approve / Reject)
  const [decisionModal, setDecisionModal] = useState({
    open: false,
    decision: 'APPROVED',
    remarks: ''
  });
  const [decisionLoading, setDecisionLoading] = useState(false);

  // Request Cancel Modal
  const [cancelModal, setCancelModal] = useState({
    open: false,
    request: null
  });
  const [cancelLoading, setCancelLoading] = useState(false);

  // Issue Certificate Modal & Loading
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await getApplicationById(id);
      setData(res.data || res);
    } catch (err) {
      toast.error('Failed to load application details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  // Document Verify/Reject Submit
  const handleDocumentAction = async (e) => {
    e.preventDefault();
    if (docModal.status === 'REJECTED' && !docModal.remarks.trim()) {
      toast.error('Remarks are required when rejecting a document');
      return;
    }

    setDocLoading(true);
    try {
      await verifyDocument(id, docModal.document.document_id, {
        status: docModal.status,
        remarks: docModal.remarks
      });
      toast.success(`Document marked as ${docModal.status.toLowerCase()}`);
      setDocModal({ open: false, document: null, status: 'VERIFIED', remarks: '' });
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update document status');
    } finally {
      setDocLoading(false);
    }
  };

  // Application Decision Submit
  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (decisionModal.decision === 'REJECTED' && !decisionModal.remarks.trim()) {
      toast.error('A reason is required when rejecting an application');
      return;
    }

    setDecisionLoading(true);
    try {
      await decideApplication(id, {
        decision: decisionModal.decision,
        remarks: decisionModal.remarks
      });
      toast.success(`Application ${decisionModal.decision.toLowerCase()} successfully`);
      setDecisionModal({ open: false, decision: 'APPROVED', remarks: '' });
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit application decision');
    } finally {
      setDecisionLoading(false);
    }
  };

  // Remind Outgoing Request
  const handleRemindRequest = async (reqItem) => {
    try {
      const res = await remindVerificationRequest(reqItem.verification_id);
      toast.success(res.message || `Reminder sent to ${reqItem.verifying_panchayat_name}`);
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reminder');
    }
  };

  // Cancel Outgoing Request
  const handleCancelRequestConfirm = async () => {
    if (!cancelModal.request) return;
    setCancelLoading(true);
    try {
      await cancelVerificationRequest(cancelModal.request.verification_id);
      toast.success(`Request ${cancelModal.request.request_no} cancelled`);
      setCancelModal({ open: false, request: null });
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setCancelLoading(false);
    }
  };

  // Issue Official Certificate
  const handleIssueCertificateConfirm = async () => {
    setIssueLoading(true);
    try {
      await issueCertificate(id);
      toast.success('Certificate issued successfully and citizen notified!');
      setIssueConfirmOpen(false);
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue certificate');
    } finally {
      setIssueLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-sm font-medium">Loading application workspace...</p>
      </div>
    );
  }

  if (!data || !data.application) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-base text-slate-700">Application not found or unauthorized.</p>
        <Link to="/officer/applications">
          <Button variant="secondary" icon={ArrowLeft}>Back to Applications</Button>
        </Link>
      </div>
    );
  }

  const {
    application,
    citizen,
    certificate_type,
    home_panchayat,
    parties,
    documents,
    requests,
    timeline,
    blockers = [],
    can_approve,
    can_reject,
    certificate
  } = data;

  const isInProgress = ['SUBMITTED', 'PENDING_EXTERNAL', 'READY_FOR_DECISION'].includes(application.status);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div>
        <Link
          to="/officer/applications"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Applications List
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                {application.application_no}
              </h1>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {certificate_type.certificate_name} ({certificate_type.certificate_code}) • Submitted on {new Date(application.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={fetchDetails}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Citizen & Declaration Details */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-600" />
              <span>Applicant & Declaration Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Applicant Full Name</span>
                <span className="font-semibold text-slate-900 text-sm">{citizen.full_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Aadhaar (Privacy Masked)</span>
                <span className="font-mono text-slate-900">{citizen.aadhaar_no}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Contact</span>
                <span className="text-slate-800">{citizen.mobile} • {citizen.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Home Jurisdiction</span>
                <span className="text-slate-800">{citizen.panchayat_name} ({citizen.panchayat_code})</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block">Residential Address</span>
                <span className="text-slate-800">{citizen.address}</span>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">Application Purpose</span>
                <span className="font-medium text-slate-900">{application.purpose}</span>
              </div>
            </div>

            {/* Declared financials */}
            <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
              <div>
                <span className="text-slate-500 block text-[11px]">Declared Family Income</span>
                <span className="font-bold text-slate-900 text-sm">
                  ₹ {Number(application.declared_family_income || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Land Holding</span>
                <span className="font-semibold text-slate-900">
                  {application.land_holding_cents} cents
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">House Area</span>
                <span className="font-semibold text-slate-900">
                  {application.house_area_sqft} sq ft
                </span>
              </div>
              {application.other_property_details && (
                <div className="col-span-3 text-[11px] text-slate-600 pt-1">
                  <span className="font-medium text-slate-700">Other Property: </span>
                  {application.other_property_details}
                </div>
              )}
            </div>
          </Card>

          {/* 2. Verification Parties */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>Verification Parties & Cross-Jurisdiction Status</span>
            </h3>

            {parties.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No external parties required for this certificate.</p>
            ) : (
              <div className="space-y-3">
                {parties.map((party) => {
                  const isHome = Number(party.panchayat_id) === Number(home_panchayat.panchayat_id);
                  return (
                    <div 
                      key={party.party_id}
                      className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-sm">{party.full_name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {party.party_type}
                          </span>
                          {isHome ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                              Home Panchayat
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                              External Jurisdiction
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 mt-1">
                          Panchayat: <span className="font-medium text-slate-800">{party.panchayat_name}</span>
                          {party.occupation && <span> • Occupation: {party.occupation}</span>}
                          {party.aadhaar_no && <span> • Aadhaar: {party.aadhaar_no}</span>}
                        </div>
                      </div>

                      <div>
                        {party.verification_required ? (
                          <div className="text-right">
                            <span className="text-[11px] text-slate-500 block">External Request</span>
                            {party.request_status ? (
                              <StatusBadge status={party.request_status} size="sm" />
                            ) : (
                              <span className="text-xs text-amber-600 font-medium">Pending Request</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-medium">
                            Internal Verification
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* 3. Uploaded Documents */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Submitted Documents & Physical Verification</span>
            </h3>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No documents attached.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-blue-50 text-blue-600 mt-0.5 flex-shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 text-sm block">
                          {doc.document_name}
                        </span>
                        <div className="text-slate-500 mt-0.5 space-x-2">
                          <span className="font-mono text-[11px]">{doc.document_type}</span>
                          <span>•</span>
                          <span>Related to: {doc.related_to}</span>
                          <span>•</span>
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                        </div>
                        {doc.verification_remarks && (
                          <p className="mt-1 text-slate-600 italic text-[11px]">
                            Remarks: {doc.verification_remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-center">
                      <a
                        href={`/api/documents/${doc.document_id}/file?token=${localStorage.getItem('cp_token') || ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        View
                      </a>

                      {/* Document Verification State / Actions */}
                      {doc.needs_home_verification ? (
                        isInProgress ? (
                          <>
                            {doc.verification_status === 'VERIFIED' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Verified
                              </span>
                            ) : doc.verification_status === 'REJECTED' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800">
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Rejected
                              </span>
                            ) : (
                              <div className="flex items-center space-x-1.5">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => setDocModal({
                                    open: true,
                                    document: doc,
                                    status: 'VERIFIED',
                                    remarks: 'Physical records verified'
                                  })}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => setDocModal({
                                    open: true,
                                    document: doc,
                                    status: 'REJECTED',
                                    remarks: ''
                                  })}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <StatusBadge status={doc.verification_status} size="sm" />
                        )
                      ) : (
                        <span className="px-2.5 py-1 rounded text-xs bg-slate-100 text-slate-600 font-medium">
                          External party doc
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 4. Inter-Panchayat Verification Responses & Cryptographic Signatures */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Inter-Panchayat Verification Requests & Digital Signatures</span>
            </h3>

            {requests.length === 0 ? (
              <Card className="p-4 text-xs text-slate-500 bg-slate-50 border-slate-200">
                <Info className="w-4 h-4 inline mr-1 text-slate-400" />
                This application requires no external verification requests. All documents and parties belong to your Panchayat.
              </Card>
            ) : (
              <div className="space-y-4">
                {requests.map((r) => (
                  <Card key={r.verification_id} className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">{r.request_no}</span>
                          <span className="text-xs text-slate-500">Sent to:</span>
                          <span className="font-semibold text-slate-800 text-xs">
                            {r.verifying_panchayat_name} ({r.verifying_panchayat_code})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Subject: <span className="font-medium text-slate-900">{r.subject_name}</span> ({r.subject_party})
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <StatusBadge status={r.status} />
                        {r.status === 'PENDING' && isInProgress && (
                          <>
                            <button
                              onClick={() => handleRemindRequest(r)}
                              className="px-2 py-1 text-xs font-medium rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                              title="Send reminder to verifying officers"
                            >
                              <Bell className="w-3 h-3 inline mr-1" />
                              Remind
                            </button>
                            <button
                              onClick={() => setCancelModal({ open: true, request: r })}
                              className="px-2 py-1 text-xs font-medium rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Pending details */}
                    {r.status === 'PENDING' && (
                      <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-center space-x-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>Awaiting digital response from {r.verifying_panchayat_name}. Due by {new Date(r.due_at).toLocaleDateString('en-IN')}.</span>
                      </div>
                    )}

                    {/* Rejected details */}
                    {r.status === 'REJECTED' && (
                      <div className="text-xs text-red-800 bg-red-50 p-3 rounded-lg border border-red-200">
                        <span className="font-semibold block mb-0.5">Verification Rejected by {r.verifying_panchayat_name}:</span>
                        <span>{r.response_remarks || 'No remarks provided.'}</span>
                      </div>
                    )}

                    {/* Approved with Cryptographic Signature Panel */}
                    {r.status === 'APPROVED' && (
                      <div className="space-y-2">
                        {r.response_remarks && (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <span className="font-medium text-slate-800">Verifying Officer Remarks: </span>
                            {r.response_remarks}
                          </div>
                        )}

                        <SignaturePanel
                          verificationId={r.verification_id}
                          signatureCheck={r.signature_check}
                          signerName={r.signer_name}
                          panchayatName={r.verifying_panchayat_name}
                          signedAt={r.signed_at}
                          payloadJson={r.payload_json}
                          payloadHash={r.payload_hash}
                          signature={r.signature}
                          signerPublicKey={r.signer_public_key}
                          fingerprint={r.signer_key_fingerprint}
                        />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (1 Col): Live Decision Blocker Box & Timeline */}
        <div className="space-y-6">

          {/* Issue Certificate Card for APPROVED applications */}
          {application.status === 'APPROVED' && (
            <Card className="p-5 border-2 border-emerald-500/40 bg-emerald-50/30 shadow-sm">
              <div className="flex items-center space-x-2 text-emerald-900 font-semibold text-sm mb-2">
                <Award className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>Issue Official Certificate</span>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                This application has been approved. Generate and issue the official digital certificate with QR code and cryptographic verification.
              </p>
              <Button
                variant="primary"
                className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                icon={Award}
                loading={issueLoading}
                onClick={() => setIssueConfirmOpen(true)}
              >
                Issue Certificate
              </Button>
            </Card>
          )}

          {/* Certificate Issued Card */}
          {application.status === 'CERTIFICATE_ISSUED' && certificate && (
            <Card className="p-5 border border-emerald-300 bg-emerald-50/40 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-200">
                <div className="flex items-center space-x-2 text-emerald-950 font-semibold text-sm">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>Issued Certificate</span>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                  {certificate.status || 'ACTIVE'}
                </span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-700 mb-4">
                <div>
                  <span className="text-slate-500 block text-[11px]">Certificate Number:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{certificate.certificate_no}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Verification Code:</span>
                  <span className="font-mono font-semibold text-slate-800 tracking-wide">{certificate.verification_code}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Issued:</span>
                    <span className="font-medium text-slate-800">{new Date(certificate.issue_date).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Valid Until:</span>
                    <span className="font-medium text-slate-800">{new Date(certificate.valid_until).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  icon={Download}
                  loading={downloadLoading}
                  onClick={async () => {
                    try {
                      setDownloadLoading(true);
                      await downloadCertificateBlob(certificate.certificate_id, `${certificate.certificate_no}.pdf`);
                    } catch (err) {
                      toast.error('Failed to download certificate PDF');
                    } finally {
                      setDownloadLoading(false);
                    }
                  }}
                >
                  Download PDF
                </Button>
                <a
                  href={`/verify/${certificate.verification_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Public Verification Page
                </a>
              </div>
            </Card>
          )}

          {/* Action / Decision Card */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4">
              Officer Decision
            </h3>

            {/* Live Blockers Box */}
            {isInProgress && (
              <>
                {blockers.length > 0 ? (
                  <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs mb-4 space-y-2">
                    <div className="flex items-center space-x-1.5 font-semibold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>Action required before approval:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-amber-800 pl-1 text-[11px]">
                      {blockers.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs mb-4 space-y-1">
                    <div className="flex items-center space-x-1.5 font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Ready for Approval!</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      All physical documents verified and external responses cryptographically confirmed.
                    </p>
                  </div>
                )}

                {/* Approve / Reject Buttons */}
                <div className="space-y-2.5">
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    disabled={!can_approve}
                    onClick={() => setDecisionModal({
                      open: true,
                      decision: 'APPROVED',
                      remarks: 'All documents and inter-panchayat verifications confirmed.'
                    })}
                  >
                    Approve Application
                  </Button>

                  <Button
                    variant="danger"
                    className="w-full justify-center"
                    disabled={!can_reject}
                    onClick={() => setDecisionModal({
                      open: true,
                      decision: 'REJECTED',
                      remarks: ''
                    })}
                  >
                    Reject Application
                  </Button>
                </div>
              </>
            )}

            {!isInProgress && (
              <div className="p-3 rounded-lg border bg-slate-50 text-xs space-y-1">
                <span className="text-slate-500 block">Final Status:</span>
                <div className="flex items-center space-x-2">
                  <StatusBadge status={application.status} />
                </div>
                {application.remarks && (
                  <p className="text-slate-700 mt-2 text-[11px] pt-2 border-t border-slate-200">
                    <span className="font-semibold">Decision Remarks: </span>
                    {application.remarks}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Timeline Card */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Application Timeline</span>
            </h3>

            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No timeline events recorded.</p>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((event, idx) => (
                  <div key={event.event_id || idx} className="relative text-xs">
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white bg-blue-600 shadow-xs" />
                    <div>
                      <span className="font-semibold text-slate-800 block text-xs">{event.title}</span>
                      {event.description && (
                        <p className="text-slate-500 text-[11px] mt-0.5">{event.description}</p>
                      )}
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        {new Date(event.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ================= DOCUMENT VERIFY / REJECT MODAL ================= */}
      <Modal
        isOpen={docModal.open}
        onClose={() => setDocModal({ ...docModal, open: false })}
        title={`${docModal.status === 'VERIFIED' ? 'Verify' : 'Reject'} Document: ${docModal.document?.document_name}`}
      >
        <form onSubmit={handleDocumentAction} className="space-y-4">
          <p className="text-xs text-slate-600">
            {docModal.status === 'VERIFIED'
              ? 'Confirm that you have reviewed the physical or digital document and verified its authenticity.'
              : 'Enter the reason for rejecting this document. This will be visible on the application record.'
            }
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Officer Remarks {docModal.status === 'REJECTED' && '*'}
            </label>
            <textarea
              rows={3}
              placeholder={docModal.status === 'VERIFIED' ? 'Verified against physical register...' : 'State reason for rejection...'}
              value={docModal.remarks}
              onChange={(e) => setDocModal({ ...docModal, remarks: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required={docModal.status === 'REJECTED'}
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDocModal({ ...docModal, open: false })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={docModal.status === 'VERIFIED' ? 'primary' : 'danger'}
              loading={docLoading}
            >
              Confirm {docModal.status}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= APPLICATION DECISION MODAL ================= */}
      <Modal
        isOpen={decisionModal.open}
        onClose={() => setDecisionModal({ ...decisionModal, open: false })}
        title={`${decisionModal.decision === 'APPROVED' ? 'Approve' : 'Reject'} Application ${application.application_no}`}
      >
        <form onSubmit={handleDecisionSubmit} className="space-y-4">
          <p className="text-xs text-slate-600">
            {decisionModal.decision === 'APPROVED'
              ? `Are you sure you want to approve application ${application.application_no}? This will change the status to APPROVED and notify the citizen.`
              : `Enter the official reason for rejecting application ${application.application_no}. The citizen will receive an email and in-app notification with this reason.`
            }
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Decision Remarks / Reason {decisionModal.decision === 'REJECTED' && '*'}
            </label>
            <textarea
              rows={3}
              placeholder={decisionModal.decision === 'APPROVED' ? 'Approved based on verified records.' : 'Reason for rejection...'}
              value={decisionModal.remarks}
              onChange={(e) => setDecisionModal({ ...decisionModal, remarks: e.target.value })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required={decisionModal.decision === 'REJECTED'}
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDecisionModal({ ...decisionModal, open: false })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decisionModal.decision === 'APPROVED' ? 'primary' : 'danger'}
              loading={decisionLoading}
            >
              Confirm {decisionModal.decision}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= CANCEL REQUEST CONFIRM DIALOG ================= */}
      <ConfirmDialog
        isOpen={cancelModal.open}
        title="Cancel Verification Request"
        message={`Are you sure you want to cancel request ${cancelModal.request?.request_no} sent to ${cancelModal.request?.verifying_panchayat_name}?`}
        confirmText="Yes, Cancel"
        confirmVariant="danger"
        loading={cancelLoading}
        onConfirm={handleCancelRequestConfirm}
        onCancel={() => setCancelModal({ open: false, request: null })}
      />

      {/* ================= ISSUE CERTIFICATE CONFIRM DIALOG ================= */}
      <ConfirmDialog
        isOpen={issueConfirmOpen}
        title="Issue Official Certificate"
        message={`Are you sure you want to generate and issue the official certificate for application ${application?.application_no}? This will create the signed PDF with a QR code and notify the applicant.`}
        confirmText="Yes, Issue Certificate"
        confirmVariant="primary"
        loading={issueLoading}
        onConfirm={handleIssueCertificateConfirm}
        onCancel={() => setIssueConfirmOpen(false)}
      />
    </div>
  );
}
