import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Inbox, 
  Search, 
  RefreshCw, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  FileCheck, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { getVerificationRequests, getVerificationCounts } from '../../api/verification';

export default function OfficerIncoming() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('PENDING');
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetchCounts = async () => {
    try {
      const res = await getVerificationCounts();
      const c = res.data?.incoming || { pending: 0, approved: 0, rejected: 0, overdue: 0 };
      setCounts(c);
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await getVerificationRequests({
        direction: 'incoming',
        status: activeTab,
        page,
        limit: 10,
        search: search || undefined
      });
      const data = res.data || res;
      setRequests(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load incoming verification requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [activeTab, page]);

  const tabs = [
    { id: 'PENDING', label: 'Pending Requests', count: counts.pending },
    { id: 'APPROVED', label: 'Approved & Signed', count: counts.approved },
    { id: 'REJECTED', label: 'Rejected', count: counts.rejected }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming Requests"
        subtitle="Verification requests sent by other Panchayats for residents registered in your jurisdiction. Review records and record digitally signed decisions."
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => { setActiveTab(id); setPage(1); }} />

      <Card>
        {/* Search & Refresh Filter */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <form
            onSubmit={(e) => { e.preventDefault(); setPage(1); fetchRequests(); }}
            className="relative flex-1 max-w-md"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by request no, subject, or applicant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </form>

          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => { fetchCounts(); fetchRequests(); }}
            loading={loading}
            size="sm"
          >
            Refresh
          </Button>
        </div>

        {/* Overdue alert if pending tab and overdue exists */}
        {activeTab === 'PENDING' && counts.overdue > 0 && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
            <Clock className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>
              <strong>{counts.overdue} request(s) are overdue!</strong> Kerala service delivery standards require answering requests within master-configured overdue days.
            </span>
          </div>
        )}

        {/* Requests Table */}
        <Table
          columns={[
            {
              header: 'Request No',
              accessor: 'request_no',
              render: (val, row) => (
                <div>
                  <Link
                    to={`/officer/incoming/${row.verification_id}`}
                    className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline block"
                  >
                    {val}
                  </Link>
                  <span className="text-[11px] text-slate-500 block">
                    App: {row.application_no}
                  </span>
                </div>
              )
            },
            {
              header: 'Requesting Panchayat',
              accessor: 'requesting_panchayat_name',
              render: (val, row) => (
                <div>
                  <span className="font-medium text-slate-900 block">{val}</span>
                  <span className="text-xs text-slate-500">Applicant: {row.applicant_name}</span>
                </div>
              )
            },
            {
              header: 'Certificate Type',
              accessor: 'certificate_name',
              render: (val) => (
                <span className="text-xs font-medium text-slate-800">{val}</span>
              )
            },
            {
              header: 'Subject in your Panchayat',
              accessor: 'subject_name',
              render: (val, row) => (
                <div>
                  <span className="font-semibold text-slate-900 block">{val}</span>
                  <span className="text-xs text-slate-500 capitalize">{row.subject_party}</span>
                </div>
              )
            },
            {
              header: 'Status & Due Date',
              render: (_, row) => (
                <div className="space-y-1">
                  <StatusBadge status={row.status} isOverdue={row.is_overdue} />
                  <span className="block text-[11px] text-slate-500">
                    Due: {new Date(row.due_at).toLocaleDateString('en-IN')}
                  </span>
                </div>
              )
            },
            {
              header: 'Action',
              render: (_, row) => (
                <div>
                  {row.status === 'PENDING' ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => navigate(`/officer/incoming/${row.verification_id}`)}
                    >
                      Review & Sign
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/officer/incoming/${row.verification_id}`)}
                    >
                      View Signed
                    </Button>
                  )}
                </div>
              )
            }
          ]}
          data={requests}
          loading={loading}
          rowClassName={(row) => row.is_overdue ? 'bg-red-50/70 hover:bg-red-100/70' : ''}
          emptyMessage={`No ${activeTab.toLowerCase()} requests found.`}
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
