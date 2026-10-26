import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  FileDown, 
  RefreshCw, 
  Building2, 
  Users, 
  Award, 
  Clock, 
  AlertTriangle, 
  Mail, 
  ArrowLeftRight,
  TrendingUp,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Table from '../../components/ui/Table';
import EmptyState from '../../components/ui/EmptyState';
import { getAdminReportsSummary } from '../../api/dashboard';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

function exportToCSV(filename, rows) {
  if (!rows || !rows.length) {
    toast.error('No data available to export');
    return;
  }
  const keys = Object.keys(rows[0]);
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

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getAdminReportsSummary();
      setData(res.data?.data || res.data);
    } catch (err) {
      toast.error('Failed to load system reports summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Spinner size="lg" className="text-primary-600 mb-3" />
        <p className="text-sm text-slate-500">Compiling statewide local governance analytics...</p>
      </div>
    );
  }

  const {
    users_by_role = [],
    panchayats_count = { total: 0, active: 0, inactive: 0 },
    applications_by_status = [],
    applications_by_certificate_type = [],
    applications_per_panchayat = [],
    requests_between_panchayats = [],
    average_response_hours_per_panchayat = [],
    certificates_per_month = [],
    overdue_requests = [],
    notifications_email_status = []
  } = data || {};

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Statewide Reports & System Intelligence"
        subtitle="Cross-jurisdictional analytics, inter-panchayat turnaround times, and statutory delivery tracking."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchReports}
            loading={loading}
            size="sm"
          >
            Refresh Summary
          </Button>
        }
      />

      {/* Top 4 Macro StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Active Panchayats"
          value={panchayats_count.active}
          subtitle={`${panchayats_count.total} total in registry`}
          icon={Building2}
        />
        <StatCard
          title="System Users"
          value={users_by_role.reduce((acc, u) => acc + u.count, 0)}
          subtitle={`${users_by_role.find(u => u.role_name === 'OFFICER')?.count || 0} verification officers`}
          icon={Users}
        />
        <StatCard
          title="Inter-Panchayat Pairs"
          value={requests_between_panchayats.length}
          subtitle="Cross-verifying routes"
          icon={ArrowLeftRight}
        />
        <StatCard
          title="Statewide Overdue"
          value={overdue_requests.length}
          subtitle="Inquiries past due_at"
          icon={AlertTriangle}
          className={overdue_requests.length > 0 ? 'border-red-300 bg-red-50/20' : ''}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Applications by Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Applications by Status</h3>
              <p className="text-xs text-slate-500 mt-0.5">Current workflow state across all panchayats</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={FileDown}
              onClick={() => exportToCSV('applications_by_status', applications_by_status)}
            >
              Export
            </Button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={applications_by_status}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {applications_by_status.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#FFF',
                    fontSize: '12px'
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(val) => <span className="text-xs text-slate-700 font-medium">{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Monthly Certificates Issued */}
        <Card className="p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Monthly Certificate Output (Last 6 Months)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Total officially issued PDF certificates</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={FileDown}
              onClick={() => exportToCSV('monthly_certificates_issued', certificates_per_month)}
            >
              Export
            </Button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={certificates_per_month} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#FFF',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" name="Certificates Issued" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 3: Applications per Panchayat */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Citizen Applications by Home Panchayat</h3>
              <p className="text-xs text-slate-500 mt-0.5">Application load distributed across local authorities</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={FileDown}
              onClick={() => exportToCSV('applications_per_panchayat', applications_per_panchayat)}
            >
              Export
            </Button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={applications_per_panchayat} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="panchayat_code" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val, name, item) => [val, `${item.payload.panchayat_name} (${item.payload.district})`]}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '0.75rem',
                    border: 'none',
                    color: '#FFF',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Table 1: Top Inter-Panchayat Pairs */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Top Inter-Panchayat Verification Corridors</h3>
            <p className="text-xs text-slate-500 mt-0.5">Top 10 most frequent verification inquiries between Panchayat pairs</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={FileDown}
            onClick={() => exportToCSV('inter_panchayat_corridors', requests_between_panchayats)}
          >
            Export CSV
          </Button>
        </div>

        {requests_between_panchayats.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No cross-panchayat verification requests recorded.</p>
        ) : (
          <Table
            columns={[
              {
                header: 'Requesting Panchayat (Home)',
                accessor: 'from_panchayat',
                render: (val, row) => (
                  <div>
                    <span className="font-semibold text-slate-900 text-xs">{val}</span>
                    <span className="font-mono text-[11px] text-slate-500 block">Code: {row.from_code}</span>
                  </div>
                )
              },
              {
                header: 'Verifying Panchayat (Peer)',
                accessor: 'to_panchayat',
                render: (val, row) => (
                  <div>
                    <span className="font-semibold text-slate-900 text-xs">{val}</span>
                    <span className="font-mono text-[11px] text-slate-500 block">Code: {row.to_code}</span>
                  </div>
                )
              },
              {
                header: 'Total Inquiries Routed',
                accessor: 'request_count',
                render: (val) => (
                  <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {val} requests
                  </span>
                )
              }
            ]}
            data={requests_between_panchayats}
          />
        )}
      </Card>

      {/* Table 2: Average Response Times per Panchayat */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Panchayat Turnaround Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">Average response hours for incoming verification requests answered</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={FileDown}
            onClick={() => exportToCSV('panchayat_response_times', average_response_hours_per_panchayat)}
          >
            Export CSV
          </Button>
        </div>

        {average_response_hours_per_panchayat.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No answered verification requests recorded yet.</p>
        ) : (
          <Table
            columns={[
              {
                header: 'Panchayat',
                accessor: 'panchayat_name',
                render: (val, row) => (
                  <div>
                    <span className="font-semibold text-slate-900 text-xs">{val}</span>
                    <span className="text-[11px] text-slate-500 block">{row.panchayat_code} • {row.district}</span>
                  </div>
                )
              },
              {
                header: 'Total Decisions Signed',
                accessor: 'total_answered',
                render: (val) => <span className="font-mono text-xs">{val}</span>
              },
              {
                header: 'Average Response Time',
                accessor: 'avg_response_hours',
                render: (val) => (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    val <= 24 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {val} hours
                  </span>
                )
              }
            ]}
            data={average_response_hours_per_panchayat}
          />
        )}
      </Card>

      {/* Table 3: Statewide Overdue Inquiries */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Statewide Overdue Inquiries</h3>
              <Badge variant={overdue_requests.length > 0 ? 'danger' : 'neutral'} size="sm">
                {overdue_requests.length} Requests
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Requests currently pending past their statutory deadline across all local governments</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={FileDown}
            onClick={() => exportToCSV('statewide_overdue_requests', overdue_requests)}
            disabled={overdue_requests.length === 0}
          >
            Export Overdue CSV
          </Button>
        </div>

        {overdue_requests.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Zero Overdue Inquiries"
            description="All inter-panchayat verification requests statewide are within their response window."
          />
        ) : (
          <Table
            columns={[
              {
                header: 'Request No',
                accessor: 'request_no',
                render: (val, row) => (
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900 block">{val}</span>
                    <span className="text-[11px] text-slate-500">App: {row.application_no}</span>
                  </div>
                )
              },
              {
                header: 'Route (From → To)',
                render: (_, row) => (
                  <div className="text-xs">
                    <span className="text-slate-700">{row.requesting_panchayat_name}</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="font-medium text-slate-900">{row.verifying_panchayat_name}</span>
                  </div>
                )
              },
              {
                header: 'Subject & Purpose',
                render: (_, row) => (
                  <div>
                    <span className="font-medium text-slate-900 text-xs block">{row.subject_name} ({row.subject_party})</span>
                    <span className="text-[11px] text-slate-500">{row.certificate_name}</span>
                  </div>
                )
              },
              {
                header: 'Due Date',
                accessor: 'due_at',
                render: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '—'
              },
              {
                header: 'Overdue By',
                accessor: 'days_overdue',
                render: (val) => (
                  <span className="font-bold text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    {val} days
                  </span>
                )
              }
            ]}
            data={overdue_requests}
          />
        )}
      </Card>
    </div>
  );
}
