import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Phone, 
  Mail, 
  User, 
  Search, 
  MapPin, 
  CheckCircle2, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { getPanchayatDirectory } from '../../api/dashboard';

export default function OfficerDirectory() {
  const { user } = useAuth();
  const [panchayats, setPanchayats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDirectory = async (searchTerm = '') => {
    setLoading(true);
    try {
      const res = await getPanchayatDirectory(searchTerm);
      const data = res.data?.data || res.data || [];
      setPanchayats(data);
    } catch (err) {
      toast.error('Failed to load panchayat directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDirectory(search);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Panchayat Directory"
        subtitle="Official directory of connected Panchayats and authorized verification officers across Kerala."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => { setSearch(''); fetchDirectory(''); }}
            loading={loading}
            size="sm"
          >
            Refresh
          </Button>
        }
      />

      {/* Search Input Bar */}
      <Card className="p-4 shadow-sm border border-slate-200">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by panchayat name, code, district, or officer name/email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm">
              Search
            </Button>
            {search && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setSearch(''); fetchDirectory(''); }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Spinner size="lg" className="text-primary-600 mb-3" />
          <p className="text-sm text-slate-500">Loading directory listings...</p>
        </div>
      ) : panchayats.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No Panchayats Found"
            description={search ? `No results matching "${search}". Try searching by district or code.` : 'No active Panchayats registered in the directory.'}
          />
        </Card>
      ) : (
        /* Searchable Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {panchayats.map((p) => {
            const isMyPanchayat = p.panchayat_id === user?.panchayat_id;
            return (
              <Card
                key={p.panchayat_id}
                className={`p-5 flex flex-col justify-between transition hover:shadow-md ${
                  isMyPanchayat 
                    ? 'border-2 border-blue-500 bg-blue-50/20 shadow-xs' 
                    : 'border border-slate-200'
                }`}
              >
                <div>
                  {/* Card Header: Name, Code & Badge */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight">
                          {p.panchayat_name}
                        </h3>
                        {isMyPanchayat && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white tracking-wide">
                            YOUR PANCHAYAT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {p.panchayat_code}
                        </span>
                        <span>•</span>
                        <span>District: <strong className="text-slate-700">{p.district}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Address */}
                  <div className="py-3 space-y-1.5 text-xs text-slate-600 border-b border-slate-100">
                    {p.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="text-[11px] leading-snug">{p.address}</span>
                      </div>
                    )}
                    {p.contact_no && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <a href={`tel:${p.contact_no}`} className="text-[11px] text-blue-600 hover:underline">
                          {p.contact_no}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Active Officers List */}
                  <div className="pt-3">
                    <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider block mb-2">
                      Authorized Verification Officers ({p.officers?.length || 0})
                    </span>

                    {!p.officers || p.officers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No active officers registered.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {p.officers.map((officer) => (
                          <div
                            key={officer.officer_id}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-blue-600" />
                                {officer.full_name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                                {officer.designation}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                              {officer.email && (
                                <a
                                  href={`mailto:${officer.email}`}
                                  className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 transition"
                                >
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span className="truncate max-w-[150px]">{officer.email}</span>
                                </a>
                              )}
                              {officer.mobile && (
                                <a
                                  href={`tel:${officer.mobile}`}
                                  className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 transition"
                                >
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{officer.mobile}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Inter-Panchayat Verified
                  </span>
                  <span className="font-mono text-slate-600">ID: #{p.panchayat_id}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
