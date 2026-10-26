import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import {
  Users,
  Building,
  FileCheck,
  ShieldCheck,
  Activity,
  Database,
  ArrowRight,
  Shield,
  Layers,
  FileText,
  BarChart3,
  TrendingUp,
  AlertTriangle
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
  CartesianGrid
} from 'recharts';
import { getAdminReportsSummary } from '../../api/dashboard';

const STATUS_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, summaryRes] = await Promise.all([
        axios.get('/api/admin/stats'),
        getAdminReportsSummary()
      ]);

      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }
      if (summaryRes.data?.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect to admin API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Admin Control Centre"
        subtitle="System-wide administration of local Panchayats, officer cryptographic keys, certificate schemas, and security audits."
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin/reports">
              <Button variant="outline" size="sm" icon={BarChart3}>
                Full Reports
              </Button>
            </Link>
            <Button variant="secondary" size="sm" onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {error && <Alert type="danger" message={error} />}

      {/* 4 StatCards */}
      {loading && !stats ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" className="text-primary-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total System Users"
            value={stats?.total_users ?? 0}
            subtitle={`${stats?.total_citizens ?? 0} citizens • ${stats?.total_officers ?? 0} officers`}
            icon={Users}
          />
          <StatCard
            title="Panchayat Officers"
            value={stats?.total_officers ?? 0}
            subtitle="Registered RSA-2048 keys"
            icon={ShieldCheck}
          />
          <StatCard
            title="Active Panchayats"
            value={stats?.total_panchayats ?? 0}
            subtitle="Local authorities connected"
            icon={Building}
          />
          <StatCard
            title="Verification Requests"
            value={stats?.total_verifications ?? 0}
            subtitle={
              summary?.overdue_requests?.length > 0 
                ? `${summary.overdue_requests.length} overdue statewide` 
                : 'All within SLA'
            }
            icon={FileText}
            className={summary?.overdue_requests?.length > 0 ? 'border-red-300 bg-red-50/20' : ''}
          />
        </div>
      )}

      {/* Summary Charts Row */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications by Status */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Applications by Status</h4>
                <p className="text-xs text-slate-500">Live distribution of all citizen applications</p>
              </div>
              <Link to="/admin/reports" className="text-xs font-semibold text-blue-600 hover:underline">
                Reports →
              </Link>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.applications_by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {(summary.applications_by_status || []).map((_, idx) => (
                      <Cell key={`c-${idx}`} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
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

          {/* Applications by Certificate Type */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Applications by Certificate Type</h4>
                <p className="text-xs text-slate-500">Breakdown of statutory certificates requested</p>
              </div>
              <Link to="/admin/reports" className="text-xs font-semibold text-blue-600 hover:underline">
                Details →
              </Link>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.applications_by_certificate_type}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="certificate_code" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
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
        </div>
      )}

      {/* Navigation Quick Actions */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
          Administrative Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-blue-100 text-blue-700">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">User Management</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Provision Panchayat officers, generate cryptographic keys, reset credentials, or manage citizen accounts.
            </p>
            <Link
              to="/admin/users"
              className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Users <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Card>

          <Card className="p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-purple-100 text-purple-700">
                <Building className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Panchayat Registry</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Configure connected Grama Panchayats, official codes, district jurisdictions, and status.
            </p>
            <Link
              to="/admin/panchayats"
              className="inline-flex items-center text-xs font-semibold text-purple-600 hover:text-purple-800"
            >
              Configure Panchayats <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Card>

          <Card className="p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
                <FileCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Certificate Types</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Customise required documents and cross-panchayat verification rules using visual builders.
            </p>
            <Link
              to="/admin/certificate-types"
              className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-800"
            >
              Configure Types <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Card>

          <Card className="p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-amber-100 text-amber-700">
                <Database className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Master Data</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Manage dropdown constants, system parameters, purpose codes, and SLA timeout configurations.
            </p>
            <Link
              to="/admin/master-data"
              className="inline-flex items-center text-xs font-semibold text-amber-600 hover:text-amber-800"
            >
              Manage Master Data <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Card>

          <Card className="p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-rose-100 text-rose-700">
                <Activity className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Audit Logs</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Immutable activity ledger of officer decisions, digital signatures, logins, and schema modifications.
            </p>
            <Link
              to="/admin/audit-logs"
              className="inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-800"
            >
              View Audit Trail <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Card>

          <Card className="p-5 hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-xl bg-sky-100 text-sky-700">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Signature Integrity Audit</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Automated cryptographic batch verification scanner checking all stored responses against public keys.
            </p>
            <Link
              to="/admin/signatures"
              className="inline-flex items-center text-xs font-semibold text-sky-600 hover:text-sky-800"
            >
              Verify Signatures <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
