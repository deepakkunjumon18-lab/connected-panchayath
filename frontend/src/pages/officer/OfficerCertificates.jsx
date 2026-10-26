import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Award, 
  Download, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText 
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getCertificates, downloadCertificateBlob } from '../../api/certificates';

export default function OfficerCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await getCertificates({
        page,
        limit: 10,
        search: search.trim() || undefined
      });
      const data = res.data || res;
      setCertificates(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCertificates();
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Verification code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issued Certificates"
        subtitle="Repository of all certificates officially generated and signed by this Panchayat."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchCertificates}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      <Card>
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by certificate no, citizen, or verification code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </form>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setPage(1);
                setTimeout(fetchCertificates, 0);
              }}
            >
              Clear Search
            </Button>
          )}
        </div>

        {/* Certificates Table */}
        <Table
          columns={[
            {
              header: 'Certificate No',
              accessor: 'certificate_no',
              render: (val, row) => (
                <div>
                  <span className="font-mono font-bold text-slate-900 block">{val}</span>
                  <Link
                    to={`/officer/applications/${row.application_id}`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <FileText className="w-3 h-3" />
                    App: {row.application_no}
                  </Link>
                </div>
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
              header: 'Citizen / Holder',
              accessor: 'holder_name',
              render: (val) => (
                <span className="font-medium text-slate-900">{val}</span>
              )
            },
            {
              header: 'Issue Date',
              accessor: 'issue_date',
              render: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '—'
            },
            {
              header: 'Valid Until',
              accessor: 'valid_until',
              render: (val) => {
                if (!val) return 'Permanent';
                const isExpired = new Date(val) < new Date();
                return (
                  <span className={isExpired ? 'text-red-600 font-medium' : 'text-slate-700'}>
                    {new Date(val).toLocaleDateString('en-IN')}
                    {isExpired && ' (Expired)'}
                  </span>
                );
              }
            },
            {
              header: 'Verification Code',
              accessor: 'verification_code',
              render: (val) => (
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">
                    {val}
                  </span>
                  <button
                    type="button"
                    title="Copy verification code"
                    onClick={() => handleCopyCode(val)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                  >
                    {copiedCode === val ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )
            },
            {
              header: 'Status',
              accessor: 'status',
              render: (val) => (
                <Badge variant={val === 'ACTIVE' ? 'success' : val === 'EXPIRED' ? 'warning' : 'danger'}>
                  {val}
                </Badge>
              )
            },
            {
              header: 'Actions',
              render: (_, row) => (
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Download}
                    loading={downloadingId === row.certificate_id}
                    onClick={() => handleDownload(row)}
                  >
                    PDF
                  </Button>
                  <a
                    href={`/verify/${row.verification_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Verify on public portal"
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )
            }
          ]}
          data={certificates}
          loading={loading}
          emptyMessage="No certificates found matching your search."
        />

        {total > 10 && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              page={page}
              total={total}
              limit={10}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
