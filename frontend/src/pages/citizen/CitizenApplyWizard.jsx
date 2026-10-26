import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Stepper from '../../components/ui/Stepper';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Checkbox from '../../components/ui/Checkbox';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  FileText,
  User,
  Building,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Plus,
  Calendar,
  Phone,
  Mail,
  Home,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

const STEP_TITLES = [
  'Applicant Details',
  'Family & Property',
  'Document Upload',
  'Review & Submit'
];

export default function CitizenApplyWizard() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Loading & Reference Data
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState('');
  const [certType, setCertType] = useState(null);
  const [panchayats, setPanchayats] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [occupations, setOccupations] = useState([]);

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  // Form Data - Step 1
  const [purposeCode, setPurposeCode] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');

  // Form Data - Step 2
  const [familyIncome, setFamilyIncome] = useState('');
  const [landHolding, setLandHolding] = useState('0');
  const [houseArea, setHouseArea] = useState('0');
  const [otherProperty, setOtherProperty] = useState('');
  const [partiesData, setPartiesData] = useState({});

  // Form Data - Step 3: Documents
  // requiredDocsMap: { [docType]: File }
  const [docFiles, setDocFiles] = useState({});
  // extraDocs: [{ id, label, related_to, file }]
  const [extraDocs, setExtraDocs] = useState([]);

  // Form Data - Step 4
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  // Warn before leaving if form is dirty
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !submittedResult) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, submittedResult]);

  // Load Certificate Type, Panchayats, Master Data
  useEffect(() => {
    async function loadData() {
      setInitLoading(true);
      setInitError('');
      try {
        const [ctRes, pRes, purpRes, occRes] = await Promise.all([
          axios.get('/api/certificate-types'),
          axios.get('/api/panchayats/public'),
          axios.get('/api/master-data/PURPOSE'),
          axios.get('/api/master-data/OCCUPATION')
        ]);

        const allTypes = Array.isArray(ctRes?.data?.data)
          ? ctRes.data.data
          : Array.isArray(ctRes?.data)
          ? ctRes.data
          : Array.isArray(ctRes)
          ? ctRes
          : [];

        const matched = allTypes.find(
          (t) => (t.certificate_code || t.code)?.toUpperCase() === code?.toUpperCase()
        );

        if (!matched) {
          setInitError(`Certificate type "${code}" was not found or is inactive.`);
          setInitLoading(false);
          return;
        }

        const pList = Array.isArray(pRes?.data?.data)
          ? pRes.data.data
          : Array.isArray(pRes?.data)
          ? pRes.data
          : Array.isArray(pRes)
          ? pRes
          : [];

        const purpList = Array.isArray(purpRes?.data?.data)
          ? purpRes.data.data
          : Array.isArray(purpRes?.data)
          ? purpRes.data
          : Array.isArray(purpRes)
          ? purpRes
          : [];

        const occList = Array.isArray(occRes?.data?.data)
          ? occRes.data.data
          : Array.isArray(occRes?.data)
          ? occRes.data
          : Array.isArray(occRes)
          ? occRes
          : [];

        setCertType(matched);
        setPanchayats(pList);
        setPurposes(purpList);
        setOccupations(occList);

        // Initialise parties structure from certificate type's verification_parties
        let reqParties = [];
        try {
          reqParties = typeof matched.verification_parties === 'string'
            ? JSON.parse(matched.verification_parties)
            : matched.verification_parties || [];
        } catch (e) {
          reqParties = [];
        }

        const initialParties = {};
        for (const p of reqParties) {
          initialParties[p] = {
            party_type: p,
            full_name: '',
            aadhaar_no: '',
            occupation: 'OTHER',
            annual_income: '0',
            property_details: '',
            panchayat_id: user?.panchayat_id ? String(user.panchayat_id) : ''
          };
        }
        setPartiesData(initialParties);
      } catch (err) {
        setInitError('Failed to load application wizard data from server.');
      } finally {
        setInitLoading(false);
      }
    }

    if (code) {
      loadData();
    }
  }, [code, user]);

  // Helper for step navigation validation
  const validateStep = (step) => {
    if (step === 0) {
      if (!purposeCode) {
        toast.error('Please select a purpose for your application');
        return false;
      }
      if (purposeCode === 'OTHER' && !customPurpose.trim()) {
        toast.error('Please specify your custom purpose');
        return false;
      }
      return true;
    }

    if (step === 1) {
      if (familyIncome === '' || Number(familyIncome) < 0) {
        toast.error('Please enter a valid declared family income');
        return false;
      }
      if (Number(landHolding) < 0 || Number(houseArea) < 0) {
        toast.error('Land holding and house area must be 0 or positive');
        return false;
      }

      // Validate required parties
      let reqParties = [];
      try {
        reqParties = typeof certType.verification_parties === 'string'
          ? JSON.parse(certType.verification_parties)
          : certType.verification_parties || [];
      } catch (e) {
        reqParties = [];
      }

      for (const p of reqParties) {
        const pObj = partiesData[p];
        if (!pObj || !pObj.full_name?.trim()) {
          toast.error(`Please provide the full name for ${p}`);
          return false;
        }
        if (!pObj.panchayat_id) {
          toast.error(`Please select the record Panchayat for ${p}`);
          return false;
        }
        if (pObj.aadhaar_no && !/^\d{12}$/.test(pObj.aadhaar_no.trim())) {
          toast.error(`Aadhaar for ${p} must be exactly 12 digits (or leave blank)`);
          return false;
        }
      }
      return true;
    }

    if (step === 2) {
      // Validate mandatory documents
      let reqDocs = [];
      try {
        reqDocs = typeof certType.required_documents === 'string'
          ? JSON.parse(certType.required_documents)
          : certType.required_documents || [];
      } catch (e) {
        reqDocs = [];
      }

      for (const d of reqDocs) {
        if (d.mandatory && !docFiles[d.type]) {
          toast.error(`Mandatory document missing: "${d.label || d.type}"`);
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(STEP_TITLES.length - 1, prev + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Document File Picker Handler
  const handleFileChange = (docType, file) => {
    if (!file) return;

    // Client-side file type check
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, JPEG, and PNG files are supported');
      return;
    }

    // 5 MB size check
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size cannot exceed 5 MB');
      return;
    }

    setDocFiles((prev) => ({ ...prev, [docType]: file }));
    setIsDirty(true);
  };

  const handleRemoveFile = (docType) => {
    setDocFiles((prev) => {
      const copy = { ...prev };
      delete copy[docType];
      return copy;
    });
  };

  // Add Extra Document Handlers
  const handleAddExtraDoc = () => {
    if (extraDocs.length >= 3) {
      toast.error('Maximum 3 additional documents allowed');
      return;
    }
    setExtraDocs((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: '',
        related_to: 'APPLICANT',
        file: null
      }
    ]);
  };

  const handleExtraDocChange = (idx, field, value) => {
    setExtraDocs((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
    setIsDirty(true);
  };

  const handleRemoveExtraDoc = (idx) => {
    setExtraDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  // Final Form Submission
  const handleSubmitApplication = async () => {
    if (!declared) {
      toast.error('Please confirm the self-declaration checkbox before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const purpose = purposeCode === 'OTHER' ? customPurpose.trim() : purposeCode;

      // Build parties array
      let reqParties = [];
      try {
        reqParties = typeof certType.verification_parties === 'string'
          ? JSON.parse(certType.verification_parties)
          : certType.verification_parties || [];
      } catch (e) {
        reqParties = [];
      }

      const parties = reqParties.map((p) => {
        const item = partiesData[p];
        return {
          party_type: p,
          full_name: item.full_name.trim(),
          aadhaar_no: item.aadhaar_no ? item.aadhaar_no.trim() : null,
          occupation: item.occupation,
          annual_income: Number(item.annual_income) || 0,
          property_details: item.property_details ? item.property_details.trim() : null,
          panchayat_id: Number(item.panchayat_id)
        };
      });

      // Build fileMeta and files list
      let reqDocs = [];
      try {
        reqDocs = typeof certType.required_documents === 'string'
          ? JSON.parse(certType.required_documents)
          : certType.required_documents || [];
      } catch (e) {
        reqDocs = [];
      }

      const fileMeta = [];
      const filesToUpload = [];

      for (const d of reqDocs) {
        const file = docFiles[d.type];
        if (file) {
          fileMeta.push({
            document_type: d.type,
            document_name: d.label || d.type,
            related_to: d.related_to || 'APPLICANT'
          });
          filesToUpload.push(file);
        }
      }

      // Add extra docs
      for (const ed of extraDocs) {
        if (ed.file) {
          fileMeta.push({
            document_type: 'OTHER',
            document_name: ed.label || 'Additional Document',
            related_to: ed.related_to || 'APPLICANT'
          });
          filesToUpload.push(ed.file);
        }
      }

      // Multipart FormData
      const formData = new FormData();
      formData.append(
        'data',
        JSON.stringify({
          certificate_type_id: certType.certificate_type_id,
          purpose,
          declared_family_income: Number(familyIncome) || 0,
          land_holding_cents: Number(landHolding) || 0,
          house_area_sqft: Number(houseArea) || 0,
          other_property_details: otherProperty ? otherProperty.trim() : null,
          parties
        })
      );
      formData.append('fileMeta', JSON.stringify(fileMeta));

      for (const f of filesToUpload) {
        formData.append('files', f);
      }

      const res = await axios.post('/api/applications', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success && res.data?.data) {
        setSubmittedResult(res.data.data);
        setIsDirty(false);
        toast.success('Application submitted successfully!');
      } else {
        toast.error(res.data?.message || 'Failed to submit application');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Application submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute verification request notice for step 4
  const getExternalVerificationRequests = () => {
    if (!certType) return [];
    let reqParties = [];
    try {
      reqParties = typeof certType.verification_parties === 'string'
        ? JSON.parse(certType.verification_parties)
        : certType.verification_parties || [];
    } catch (e) {
      reqParties = [];
    }

    const homeId = Number(user?.panchayat_id);
    const list = [];
    for (const p of reqParties) {
      const pObj = partiesData[p];
      if (pObj && Number(pObj.panchayat_id) !== homeId) {
        const panch = panchayats.find((item) => Number(item.panchayat_id) === Number(pObj.panchayat_id));
        list.push({
          party: p,
          name: pObj.full_name,
          panchayatName: panch?.panchayat_name || 'Selected Panchayat',
          district: panch?.district || ''
        });
      }
    }
    return list;
  };

  if (initLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" className="text-primary-600 mb-4" />
        <p className="text-ink-muted text-sm">Preparing application wizard...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert type="danger" title="Error" message={initError} />
        <div className="mt-6 text-center">
          <Link to="/citizen/apply">
            <Button variant="outline">Back to Available Certificates</Button>
          </Link>
        </div>
      </div>
    );
  }

  // SUCCESS SCREEN
  if (submittedResult) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="text-center p-8 sm:p-10">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-6 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-ink mb-2">Application Submitted!</h2>
          <p className="text-sm text-ink-muted mb-6">
            Your application for <strong>{certType?.certificate_name}</strong> has been successfully registered.
          </p>

          <div className="p-4 rounded-2xl bg-slate-50 border border-line mb-8 inline-block max-w-sm w-full">
            <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">Application Number</div>
            <div className="font-mono text-2xl font-bold text-primary-600 mt-1 select-all">
              {submittedResult.application_no}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge variant={submittedResult.status === 'PENDING_EXTERNAL' ? 'warning' : 'info'}>
                {submittedResult.status === 'PENDING_EXTERNAL' ? 'Pending External Verification' : 'Submitted'}
              </Badge>
            </div>
          </div>

          <div className="text-left bg-slate-50 p-6 rounded-2xl border border-line mb-8 space-y-3">
            <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider">What Happens Next</h4>
            <ul className="text-xs text-ink space-y-2.5">
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</div>
                <span>Your application is recorded and verification requests are dispatched to partner Panchayats.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</div>
                <span>Verification officers will inspect local registers and sign decisions digitally with cryptographic keys.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</div>
                <span>Once verified, your home Panchayat will issue the signed certificate with QR code for download.</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={`/track?appNo=${submittedResult.application_no}`}>
              <Button variant="primary" icon={FileText} className="w-full sm:w-auto">
                Track Application
              </Button>
            </Link>
            <Link to="/citizen">
              <Button variant="outline" className="w-full sm:w-auto">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Stepper Items
  const steps = STEP_TITLES.map((title, idx) => ({
    title,
    completed: idx < currentStep,
    current: idx === currentStep
  }));

  const externalRequests = getExternalVerificationRequests();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <PageHeader
        title={`Apply for ${certType?.certificate_name}`}
        subtitle="Complete the 4-step wizard to apply. We handle cross-panchayat verification requests automatically."
      />

      {/* Stepper Header */}
      <Card padding="sm" className="hidden sm:block">
        <Stepper steps={steps} currentStep={currentStep} />
      </Card>

      {/* Mobile Step Indicator */}
      <div className="sm:hidden flex items-center justify-between p-4 bg-white rounded-2xl border border-line">
        <div className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
          Step {currentStep + 1} of {STEP_TITLES.length}
        </div>
        <div className="font-bold text-ink text-sm">
          {STEP_TITLES[currentStep]}
        </div>
      </div>

      {/* STEP 1: APPLICANT DETAILS */}
      {currentStep === 0 && (
        <Card title="Step 1: Applicant Details">
          <p className="text-xs text-ink-muted mb-6">
            Official records registered under your profile. To update these details, please visit your{' '}
            <Link to="/citizen/profile" className="text-primary-600 hover:underline font-medium">
              Profile Settings
            </Link>
            .
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-2xl border border-line mb-6">
            <div>
              <div className="text-xs text-ink-muted">Applicant Full Name</div>
              <div className="font-semibold text-ink text-sm mt-0.5">{user?.full_name}</div>
            </div>

            <div>
              <div className="text-xs text-ink-muted">Home Panchayat</div>
              <div className="font-semibold text-ink text-sm mt-0.5">{user?.panchayat_name}</div>
              <span className="text-[11px] text-ink-light">Code: {user?.panchayat_code}</span>
            </div>

            <div>
              <div className="text-xs text-ink-muted">Aadhaar Number</div>
              <div className="font-mono text-sm font-semibold text-ink mt-0.5">
                {user?.aadhaar_no || 'XXXX XXXX 1234'}
              </div>
              <span className="text-[10px] text-ink-light">Masked for privacy</span>
            </div>

            <div>
              <div className="text-xs text-ink-muted">Registered Mobile</div>
              <div className="font-medium text-ink text-sm mt-0.5">{user?.mobile}</div>
            </div>

            <div>
              <div className="text-xs text-ink-muted">Email Address</div>
              <div className="font-medium text-ink text-sm mt-0.5">{user?.email || '—'}</div>
            </div>

            <div>
              <div className="text-xs text-ink-muted">Gender / Date of Birth</div>
              <div className="font-medium text-ink text-sm mt-0.5">
                {user?.gender || 'N/A'} • {user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-IN') : 'N/A'}
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-xs text-ink-muted">Registered Address</div>
              <div className="text-sm text-ink mt-0.5">{user?.address || '—'}</div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-line">
            <h4 className="font-bold text-ink text-sm">Purpose of Application</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Application Purpose"
                value={purposeCode}
                onChange={(e) => {
                  setPurposeCode(e.target.value);
                  setIsDirty(true);
                }}
                options={[
                  { value: '', label: 'Select purpose...' },
                  ...purposes.map((p) => ({
                    value: p.code,
                    label: p.value || p.item_name || p.code
                  }))
                ]}
                required
              />

              {purposeCode === 'OTHER' && (
                <Input
                  label="Specify Other Purpose"
                  placeholder="e.g. Higher Education Scholarship"
                  value={customPurpose}
                  onChange={(e) => {
                    setCustomPurpose(e.target.value);
                    setIsDirty(true);
                  }}
                  required
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: FAMILY & PROPERTY DETAILS */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card title="Financial & Property Declarations">
            <p className="text-xs text-ink-muted mb-6">
              Enter your family's overall financial and land metrics as per statutory certificate criteria.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Declared Family Income (₹/Year)"
                type="number"
                min="0"
                placeholder="e.g. 150000"
                value={familyIncome}
                onChange={(e) => {
                  setFamilyIncome(e.target.value);
                  setIsDirty(true);
                }}
                required
              />

              <Input
                label="Land Holding (Cents)"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 12"
                value={landHolding}
                onChange={(e) => {
                  setLandHolding(e.target.value);
                  setIsDirty(true);
                }}
                required
              />

              <Input
                label="Residential House Area (Sq.Ft)"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 850"
                value={houseArea}
                onChange={(e) => {
                  setHouseArea(e.target.value);
                  setIsDirty(true);
                }}
                required
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Other Property / Asset Details (Optional)"
                rows={2}
                placeholder="Details of agricultural land, commercial plots, or other assets owned."
                value={otherProperty}
                onChange={(e) => {
                  setOtherProperty(e.target.value);
                  setIsDirty(true);
                }}
              />
            </div>
          </Card>

          {/* Verification Parties Cards */}
          {Object.keys(partiesData).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-ink text-base">Verification Parties</h3>
                  <p className="text-xs text-ink-muted">
                    Specify jurisdiction Panchayats where records for each required relative/asset are registered.
                  </p>
                </div>
              </div>

              {Object.keys(partiesData).map((partyKey) => {
                const party = partiesData[partyKey];
                const isHomePanch = Number(party.panchayat_id) === Number(user?.panchayat_id);
                const selectedPanchObj = panchayats.find(
                  (p) => Number(p.panchayat_id) === Number(party.panchayat_id)
                );

                const updatePartyField = (field, val) => {
                  setPartiesData((prev) => ({
                    ...prev,
                    [partyKey]: { ...prev[partyKey], [field]: val }
                  }));
                  setIsDirty(true);
                };

                return (
                  <Card key={partyKey} title={`${partyKey === 'PROPERTY' ? 'Property Asset' : partyKey} Information`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label={partyKey === 'PROPERTY' ? 'Property Owner Name' : `${partyKey}'s Full Name`}
                        placeholder="Full Name as in records"
                        value={party.full_name}
                        onChange={(e) => updatePartyField('full_name', e.target.value)}
                        required
                      />

                      <Input
                        label="Aadhaar Number (Optional, 12 digits)"
                        placeholder="12 digits"
                        value={party.aadhaar_no}
                        onChange={(e) => updatePartyField('aadhaar_no', e.target.value)}
                      />

                      <Select
                        label="Occupation"
                        value={party.occupation}
                        onChange={(e) => updatePartyField('occupation', e.target.value)}
                        options={occupations.map((o) => ({
                          value: o.code,
                          label: o.value || o.item_name || o.code
                        }))}
                      />

                      <Input
                        label="Annual Income (₹/Year)"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={party.annual_income}
                        onChange={(e) => updatePartyField('annual_income', e.target.value)}
                      />

                      <div className="sm:col-span-2">
                        <Input
                          label="Property / Land Details"
                          placeholder="e.g. 10 cents land at Kalluvila"
                          value={party.property_details}
                          onChange={(e) => updatePartyField('property_details', e.target.value)}
                        />
                      </div>

                      {/* Panchayat Dropdown with LIVE HINT */}
                      <div className="sm:col-span-2 pt-2 border-t border-line">
                        <Select
                          label={`Panchayat where ${partyKey === 'PROPERTY' ? 'Property' : partyKey}'s records are held`}
                          value={party.panchayat_id}
                          onChange={(e) => updatePartyField('panchayat_id', e.target.value)}
                          options={panchayats.map((p) => ({
                            value: String(p.panchayat_id),
                            label: `${p.panchayat_name} (${p.district})`
                          }))}
                          required
                        />

                        {/* Live Hint */}
                        <div className="mt-2">
                          {isHomePanch ? (
                            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span>Same as your panchayat — no external verification needed.</span>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              <span>
                                A verification request will be sent to{' '}
                                <strong>{selectedPanchObj?.panchayat_name || 'selected GP'}</strong>.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: DOCUMENT UPLOAD */}
      {currentStep === 2 && (
        <Card title="Step 3: Document Upload">
          <p className="text-xs text-ink-muted mb-6">
            Attach clear, readable documents. Supported formats: <strong>PDF, JPG, JPEG, PNG</strong> (Max 5 MB each).
          </p>

          <div className="space-y-4">
            {/* Required Documents Checklist */}
            {(() => {
              let reqDocs = [];
              try {
                reqDocs = typeof certType.required_documents === 'string'
                  ? JSON.parse(certType.required_documents)
                  : certType.required_documents || [];
              } catch (e) {
                reqDocs = [];
              }

              return reqDocs.map((docDef) => {
                const uploadedFile = docFiles[docDef.type];

                return (
                  <div
                    key={docDef.type}
                    className="p-4 rounded-xl border border-line bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">
                          {docDef.label || docDef.type}
                        </span>
                        {docDef.mandatory ? (
                          <Badge variant="danger" size="sm">
                            Mandatory
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Optional
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-ink-muted">
                        Related to: <strong>{docDef.related_to || 'APPLICANT'}</strong>
                      </span>

                      {uploadedFile && (
                        <div className="mt-1 text-xs font-mono text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {uploadedFile ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Trash2}
                          className="text-danger-600 hover:text-danger-700 w-full sm:w-auto"
                          onClick={() => handleRemoveFile(docDef.type)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-ink border border-line rounded-xl text-xs font-semibold transition w-full sm:w-auto shadow-sm">
                          <Upload className="w-3.5 h-3.5 text-primary-600" />
                          <span>Select File</span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(docDef.type, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Extra Documents Section */}
            {extraDocs.map((ed, idx) => (
              <div
                key={ed.id}
                className="p-4 rounded-xl border border-line bg-white flex flex-col md:flex-row items-center gap-3"
              >
                <div className="w-full md:w-1/3">
                  <Input
                    label="Document Name"
                    placeholder="e.g. Land Deed Copy"
                    value={ed.label}
                    onChange={(e) => handleExtraDocChange(idx, 'label', e.target.value)}
                    required
                  />
                </div>

                <div className="w-full md:w-1/4">
                  <Select
                    label="Related To"
                    value={ed.related_to}
                    onChange={(e) => handleExtraDocChange(idx, 'related_to', e.target.value)}
                    options={[
                      { value: 'APPLICANT', label: 'Applicant' },
                      { value: 'FATHER', label: 'Father' },
                      { value: 'MOTHER', label: 'Mother' },
                      { value: 'PROPERTY', label: 'Property' },
                      { value: 'OTHER', label: 'Other' }
                    ]}
                  />
                </div>

                <div className="w-full md:w-1/3 pt-2 md:pt-4">
                  {ed.file ? (
                    <div className="flex items-center justify-between text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                      <span className="truncate">{ed.file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleExtraDocChange(idx, 'file', null)}
                        className="text-danger-600 hover:text-danger-800 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-ink border border-line rounded-xl text-xs font-semibold transition w-full">
                      <Upload className="w-3.5 h-3.5 text-primary-600" />
                      <span>Choose File</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleExtraDocChange(idx, 'file', e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>

                <div className="pt-2 md:pt-4">
                  <button
                    type="button"
                    onClick={() => handleRemoveExtraDoc(idx)}
                    className="p-2 text-danger-500 hover:text-danger-700 rounded-lg hover:bg-danger-50 transition"
                    title="Delete row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add Extra Doc Button */}
            {extraDocs.length < 3 && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddExtraDoc}
                >
                  Add Another Document (Optional)
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* STEP 4: REVIEW & SUBMIT */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card title="Review Application Summary">
            {/* Notice banner for external verification requests */}
            <div className="mb-6">
              {externalRequests.length > 0 ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-amber-950 text-sm">
                      Cross-Panchayat Verification Dispatch
                    </h4>
                    <p className="text-amber-800 mt-1">
                      Upon submission, the system will automatically create{' '}
                      <strong>{externalRequests.length} digital verification request(s)</strong>:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-amber-900 font-medium">
                      {externalRequests.map((req, i) => (
                        <li key={i}>
                          Request to <strong>{req.panchayatName}</strong> for{' '}
                          <strong>{req.party} ({req.name})</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="text-xs text-emerald-900 font-medium">
                    No external verification requests required. All records are situated in your home Panchayat ({user?.panchayat_name}).
                  </div>
                </div>
              )}
            </div>

            {/* Review Sections */}
            <div className="space-y-6 text-xs">
              <div className="pb-4 border-b border-line">
                <h4 className="font-bold text-ink text-sm mb-3">1. Certificate & Applicant</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-ink-muted">Certificate Type:</span>
                    <div className="font-semibold text-ink">{certType?.certificate_name}</div>
                  </div>
                  <div>
                    <span className="text-ink-muted">Applicant:</span>
                    <div className="font-semibold text-ink">{user?.full_name}</div>
                  </div>
                  <div>
                    <span className="text-ink-muted">Home Panchayat:</span>
                    <div className="font-semibold text-ink">{user?.panchayat_name}</div>
                  </div>
                  <div>
                    <span className="text-ink-muted">Purpose:</span>
                    <div className="font-semibold text-ink">
                      {purposeCode === 'OTHER' ? customPurpose : purposeCode}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pb-4 border-b border-line">
                <h4 className="font-bold text-ink text-sm mb-3">2. Financial & Asset Declarations</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-ink-muted">Declared Family Income:</span>
                    <div className="font-semibold text-ink">₹ {Number(familyIncome).toLocaleString('en-IN')}/year</div>
                  </div>
                  <div>
                    <span className="text-ink-muted">Land Holding:</span>
                    <div className="font-semibold text-ink">{landHolding} Cents</div>
                  </div>
                  <div>
                    <span className="text-ink-muted">House Area:</span>
                    <div className="font-semibold text-ink">{houseArea} Sq.Ft</div>
                  </div>
                </div>
              </div>

              {Object.keys(partiesData).length > 0 && (
                <div className="pb-4 border-b border-line">
                  <h4 className="font-bold text-ink text-sm mb-3">3. Parties & Verification Routing</h4>
                  <div className="space-y-2">
                    {Object.keys(partiesData).map((pKey) => {
                      const pObj = partiesData[pKey];
                      const pPanch = panchayats.find((item) => Number(item.panchayat_id) === Number(pObj.panchayat_id));
                      const isExternal = Number(pObj.panchayat_id) !== Number(user?.panchayat_id);

                      return (
                        <div key={pKey} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-ink">{pKey}: {pObj.full_name}</span>
                            <span className="text-ink-muted ml-2">({pObj.occupation || 'N/A'})</span>
                            <div className="text-[11px] text-ink-light">
                              Record Panchayat: <strong>{pPanch?.panchayat_name}</strong>
                            </div>
                          </div>
                          <div>
                            {isExternal ? (
                              <Badge variant="warning" size="sm">Verification Request Dispatched</Badge>
                            ) : (
                              <Badge variant="success" size="sm">Local Verification</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-bold text-ink text-sm mb-3">4. Uploaded Documents</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(docFiles).map((k) => (
                    <div key={k} className="p-2 bg-slate-50 border border-line rounded-lg flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-ink">{docFiles[k].name}</span>
                    </div>
                  ))}
                  {extraDocs.filter((ed) => ed.file).map((ed) => (
                    <div key={ed.id} className="p-2 bg-slate-50 border border-line rounded-lg flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-ink">{ed.file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Self Declaration Checkbox */}
            <div className="mt-8 pt-6 border-t border-line">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  className="mt-1 rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span className="text-xs text-ink leading-relaxed font-medium">
                  I hereby declare that all the statements and documents furnished above are true and complete. I understand that false or misleading declarations may lead to prosecution and revocation of any certificate issued under the Kerala Panchayat Raj Act.
                </span>
              </label>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation Buttons Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-line">
        {currentStep > 0 ? (
          <Button
            type="button"
            variant="outline"
            icon={ArrowLeft}
            onClick={handleBack}
            disabled={submitting}
          >
            Back
          </Button>
        ) : (
          <Link to="/citizen/apply">
            <Button variant="outline">
              Cancel
            </Button>
          </Link>
        )}

        {currentStep < STEP_TITLES.length - 1 ? (
          <Button
            type="button"
            variant="primary"
            icon={ArrowRight}
            onClick={handleNext}
          >
            Continue to {STEP_TITLES[currentStep + 1]}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            icon={CheckCircle2}
            onClick={handleSubmitApplication}
            loading={submitting}
            disabled={!declared}
          >
            Submit Application
          </Button>
        )}
      </div>
    </div>
  );
}
