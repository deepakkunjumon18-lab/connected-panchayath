import React, { useState } from 'react';
import {
  Landmark,
  Shield,
  FileText,
  Users,
  Search,
  CheckCircle,
  Clock,
  Send,
  AlertTriangle
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Checkbox from '../../components/ui/Checkbox';
import FileInput from '../../components/ui/FileInput';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tabs from '../../components/ui/Tabs';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Stepper from '../../components/ui/Stepper';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import PageHeader from '../../components/ui/PageHeader';
import Alert from '../../components/ui/Alert';
import Tooltip from '../../components/ui/Tooltip';
import StatusBadge from '../../components/common/StatusBadge';

export default function UiKit() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tab1');
  const [stepperStep, setStepperStep] = useState(2);
  const [fileValue, setFileValue] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const sampleColumns = [
    { key: 'id', title: 'ID', headerClassName: 'w-16' },
    { key: 'name', title: 'Applicant Name' },
    { key: 'type', title: 'Certificate Type' },
    {
      key: 'status',
      title: 'Status',
      render: (val) => <StatusBadge status={val} />
    },
    {
      key: 'actions',
      title: 'Action',
      align: 'right',
      render: () => <Button size="sm" variant="ghost">View</Button>
    }
  ];

  const sampleData = [
    { id: '1', name: 'Akhil K S', type: 'EWS Certificate', status: 'PENDING_EXTERNAL' },
    { id: '2', name: 'Anu Thomas', type: 'EWS Certificate', status: 'SUBMITTED' },
    { id: '3', name: 'Rafiq Khan', type: 'Income Certificate', status: 'READY_FOR_DECISION' },
    { id: '4', name: 'Deepak K', type: 'Nativity Certificate', status: 'APPROVED' },
    { id: '5', name: 'Meera N', type: 'Residence Certificate', status: 'REJECTED' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
      <PageHeader
        title="UI Design System Showcase"
        subtitle="Connected Panchayat soft UI system tokens, components, and interactive elements"
        actions={
          <Button variant="primary" icon={Send} onClick={() => setModalOpen(true)}>
            Open Demo Modal
          </Button>
        }
      />

      {/* 1. Buttons */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">1. Buttons</h3>
        <Card className="flex flex-wrap gap-3 items-center">
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="danger">Danger Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="primary" loading>Loading...</Button>
          <Button variant="primary" icon={Landmark}>With Icon</Button>
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="lg">Large</Button>
        </Card>
      </section>

      {/* 2. Badges & Status Chips */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">2. Badges & Status Chips</h3>
        <Card className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-muted mr-2">General:</span>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="purple">Purple</Badge>
            <Badge variant="neutral">Neutral</Badge>
          </div>
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-line">
            <span className="text-xs font-semibold text-muted mr-2">StatusBadges:</span>
            <StatusBadge status="PENDING" />
            <StatusBadge status="PENDING_EXTERNAL" />
            <StatusBadge status="READY_FOR_DECISION" />
            <StatusBadge status="SUBMITTED" />
            <StatusBadge status="APPROVED" />
            <StatusBadge status="VERIFIED" />
            <StatusBadge status="REJECTED" />
            <StatusBadge status="CERTIFICATE_ISSUED" />
            <StatusBadge status="CANCELLED" />
            <StatusBadge status="PENDING" isOverdue={true} />
            <StatusBadge status="ACTIVE" />
            <StatusBadge status="INACTIVE" />
          </div>
        </Card>
      </section>

      {/* 3. StatCards */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">3. Stat Cards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Applications"
            value="1,248"
            caption="+12% from last month"
            icon={FileText}
            variant="primary"
          />
          <StatCard
            title="Digitally Verified"
            value="982"
            caption="Verified with RSA-2048"
            icon={Shield}
            variant="success"
          />
          <StatCard
            title="Pending Requests"
            value="34"
            caption="4 overdue requests"
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Active Citizens"
            value="3,890"
            caption="Across 6 Panchayats"
            icon={Users}
            variant="purple"
          />
        </div>
      </section>

      {/* 4. Form Inputs */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">4. Form Inputs & Controls</h3>
        <Card className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input label="Applicant Name" placeholder="e.g. Akhil K S" required />
          <Input label="Search Bar" placeholder="Search applications..." icon={Search} />
          <Input
            label="Password Input"
            type="password"
            placeholder="Enter password..."
            helperText="At least 8 characters with upper, lower, and digit"
          />
          <Input
            label="Validation Error State"
            defaultValue="invalid.email"
            error="Please enter a valid email address"
          />
          <Select
            label="Home Panchayat"
            options={[
              { value: '1', label: 'Kottarakara GP (KTR)' },
              { value: '2', label: 'Kollam GP (KLM)' },
              { value: '3', label: 'Kadakkal GP (KDK)' }
            ]}
            required
          />
          <FileInput
            label="Identity Proof Document"
            value={fileValue}
            onChange={setFileValue}
            required
          />
          <div className="md:col-span-2">
            <Textarea label="Remarks / Verification Notes" placeholder="Enter remarks..." />
          </div>
          <div className="md:col-span-2 flex gap-6">
            <Checkbox label="Agree to terms" description="I declare all facts entered are true" />
            <Checkbox label="Mandatory verification party" defaultChecked />
          </div>
        </Card>
      </section>

      {/* 5. Stepper */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">5. Stepper Component</h3>
        <Card>
          <Stepper
            currentStep={stepperStep}
            onStepClick={setStepperStep}
            steps={[
              { title: 'Applicant Details', subtitle: 'Personal info' },
              { title: 'Family & Property', subtitle: 'Verification parties' },
              { title: 'Documents', subtitle: 'Upload attachments' },
              { title: 'Review & Submit', subtitle: 'Final verification' }
            ]}
          />
          <div className="flex justify-center gap-3 mt-4">
            <Button size="sm" variant="secondary" onClick={() => setStepperStep(Math.max(1, stepperStep - 1))}>
              Previous Step
            </Button>
            <Button size="sm" variant="primary" onClick={() => setStepperStep(Math.min(4, stepperStep + 1))}>
              Next Step
            </Button>
          </div>
        </Card>
      </section>

      {/* 6. Tabs & Table */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">6. Tabs & Table with Pagination</h3>
        <Card className="space-y-4">
          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'tab1', label: 'All Applications', count: 5 },
              { id: 'tab2', label: 'Pending External', count: 1 },
              { id: 'tab3', label: 'Ready for Decision', count: 1 }
            ]}
          />
          <Table columns={sampleColumns} data={sampleData} />
          <Pagination
            currentPage={currentPage}
            totalItems={42}
            pageSize={10}
            onPageChange={setCurrentPage}
          />
        </Card>
      </section>

      {/* 7. Alerts & Tooltips */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">7. Alerts & Tooltips</h3>
        <div className="space-y-3">
          <Alert type="info" title="System Information">
            Panchayat A has requested digital verification from Kottarakara GP for applicant father records.
          </Alert>
          <Alert type="success" title="Digitally Signed by Anchal GP">
            The verification request was signed with RSA-2048 + SHA-256. Cryptographic signature is valid.
          </Alert>
          <Alert type="warning" title="Verification Pending">
            Application is waiting for 1 external verification response before certificate issuance.
          </Alert>
          <Alert type="danger" title="Tampering Detected">
            Database row attributes do not match signed canonical payload fields!
          </Alert>
          <div className="flex gap-4 items-center pt-2">
            <span className="text-sm font-medium text-ink">Hover tooltips:</span>
            <Tooltip text="SHA-256 Public Key Fingerprint: 7a356eaf4d14241904738802db6729d3">
              <span className="text-xs bg-slate-100 border border-line px-2.5 py-1 rounded-lg font-mono cursor-help">
                7a356eaf... (hover)
              </span>
            </Tooltip>
            <Tooltip text="Verification will be digitally signed with RSA-2048">
              <Button size="sm" variant="secondary" icon={Shield}>
                Officer Signature Info
              </Button>
            </Tooltip>
          </div>
        </div>
      </section>

      {/* 8. Modals & Dialogs */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">8. Modals & Confirm Dialogs</h3>
        <Card className="flex gap-3">
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Standard Modal
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Open Danger Confirm Dialog
          </Button>
        </Card>

        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Digital Verification Details"
          subtitle="Review details received from Kottarakara GP"
        >
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              This modal demonstrates the standard soft dialog window with backdrop blur and smooth animation.
            </p>
            <Input label="Remarks" placeholder="Enter remarks..." />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Deactivate Panchayat Officer?"
          message="Are you sure you want to deactivate officer Deepak Kunjumon? This officer will immediately lose signing and login access."
          confirmText="Deactivate Officer"
          variant="danger"
        />
      </section>

      {/* 9. Empty State */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-ink">9. Empty State Component</h3>
        <Card>
          <EmptyState
            title="No verification requests"
            message="You currently have no incoming requests from other panchayats."
            actionLabel="Refresh List"
            onAction={() => alert('Refreshed')}
          />
        </Card>
      </section>
    </div>
  );
}
