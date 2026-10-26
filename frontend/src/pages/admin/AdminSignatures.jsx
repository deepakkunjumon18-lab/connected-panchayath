import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  FileDown, 
  Lock, 
  Copy, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { getAdminSignaturesAudit } from '../../api/dashboard';

function exportToCSV(filename, rows) {
  if (!rows || !rows.length) {
    toast.error('No audit records to export');
    return;
  }
  const keys = ['request_no', 'from_panchayat', 'to_panchayat', 'signer_name', 'signed_at', 'fingerprint', 'valid', 'reason'];
  const separator = ',';
  const csvContent = [
    keys.join(separator),
    ...rows.map((row) =>
      keys
        .map((k) => {
          let cell = row[k] === null || row[k] === undefined ? '' : row[k];
          cell = cell instanceof Date ? cell.toLocaleString() : String(cell).replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
          return cell;
        })
        .join(separator)
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}.csv`);
}

export default function AdminSignatures() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await getAdminSignaturesAudit();
      const auditResult = res.data?.data || res.data;
      setData(auditResult);
      setLastCheckTime(new Date());
      if (auditResult.totals?.invalid_count > 0) {
        toast.error(`Audit complete: ${auditResult.totals.invalid_count} signature anomalies detected!`);
      } else {
        toast.success(`Audit complete: All ${auditResult.totals?.valid_count || 0} signatures cryptographically verified!`);
      }
    } catch (err) {
      toast.error('Failed to run signature integrity audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleCopy = (fp) => {
    if (!fp) return;
    navigator.clipboard.writeText(fp);
    setCopiedFingerprint(fp);
    toast.success('Key fingerprint copied');
    setTimeout(() => setCopiedFingerprint(null), 2000);
  };

  const rows = data?.rows || [];
  const totals = data?.totals || { total_checked: 0, valid_count: 0, invalid_count: 0 };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Digital Signature Audit & Integrity Scanner"
        subtitle="Automated cryptographic validation of all RSA-2048 / SHA-256 signatures stored in Connected Panchayat."
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={FileDown}
              onClick={() => exportToCSV('signature_audit_results', rows)}
              disabled={rows.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              icon={RefreshCw}
              onClick={runAudit}
              loading={loading}
              size="sm"
            >
              Run Integrity Check
            </Button>
          </div>
        }
      />

      {/* Audit StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Signatures Scanned"
          value={totals.total_checked}
          subtitle={lastCheckTime ? `Last scanned at ${lastCheckTime.toLocaleTimeString()}` : 'Completed'}
          icon={Lock}
        />
        <StatCard
          title="Cryptographically Valid"
          value={totals.valid_count}
          subtitle="RSA-2048 & SHA-256 confirmed"
          icon={CheckCircle2}
          className="border-emerald-300 bg-emerald-50/20"
        />
        <StatCard
          title="Invalid / Tampered"
          value={totals.invalid_count}
          subtitle={totals.invalid_count > 0 ? 'CRITICAL ANOMALY' : 'No integrity failures'}
          icon={totals.invalid_count > 0 ? AlertTriangle : ShieldCheck}
          className={totals.invalid_count > 0 ? 'border-red-400 bg-red-50 text-red-900 shadow-sm' : ''}
        />
      </div>

      {/* Prominent Alert Banner if any signature is invalid */}
      {totals.invalid_count > 0 && (
        <div className="p-5 rounded-2xl bg-red-500/10 border-2 border-red-500/40 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <XCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-950">
              Integrity Alert: {totals.invalid_count} Signature Verification Failure(s) Detected
            </h3>
            <p className="text-xs sm:text-sm text-red-900 mt-1 leading-relaxed">
              One or more verification records failed cryptographic validation. The database record values do not match the signed canonical payload, or the RSA-2048 digital signature has been modified. Review the audit log below for root-cause analysis.
            </p>
          </div>
        </div>
      )}

      {/* Success Banner if all signatures valid */}
      {!loading && totals.invalid_count === 0 && totals.total_checked > 0 && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300/80 flex items-center gap-3 text-emerald-900 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <strong className="font-semibold block text-emerald-950">All Signatures Verified</strong>
            100% of inter-panchayat verification responses match their cryptographic SHA-256 digest and authorized officer public keys.
          </div>
        </div>
      )}

      {/* Results Table Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Audited Verification Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live results of RSA-SHA256 signature verification over every signed decision record.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {rows.length} records in scope
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Spinner size="lg" className="text-primary-600 mb-3" />
            <p className="text-xs text-slate-500 font-medium">Validating RSA-2048 signatures across all panchayats...</p>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Signed Requests Yet"
            description="When officers respond to inter-panchayat verification inquiries with their digital key, signed records will appear here."
          />
        ) : (
          <Table
            columns={[
              {
                header: 'Request No',
                accessor: 'request_no',
                render: (val, row) => (
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">{val}</span>
                    <span className="text-[11px] text-slate-500">App: #{row.application_id}</span>
                  </div>
                )
              },
              {
                header: 'Jurisdiction Route',
                render: (_, row) => (
                  <div className="text-xs">
                    <span className="font-medium text-slate-800">{row.from_panchayat}</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="font-semibold text-slate-900">{row.to_panchayat}</span>
                  </div>
                )
              },
              {
                header: 'Signer & Role',
                render: (_, row) => (
                  <div>
                    <span className="font-semibold text-slate-900 text-xs block">{row.signer_name}</span>
                    <span className="text-[11px] text-slate-500">{row.signer_designation || 'Verification Officer'}</span>
                  </div>
                )
              },
              {
                header: 'Signed Date',
                accessor: 'signed_at',
                render: (val) => val ? new Date(val).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : '—'
              },
              {
                header: 'Key Fingerprint',
                accessor: 'fingerprint',
                render: (val) => (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {val ? `${val.slice(0, 12)}...` : 'N/A'}
                    </span>
                    {val && (
                      <button
                        type="button"
                        onClick={() => handleCopy(val)}
                        className="text-slate-400 hover:text-slate-700 p-0.5"
                        title="Copy fingerprint"
                      >
                        {copiedFingerprint === val ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )
              },
              {
                header: 'Integrity Status',
                accessor: 'valid',
                render: (val, row) => (
                  <div>
                    <Badge variant={val ? 'success' : 'danger'} size="sm">
                      {val ? 'VALID' : 'INVALID / TAMPERED'}
                    </Badge>
                    {row.reason && (
                      <span className="block text-[10px] text-red-600 font-medium mt-1 leading-tight max-w-[200px]">
                        {row.reason}
                      </span>
                    )}
                  </div>
                )
              }
            ]}
            data={rows}
          />
        )}
      </Card>
    </div>
  );
}
