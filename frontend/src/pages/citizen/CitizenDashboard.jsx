import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/common/StatusBadge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  FileText,
  Clock,
  Award,
  FilePlus,
  ArrowRight,
  Building,
  Eye,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCitizenDashboard } from '../../api/dashboard';
import { downloadCertificateBlob } from '../../api/certificates';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await getCitizenDashboard();
      setData(res.data?.data || res.data);
    } catch (err) {
      toast.error('Failed to load citizen dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDownload = async (cert) => {
    setDownloadingId(cert.certificate_id);
    try {
      await downloadCertificateBlob(cert.certificate_id, `${cert.certificate_no}.pdf`);
      toast.success('Certificate downloaded successfully');
    } catch (err) {
      toast.error('Failed to download certificate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const {
    totals = { total_applications: 0, in_progress: 0, certificates_issued: 0, rejected: 0 },
    recent_applications = []
  } = data || {};

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={`Welcome, ${user?.full_name || 'Citizen'}`}
        subtitle={`${user?.panchayat_name || 'Home Panchayat'} Jurisdiction • Connected Government Services`}
        action={
          <Link to="/citizen/apply">
            <Button variant="primary" icon={FilePlus}>
              Apply for Certificate
            </Button>
          </Link>
        }
      />

      {loading && !data ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" className="text-primary-600 mb-3" />
        </div>
      ) : (
        <>
          {/* 4 StatCards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Total Applications"
              value={totals.total_applications}
              subtitle="All-time submitted"
              icon={FileText}
            />
            <StatCard
              title="In Progress"
              value={totals.in_progress}
              subtitle="Under review & verification"
              icon={Clock}
              className={totals.in_progress > 0 ? 'border-amber-200 bg-amber-50/20' : ''}
            />
            <StatCard
              title="Certificates Issued"
              value={totals.certificates_issued}
              subtitle="Available for instant download"
              icon={Award}
              className={totals.certificates_issued > 0 ? 'border-emerald-200 bg-emerald-50/20' : ''}
            />
            <StatCard
              title="Rejected"
              value={totals.rejected}
              subtitle="Applications declined"
              icon={XCircle}
              className={totals.rejected > 0 ? 'border-red-200 bg-red-50/20' : ''}
            />
          </div>

          {/* Quick Action Navigation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Link to="/citizen/apply" className="block group">
              <Card className="p-5 border border-slate-200 group-hover:border-blue-500 group-hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">New Application</h4>
                    <p className="text-[11px] text-slate-500">Choose from 6 certificate types</p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 mt-2">
                  Start Application <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            </Link>

            <Link to="/track" className="block group">
              <Card className="p-5 border border-slate-200 group-hover:border-blue-500 group-hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Track Status</h4>
                    <p className="text-[11px] text-slate-500">Live progress ledger</p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-purple-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 mt-2">
                  Track by Number <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            </Link>

            <Link to="/citizen/certificates" className="block group">
              <Card className="p-5 border border-slate-200 group-hover:border-blue-500 group-hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">My Certificates</h4>
                    <p className="text-[11px] text-slate-500">PDFs with QR verification</p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition inline-flex items-center gap-1 mt-2">
                  View Repository <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            </Link>
          </div>

          {/* Recent Applications Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Recent Applications</h3>
                <p className="text-xs text-slate-500 mt-0.5">Your submitted applications and digital issuance status</p>
              </div>
              <Link
                to="/citizen/applications"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recent_applications.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Applications Submitted"
                description="You haven't submitted any certificate applications yet. Click below to begin."
                action={
                  <Link to="/citizen/apply">
                    <Button variant="primary" icon={FilePlus} size="sm">
                      Apply for Certificate
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {recent_applications.map((app) => (
                  <div
                    key={app.application_id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/citizen/applications/${app.application_id}`}
                          className="font-mono font-bold text-xs sm:text-sm text-blue-600 hover:underline"
                        >
                          {app.application_no}
                        </Link>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-900">{app.certificate_name}</span>
                        <span className="text-slate-300">•</span>
                        <span>{app.purpose}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400">
                          {new Date(app.submitted_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {app.certificate && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={Download}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          loading={downloadingId === app.certificate.certificate_id}
                          onClick={() => handleDownload(app.certificate)}
                        >
                          Download PDF
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/citizen/applications/${app.application_id}`)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
