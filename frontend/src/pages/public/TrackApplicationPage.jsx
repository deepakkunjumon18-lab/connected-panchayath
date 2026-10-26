import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Spinner from '../../components/ui/Spinner';
import Stepper from '../../components/ui/Stepper';
import StatusBadge from '../../components/common/StatusBadge';
import { Search, FileText, Calendar, Building, Download, CheckCircle2 } from 'lucide-react';

export default function TrackApplicationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAppNo = searchParams.get('appNo') || '';

  const [applicationNo, setApplicationNo] = useState(initialAppNo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appData, setAppData] = useState(null);

  const fetchTracking = async (appNo) => {
    if (!appNo.trim()) return;
    setLoading(true);
    setError('');
    setAppData(null);

    try {
      const res = await axios.get(`/api/applications/track/${encodeURIComponent(appNo.trim())}`);
      if (res.data?.success && res.data?.data) {
        setAppData(res.data.data);
      } else {
        setError(res.data?.message || 'Application not found');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Application not found with the provided number');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialAppNo) {
      fetchTracking(initialAppNo);
    }
  }, [initialAppNo]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!applicationNo.trim()) return;
    setSearchParams({ appNo: applicationNo.trim() });
    fetchTracking(applicationNo);
  };

  // Convert timeline events to Stepper steps
  const getStepperSteps = (timeline = []) => {
    if (!timeline || timeline.length === 0) {
      return [{ title: 'Application Submitted', completed: true }];
    }
    return timeline.map((event, idx) => ({
      title: event.title,
      description: event.created_at
        ? new Date(event.created_at).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          })
        : '—',
      completed: true,
      current: idx === timeline.length - 1
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        title="Track Application"
        subtitle="Check the real-time processing status of your certificate application across Panchayats."
      />

      {/* Search Bar Card */}
      <Card className="mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Input
              label="Application Number"
              placeholder="e.g. EWS-2026-0001"
              value={applicationNo}
              onChange={(e) => setApplicationNo(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={Search}
            className="w-full sm:w-auto"
          >
            Track Status
          </Button>
        </form>
      </Card>

      {/* Error state */}
      {error && (
        <Alert
          type="danger"
          title="Tracking Failed"
          message={error}
          className="mb-8"
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-ink-muted text-sm">Searching for application records...</p>
        </div>
      )}

      {/* Result Card */}
      {appData && !loading && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-line gap-4">
              <div>
                <div className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-1">
                  Application Summary
                </div>
                <h3 className="text-2xl font-bold text-ink">
                  {appData.application_no}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={appData.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-line">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-ink-muted">Certificate Type</div>
                  <div className="font-semibold text-ink">{appData.certificate_type_name}</div>
                  <span className="text-xs text-ink-light uppercase">Code: {appData.certificate_type_code}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-ink-muted">Home Panchayat</div>
                  <div className="font-semibold text-ink">{appData.panchayat_name}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-ink-muted">Submitted On</div>
                    {appData.submitted_at
                      ? new Date(appData.submitted_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : '—'}
                </div>
              </div>
            </div>

            {/* Issued Certificate Section */}
            {appData.status === 'CERTIFICATE_ISSUED' && appData.certificate && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-emerald-950">Certificate Issued & Available</h4>
                    <p className="text-xs text-emerald-700">
                      Certificate No: <span className="font-mono font-medium">{appData.certificate.certificate_no}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/certificates/${appData.certificate.certificate_id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </a>
                  <Link
                    to={`/verify/${appData.certificate.verification_code}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 rounded-xl text-sm font-medium transition"
                  >
                    Verify Online
                  </Link>
                </div>
              </div>
            )}
          </Card>

          {/* Timeline Card */}
          <Card>
            <h3 className="text-lg font-semibold text-ink mb-6">Processing Timeline</h3>
            <p className="text-xs text-ink-muted mb-6">
              Only public milestones and official events are displayed below. Officer remarks and internal notes are kept private.
            </p>
            <Stepper steps={getStepperSteps(appData.timeline)} orientation="vertical" />
          </Card>
        </div>
      )}
    </div>
  );
}
