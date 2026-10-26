import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  ShieldAlert,
  Clock
} from 'lucide-react';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'CREATE_USER', label: 'CREATE_USER' },
  { value: 'UPDATE_USER', label: 'UPDATE_USER' },
  { value: 'RESET_PASSWORD', label: 'RESET_PASSWORD' },
  { value: 'CHANGE_PASSWORD', label: 'CHANGE_PASSWORD' },
  { value: 'TOGGLE_STATUS', label: 'TOGGLE_STATUS' },
  { value: 'UPDATE_CERT_TYPE', label: 'UPDATE_CERT_TYPE' },
  { value: 'CREATE_PANCHAYAT', label: 'CREATE_PANCHAYAT' },
  { value: 'CREATE_APPLICATION', label: 'CREATE_APPLICATION' },
  { value: 'VERIFY_REQUEST', label: 'VERIFY_REQUEST' },
  { value: 'SIGN_RESPONSE', label: 'SIGN_RESPONSE' },
  { value: 'ISSUE_CERTIFICATE', label: 'ISSUE_CERTIFICATE' }
];

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...(actionFilter && { action: actionFilter }),
        ...(userIdFilter && { user_id: userIdFilter }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate })
      });

      const res = await axios.get(`/api/admin/audit-logs?${params.toString()}`);
      if (res.data?.success && res.data?.data) {
        setLogs(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit, actionFilter]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act.includes('LOGIN')) return <Badge variant="neutral" size="sm">{act}</Badge>;
    if (act.includes('SIGN')) return <Badge variant="success" size="sm">{act}</Badge>;
    if (act.includes('RESET') || act.includes('DEACTIVATE')) return <Badge variant="danger" size="sm">{act}</Badge>;
    if (act.includes('CREATE') || act.includes('ISSUE')) return <Badge variant="info" size="sm">{act}</Badge>;
    if (act.includes('UPDATE') || act.includes('VERIFY')) return <Badge variant="purple" size="sm">{act}</Badge>;
    return <Badge variant="neutral" size="sm">{act}</Badge>;
  };

  const columns = [
    {
      header: 'Timestamp',
      accessor: (row) => {
        const timeVal = row.action_time || row.created_at;
        return (
          <div className="text-xs">
            <div className="font-medium text-ink">
              {timeVal ? new Date(timeVal).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }) : '—'}
            </div>
            <div className="text-ink-light">
              {timeVal ? new Date(timeVal).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              }) : ''}
            </div>
          </div>
        );
      }
    },
    {
      header: 'User / Actor',
      accessor: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-ink">
            {row.full_name || row.username || `User #${row.user_id || 'System'}`}
          </div>
          {row.role_name && (
            <span className="text-[11px] text-ink-muted">Role: {row.role_name}</span>
          )}
        </div>
      )
    },
    {
      header: 'Action',
      accessor: (row) => getActionBadge(row.action)
    },
    {
      header: 'Target Entity',
      accessor: (row) => {
        const tbl = row.table_name || row.target_table;
        const recId = row.record_id || row.target_id;
        return (
          <div className="text-xs font-mono text-ink-muted">
            {tbl ? (
              <span>
                {tbl} <strong className="text-ink">#{recId || ''}</strong>
              </span>
            ) : (
              '—'
            )}
          </div>
        );
      }
    },
    {
      header: 'Details',
      accessor: (row) => (
        <div className="text-xs text-ink max-w-sm truncate" title={row.description}>
          {row.description || '—'}
        </div>
      )
    },
    {
      header: 'IP Address',
      accessor: (row) => (
        <span className="font-mono text-[11px] text-ink-light">
          {row.ip_address || '127.0.0.1'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable security trail of administrative changes, digital signature verification events, and logins."
      />

      {/* Filter Card */}
      <Card>
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Select
            label="Filter Action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            options={ACTION_TYPES}
          />

          <Input
            label="User ID"
            placeholder="e.g. 1"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
          />

          <Input
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <Input
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <Button type="submit" variant="secondary" icon={Filter}>
            Apply Filters
          </Button>
        </form>
      </Card>

      {/* Audit Log Table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={logs}
          loading={loading}
          keyExtractor={(row) => row.log_id || row.id}
          emptyText="No audit logs recorded for the selected parameters."
        />

        <div className="p-4 border-t border-line">
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / limit) || 1}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </Card>
    </div>
  );
}
