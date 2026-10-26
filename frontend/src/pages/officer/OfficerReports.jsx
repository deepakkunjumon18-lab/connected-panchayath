import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileDown, 
  RefreshCw, 
  Send, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line
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
import { getOfficerReports } from '../../api/dashboard';

const STATUS_COLORS = {
  Pending: '#F59E0B',
  Approved: '#10B981',
  Rejected: '#EF4444',
  Cancelled: '#94A3B8'
};

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

export default function OfficerReports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getOfficerReports();
      setData(res.data || res);
    } catch (err) {
      toast.error('Failed to load verification reports');
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
        <p className="text-sm text-slate-500">Generating analytics and turnaround metrics...</p>
      </div>
    );
  }

  const {
    requests_by_status = { combined: [] },
    applications_by_certificate_type = [],
    monthly_trends = [],
    average_response_time_hours = 0,
    total_answered_requests = 0,
    overdue_list = []
  } = data || {};

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Verification Reports & Analytics"
        subtitle="Performance analytics, turnaround metrics, and statutory overdue tracking."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchReports}
            loading={loading}
            size="sm"
          >
            Refresh Data
          </Button>
        }
      />

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Avg Response Time"
          value={`${average_response_time_hours} hrs`}
          subtitle={`Across ${total_answered_requests} answered requests`}
          icon={Clock}
        />
        <StatCard
          title="Overdue Requests"
          value={overdue_list.length}
          subtitle="Past statutory due deadline"
          icon={AlertTriangle}
          className={overdue_list.length > 0 ? 'border-red-300 bg-red-50/20' : ''}
        />
        <StatCard
          title="Total Answered"
          value={total_answered_requests}
          subtitle="Inter-panchayat decisions"
          icon={CheckCircle2}
        />
        <StatCard
          title="Active Certificate Types"
          value={applications_by_certificate_type.length}
          subtitle="Handled by this Panchayat"
          icon={Layers}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Donut - Requests by Status */}
        <Card className="p-6">
          <div className="pb-4 border-b border-slate-200 mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Requests by Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of incoming & outgoing requests
            </p>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={requests_by_status.combined}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {requests_by_status.combined.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || '#3B82F6'} />
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
                  formatter={(value) => (
                    <span className="text-xs font-medium text-slate-700">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Bar - Applications by Certificate Type */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Applications by Certificate Type</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Volume of citizen requests received by category
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={FileDown}
              onClick={() => exportToCSV('applications_by_certificate_type', applications_by_certificate_type)}
            >
              Export
            </Button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={applications_by_certificate_type}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="certificate_code"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                />
                <Tooltip
                  formatter={(val, name, item) => [val, item.payload.certificate_name]}
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

        {/* Chart 3: Monthly Trends (Applications vs Certificates) */}
        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Monthly Service Volume (Last 6 Months)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison of applications received versus final certificates issued
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={FileDown}
              onClick={() => exportToCSV('monthly_trends', monthly_trends)}
            >
              Export
            </Button>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly_trends}
                margin={{ top: 10, right: 20, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="month_label"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748B' }}
                />
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
                  verticalAlign="top"
                  align="right"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-xs font-medium text-slate-700 capitalize">{value}</span>
                  )}
                />
                <Bar dataKey="applications" name="Applications Submitted" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="certificates" name="Certificates Issued" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Overdue Requests Table */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Overdue Verification Inquiries</h3>
              <Badge variant={overdue_list.length > 0 ? 'danger' : 'neutral'} size="sm">
                {overdue_list.length} Actionable
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pending requests past the statutory response window (OVERDUE_DAYS from master data).
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={FileDown}
            onClick={() => exportToCSV('overdue_verification_requests', overdue_list)}
            disabled={overdue_list.length === 0}
          >
            Export Overdue CSV
          </Button>
        </div>

        {overdue_list.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No Overdue Requests"
            description="All incoming and outgoing verification inquiries are currently within their statutory deadline."
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
                    <span className="text-[11px] text-slate-500">App: {row.application_no}</span>
                  </div>
                )
              },
              {
                header: 'Direction',
                accessor: 'direction',
                render: (val) => (
                  <Badge variant={val === 'INCOMING' ? 'warning' : 'info'} size="sm">
                    {val}
                  </Badge>
                )
              },
              {
                header: 'Applicant & Certificate',
                render: (_, row) => (
                  <div>
                    <span className="font-medium text-slate-900 block text-xs">{row.applicant_name}</span>
                    <span className="text-[11px] text-slate-500">{row.certificate_name}</span>
                  </div>
                )
              },
              {
                header: 'Subject Party',
                render: (_, row) => (
                  <div>
                    <span className="font-medium text-slate-800 text-xs block">{row.subject_name}</span>
                    <span className="text-[11px] text-slate-500 capitalize">{row.subject_party}</span>
                  </div>
                )
              },
              {
                header: 'Jurisdictions',
                render: (_, row) => (
                  <div className="text-xs text-slate-600">
                    <span>{row.requesting_panchayat_name} → {row.verifying_panchayat_name}</span>
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
            data={overdue_list}
          />
        )}
      </Card>
    </div>
  );
}
