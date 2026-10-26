import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import {
  FileText,
  Home,
  Shield,
  Coins,
  MapPin,
  Users,
  Building,
  ArrowRight,
  FileCheck
} from 'lucide-react';

const ICON_MAP = {
  EWS: Shield,
  INCOME: Coins,
  RESIDENCE: Home,
  NATIVITY: MapPin,
  FAMILY_MEMBERSHIP: Users,
  POSSESSION: Building
};

export default function CitizenApply() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTypes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/certificate-types');
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.data)
        ? res.data.data
        : null;

      if (list) {
        setTypes(list);
      } else {
        setError(res?.data?.message || res?.message || 'Failed to load certificate types');
      }
    } catch (err) {
      setError('Failed to connect to the server to fetch available certificates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const getPartyLabel = (party) => {
    switch (party) {
      case 'FATHER':
        return "Father's Panchayat";
      case 'MOTHER':
        return "Mother's Panchayat";
      case 'PROPERTY':
        return "Property Panchayat";
      default:
        return `${party} Panchayat`;
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Apply for Certificate"
        subtitle="Select a government certificate to start the 4-step digital application wizard. Cross-panchayat verifications are coordinated automatically."
      />

      {error && <Alert type="danger" message={error} />}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-ink-muted text-sm">Loading available certificate types...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {types.map((type) => {
            const code = type.certificate_code || type.code;
            const Icon = ICON_MAP[code] || FileText;

            let parties = [];
            try {
              parties = typeof type.verification_parties === 'string'
                ? JSON.parse(type.verification_parties)
                : type.verification_parties || [];
            } catch (e) {
              parties = [];
            }

            return (
              <Card
                key={type.certificate_type_id}
                className="flex flex-col justify-between hover:shadow-lg transition-all duration-200 border-line hover:border-primary-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="neutral" size="sm">
                      {code}
                    </Badge>
                  </div>

                  <h3 className="text-lg font-bold text-ink mb-2">
                    {type.certificate_name}
                  </h3>

                  <p className="text-xs text-ink-muted leading-relaxed mb-6 line-clamp-3">
                    {type.description || 'Official government certificate issued after inter-panchayat verification.'}
                  </p>

                  {/* Verification chips */}
                  <div className="mb-6">
                    <div className="text-[11px] font-semibold text-ink-light uppercase tracking-wider mb-2">
                      Cross-Verification
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parties.length > 0 ? (
                        parties.map((party) => (
                          <span
                            key={party}
                            className="inline-flex items-center text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md"
                          >
                            {getPartyLabel(party)}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Home Panchayat Only
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-between">
                  <span className="text-xs text-ink-light font-medium">
                    Validity: {type.validity_months || 12} mo
                  </span>

                  <Link to={`/citizen/apply/${code}`}>
                    <Button variant="primary" size="sm" icon={ArrowRight}>
                      Apply Now
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
