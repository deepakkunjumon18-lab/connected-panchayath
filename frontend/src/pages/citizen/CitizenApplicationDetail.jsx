import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import {
  FileText,
  Building,
  Calendar,
  User,
  Shield,
  Clock,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  FileCheck,
  Key,
  Award,
  ExternalLink
} from 'lucide-react';
import { downloadCertificateBlob } from '../../api/certificates';

export default function CitizenApplicationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);

  const fetchApplication = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/applications/${id}`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Application not found');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch application details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchApplication();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" className="text-primary-600 mb-4" />
        <p className="text-ink-muted text-sm">Loading application details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert type="danger" title="Error" message={error || 'Application not found'} />
        <div className="mt-6 text-center">
          <Link to="/citizen/applications">
            <Button variant="outline" icon={ArrowLeft}>
              Back to My Applications
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { application, citizen, certificate_type, home_panchayat, parties, documents, timeline, certificate } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Navigation and Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <Link to="/citizen/applications">
            <button className="p-2 text-ink-muted hover:text-ink bg-white hover:bg-slate-100 rounded-xl border border-line transition shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-ink">{application.application_no}</h2>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {certificate_type.certificate_name} • Submitted on{' '}
              {new Date(application.submitted_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Certificate Action Area */}
        <div>
          {application.status === 'CERTIFICATE_ISSUED' && certificate ? (
            <Button
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              icon={Download}
              loading={downloadLoading}
              onClick={async () => {
                setDownloadLoading(true);
                try {
                  await downloadCertificateBlob(certificate.certificate_id, `${certificate.certificate_no}.pdf`);
                  toast.success('Certificate downloaded successfully');
                } catch (err) {
                  toast.error('Failed to download certificate PDF');
                } finally {
                  setDownloadLoading(false);
                }
              }}
            >
              Download Certificate
            </Button>
          ) : (
            <div className="text-right">
              <Button variant="secondary" size="sm" icon={Download} disabled>
                Download Certificate
              </Button>
              <span className="block text-[11px] text-ink-light mt-1">
                Available after the certificate is issued
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Certificate Issued Banner */}
          {application.status === 'CERTIFICATE_ISSUED' && certificate && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-emerald-950">
                      Certificate Issued & Ready
                    </h3>
                    <Badge variant="success" size="sm">ACTIVE</Badge>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    No: <strong className="font-mono">{certificate.certificate_no}</strong> • Code: <strong className="font-mono">{certificate.verification_code}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Link
                  to="/citizen/certificates"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 transition"
                >
                  View in My Certificates
                </Link>
                <a
                  href={`/verify/${certificate.verification_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-emerald-800 hover:bg-emerald-200 transition"
                  title="Open verification page"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* CARD 1: Application Details */}
          <Card title="Application Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-ink-muted">Purpose of Application:</span>
                <div className="font-semibold text-ink text-sm mt-0.5">{application.purpose}</div>
              </div>

              <div>
                <span className="text-ink-muted">Home Panchayat:</span>
                <div className="font-semibold text-ink text-sm mt-0.5">
                  {home_panchayat?.panchayat_name} ({home_panchayat?.panchayat_code})
                </div>
              </div>

              <div>
                <span className="text-ink-muted">Declared Family Income:</span>
                <div className="font-semibold text-ink text-sm mt-0.5">
                  ₹ {Number(application.declared_family_income || 0).toLocaleString('en-IN')} / year
                </div>
              </div>

              <div>
                <span className="text-ink-muted">Land Holding / House Area:</span>
                <div className="font-semibold text-ink text-sm mt-0.5">
                  {application.land_holding_cents || 0} Cents • {application.house_area_sqft || 0} Sq.Ft
                </div>
              </div>

              {application.other_property_details && (
                <div className="sm:col-span-2">
                  <span className="text-ink-muted">Other Property Details:</span>
                  <div className="font-medium text-ink mt-0.5">{application.other_property_details}</div>
                </div>
              )}

              {application.remarks && (
                <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-line">
                  <span className="text-ink-muted font-semibold">Officer Remarks:</span>
                  <div className="text-ink mt-0.5">{application.remarks}</div>
                </div>
              )}
            </div>

            {/* Applicant Profile Block */}
            <div className="mt-6 pt-4 border-t border-line">
              <h4 className="text-xs font-bold text-ink-light uppercase tracking-wider mb-3">
                Applicant Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-ink-muted">Applicant Name:</span>
                  <div className="font-semibold text-ink">{citizen.full_name}</div>
                </div>
                <div>
                  <span className="text-ink-muted">Aadhaar:</span>
                  <div className="font-mono font-medium text-ink">{citizen.aadhaar_no}</div>
                </div>
                <div>
                  <span className="text-ink-muted">Contact:</span>
                  <div className="text-ink">{citizen.mobile}</div>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-ink-muted">Registered Address:</span>
                  <div className="text-ink">{citizen.address}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* CARD 2: Verification */}
          <Card title="Cross-Panchayat Verification Status">
            <p className="text-xs text-ink-muted mb-4">
              Shows the status of each party and records verification across jurisdiction Panchayats.
            </p>

            {parties.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 text-xs text-ink-muted text-center">
                No external verification parties required for this certificate type. Verified locally.
              </div>
            ) : (
              <div className="space-y-3">
                {parties.map((p) => {
                  let statusBadge = null;
                  let statusText = '';

                  if (!p.verification_required) {
                    statusText = 'No external verification needed (Local records checked by home officer)';
                    statusBadge = (
                      <Badge variant="neutral" size="sm">
                        Local Verification
                      </Badge>
                    );
                  } else if (p.request_status === 'APPROVED') {
                    statusText = `Verified by ${p.panchayat_name}`;
                    statusBadge = (
                      <Badge variant="success" size="sm">
                        Verified
                      </Badge>
                    );
                  } else if (p.request_status === 'REJECTED') {
                    statusText = `Rejected by ${p.panchayat_name} ${p.response_remarks ? `(${p.response_remarks})` : ''}`;
                    statusBadge = (
                      <Badge variant="danger" size="sm">
                        Rejected
                      </Badge>
                    );
                  } else {
                    statusText = `Pending at ${p.panchayat_name} ${p.request_no ? `(${p.request_no})` : ''}`;
                    statusBadge = (
                      <Badge variant="warning" size="sm">
                        Pending
                      </Badge>
                    );
                  }

                  return (
                    <div
                      key={p.party_id}
                      className="p-4 rounded-xl bg-slate-50 border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-ink">{p.party_type}: {p.full_name}</span>
                          {statusBadge}
                        </div>
                        <p className="text-xs text-ink-muted mt-1">{statusText}</p>
                        <div className="text-[11px] text-ink-light mt-1 flex flex-wrap gap-4">
                          <span>Occupation: {p.occupation || 'N/A'}</span>
                          <span>Annual Income: ₹{Number(p.annual_income || 0).toLocaleString('en-IN')}</span>
                          {p.panchayat_name && <span>Record GP: {p.panchayat_name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* CARD 3: Documents */}
          <Card title="Submitted Documents">
            <div className="space-y-3">
              {documents.length === 0 ? (
                <p className="text-xs text-ink-muted italic py-2">No documents attached.</p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="p-3.5 rounded-xl border border-line bg-white flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-ink">{doc.document_name}</div>
                        <div className="text-[11px] text-ink-light flex items-center gap-3 mt-0.5">
                          <span>{doc.document_type}</span>
                          <span>•</span>
                          <span>Related to: {doc.related_to}</span>
                          <span>•</span>
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={doc.verification_status} />
                      <a
                        href={`/api/documents/${doc.document_id}/file?token=${localStorage.getItem('cp_token') || ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line hover:border-slate-300 text-xs font-semibold text-ink transition shadow-sm bg-white"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary-600" />
                        <span>View</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Timeline */}
        <div className="space-y-6">
          <Card title="Application Milestones">
            <p className="text-xs text-ink-muted mb-6">
              Live processing ledger of all verification and decision events.
            </p>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              {timeline.map((evt, idx) => (
                <div key={evt.event_id || idx} className="relative">
                  <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-white shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-ink">{evt.title}</h5>
                    {evt.description && (
                      <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">{evt.description}</p>
                    )}
                    <span className="text-[10px] text-ink-light block mt-1">
                      {new Date(evt.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
