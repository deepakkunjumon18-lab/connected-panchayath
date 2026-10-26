import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Award, 
  Download, 
  Eye, 
  Share2, 
  ExternalLink, 
  Calendar, 
  Building2, 
  Check, 
  FilePlus, 
  RefreshCw,
  FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { getCertificates, downloadCertificateBlob, getCertificateBlobUrl } from '../../api/certificates';

export default function CitizenCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [sharedId, setSharedId] = useState(null);

  // Preview PDF Modal State
  const [previewModal, setPreviewModal] = useState({
    open: false,
    certificate: null,
    blobUrl: null,
    loading: false
  });

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await getCertificates({ limit: 50 });
      const data = res.data || res;
      setCertificates(data.items || []);
    } catch (err) {
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  useEffect(() => {
    return () => {
      if (previewModal.blobUrl) {
        window.URL.revokeObjectURL(previewModal.blobUrl);
      }
    };
  }, [previewModal.blobUrl]);

  const handleDownload = async (cert) => {
    setDownloadingId(cert.certificate_id);
    try {
      await downloadCertificateBlob(cert.certificate_id, `${cert.certificate_no}.pdf`);
      toast.success('Certificate downloaded');
    } catch (err) {
      toast.error('Failed to download certificate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (cert) => {
    setPreviewModal({
      open: true,
      certificate: cert,
      blobUrl: null,
      loading: true
    });

    try {
      const url = await getCertificateBlobUrl(cert.certificate_id);
      setPreviewModal({
        open: true,
        certificate: cert,
        blobUrl: url,
        loading: false
      });
    } catch (err) {
      toast.error('Failed to generate PDF preview');
      setPreviewModal({ open: false, certificate: null, blobUrl: null, loading: false });
    }
  };

  const handleClosePreview = () => {
    if (previewModal.blobUrl) {
      window.URL.revokeObjectURL(previewModal.blobUrl);
    }
    setPreviewModal({ open: false, certificate: null, blobUrl: null, loading: false });
  };

  const handleShare = (cert) => {
    const url = `${window.location.origin}/verify/${cert.verification_code}`;
    navigator.clipboard.writeText(url);
    setSharedId(cert.certificate_id);
    toast.success('Public verification link copied to clipboard!');
    setTimeout(() => setSharedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Certificates"
        subtitle="Official certificates issued to you by the Local Self Government."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchCertificates}
              loading={loading}
              size="sm"
            >
              Refresh
            </Button>
            <Link to="/citizen/apply">
              <Button variant="primary" icon={FilePlus} size="sm">
                Apply for New
              </Button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Spinner size="lg" className="text-primary-600 mb-3" />
          <p className="text-slate-500 text-sm">Loading your issued certificates...</p>
        </div>
      ) : certificates.length === 0 ? (
        <Card>
          <div className="py-12">
            <EmptyState
              icon={Award}
              title="No certificates yet"
              description="Your approved certificates will appear here once reviewed and digitally signed by your Panchayat officer."
              action={
                <Link to="/citizen/apply">
                  <Button variant="primary" icon={FilePlus}>
                    Apply for a Certificate
                  </Button>
                </Link>
              }
            />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert) => {
            const isExpired = cert.valid_until && new Date(cert.valid_until) < new Date();
            return (
              <Card key={cert.certificate_id} className="p-5 flex flex-col justify-between hover:shadow-md transition">
                <div>
                  {/* Top Badge & Type */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">
                          {cert.certificate_name}
                        </h3>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {cert.certificate_code}
                        </span>
                      </div>
                    </div>
                    <Badge variant={isExpired ? 'danger' : 'success'} size="sm">
                      {isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </Badge>
                  </div>

                  {/* Certificate Identifier Box */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Certificate Number
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {cert.certificate_no}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-[11px]">
                      <span className="text-slate-500">Verification Code:</span>
                      <span className="font-mono font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {cert.verification_code}
                      </span>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="space-y-2 text-xs text-slate-600 mb-5">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">
                        Issued by <strong>{cert.issuing_panchayat_name}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>
                        Issued on {new Date(cert.issue_date).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <FileCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>
                        Valid until:{' '}
                        {cert.valid_until ? (
                          <span className={isExpired ? 'text-red-600 font-semibold' : ''}>
                            {new Date(cert.valid_until).toLocaleDateString('en-IN')}
                          </span>
                        ) : (
                          'Permanent'
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Download PDF, Preview PDF, Share link */}
                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Download}
                      className="w-full justify-center"
                      loading={downloadingId === cert.certificate_id}
                      onClick={() => handleDownload(cert)}
                    >
                      Download PDF
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      className="w-full justify-center"
                      onClick={() => handlePreview(cert)}
                    >
                      Preview PDF
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShare(cert)}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-1.5 transition"
                  >
                    {sharedId === cert.certificate_id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Verification Link</span>
                      </>
                    )}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ================= PDF PREVIEW MODAL ================= */}
      <Modal
        isOpen={previewModal.open}
        onClose={handleClosePreview}
        title={`Certificate Preview: ${previewModal.certificate?.certificate_no || ''}`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">{previewModal.certificate?.certificate_name}</span>
              <span className="mx-2">•</span>
              <span>Code: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{previewModal.certificate?.verification_code}</code></span>
            </div>
            {previewModal.certificate && (
              <Button
                size="sm"
                variant="primary"
                icon={Download}
                onClick={() => handleDownload(previewModal.certificate)}
                loading={downloadingId === previewModal.certificate.certificate_id}
              >
                Download PDF
              </Button>
            )}
          </div>

          {previewModal.loading ? (
            <div className="h-96 flex flex-col items-center justify-center">
              <Spinner size="lg" className="text-primary-600 mb-3" />
              <p className="text-xs text-slate-500">Rendering digital certificate...</p>
            </div>
          ) : previewModal.blobUrl ? (
            <div className="w-full h-[650px] border border-slate-300 rounded-xl overflow-hidden bg-slate-100">
              <iframe
                src={previewModal.blobUrl}
                title="Certificate Preview"
                className="w-full h-full border-none"
              />
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-red-500">
              Failed to load preview. Please try downloading the PDF instead.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
