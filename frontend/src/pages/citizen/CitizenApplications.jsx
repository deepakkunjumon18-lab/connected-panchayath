import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Calendar,
  Building,
  Clock,
  ArrowRight
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_EXTERNAL', label: 'Pending External Verification' },
  { value: 'READY_FOR_DECISION', label: 'Ready for Decision' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CERTIFICATE_ISSUED', label: 'Certificate Issued' },
  { value: 'REJECTED', label: 'Rejected' }
];

export default function CitizenApplications() {
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...(statusFilter && { status: statusFilter }),
        ...(search && { search })
      });

      const res = await axios.get(`/api/applications?${params.toString()}`);
      if (res.data?.success && res.data?.data) {
        setApplications(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [page, limit, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const columns = [
    {
      header: 'Application No',
      accessor: (row) => (
        <div>
          <div className="font-mono font-bold text-ink text-sm">
            {row.application_no}
          </div>
          <span className="text-xs text-ink-muted">{row.purpose}</span>
        </div>
      )
    },
    {
      header: 'Certificate Type',
      accessor: (row) => (
        <div>
          <div className="font-semibold text-ink text-sm">
            {row.certificate_name}
          </div>
          <span className="text-xs font-mono text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
            {row.certificate_code}
          </span>
        </div>
      )
    },
    {
      header: 'Submitted Date',
      accessor: (row) => (
        <span className="text-xs text-ink">
          {new Date(row.submitted_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </span>
      )
    },
    {
      header: 'Verifications',
      accessor: (row) => {
        const total = Number(row.total_requests_count) || 0;
        const pending = Number(row.pending_requests_count) || 0;

        if (total === 0) {
          return <span className="text-xs text-emerald-700 font-medium">Local records</span>;
        }

        if (pending > 0) {
          return (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {pending} of {total} pending
            </span>
          );
        }

        return (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            All {total} completed
          </span>
        );
      }
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Action',
      accessor: (row) => (
        <Link to={`/citizen/applications/${row.application_id}`}>
          <Button variant="outline" size="sm" icon={Eye}>
            View
          </Button>
        </Link>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Applications"
        subtitle="Track submitted certificate requests and monitor inter-panchayat verification progress in real time."
        action={
          <Link to="/citizen/apply">
            <Button variant="primary" icon={Plus}>
              New Application
            </Button>
          </Link>
        }
      />

      {/* Filter toolbar */}
      <Card>
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search by application no or certificate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />

          <Button type="submit" variant="secondary" icon={Search}>
            Filter
          </Button>
        </form>
      </Card>

      {/* Applications Table Card */}
      <Card padding="none">
        {applications.length === 0 && !loading ? (
          <div className="py-12">
            <EmptyState
              icon={FileText}
              title="No Applications Found"
              description="You have not submitted any certificate applications yet, or none match your search."
              action={
                <Link to="/citizen/apply">
                  <Button variant="primary" icon={Plus}>
                    Apply for a Certificate
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={applications}
              loading={loading}
              keyExtractor={(row) => row.application_id}
            />

            <div className="p-4 border-t border-line">
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / limit) || 1}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
