import React from 'react';
import { Clock, CheckCircle2, AlertCircle, HelpCircle, FileCheck, XCircle } from 'lucide-react';
import Badge from '../ui/Badge';

export default function StatusBadge({ status, isOverdue = false, size = 'md', className = '' }) {
  if (isOverdue) {
    return (
      <Badge variant="danger" size={size} icon={Clock} className={className}>
        Overdue
      </Badge>
    );
  }

  const s = String(status || '').toUpperCase();

  switch (s) {
    case 'PENDING':
      return (
        <Badge variant="warning" size={size} icon={Clock} className={className}>
          Pending
        </Badge>
      );
    case 'PENDING_EXTERNAL':
      return (
        <Badge variant="warning" size={size} icon={Clock} className={className}>
          Pending (External)
        </Badge>
      );
    case 'SUBMITTED':
      return (
        <Badge variant="warning" size={size} icon={Clock} className={className}>
          Submitted
        </Badge>
      );
    case 'READY_FOR_DECISION':
      return (
        <Badge variant="purple" size={size} icon={HelpCircle} className={className}>
          Ready for decision
        </Badge>
      );
    case 'APPROVED':
      return (
        <Badge variant="success" size={size} icon={CheckCircle2} className={className}>
          Approved
        </Badge>
      );
    case 'VERIFIED':
      return (
        <Badge variant="success" size={size} icon={CheckCircle2} className={className}>
          Verified
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="danger" size={size} icon={AlertCircle} className={className}>
          Rejected
        </Badge>
      );
    case 'CERTIFICATE_ISSUED':
    case 'COMPLETED':
      return (
        <Badge variant="info" size={size} icon={FileCheck} className={className}>
          Certificate issued
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge variant="neutral" size={size} icon={XCircle} className={className}>
          Cancelled
        </Badge>
      );
    case 'OVERDUE':
      return (
        <Badge variant="danger" size={size} icon={Clock} className={className}>
          Overdue
        </Badge>
      );
    case 'ACTIVE':
      return (
        <Badge variant="success" size={size} className={className}>
          Active
        </Badge>
      );
    case 'INACTIVE':
      return (
        <Badge variant="neutral" size={size} className={className}>
          Inactive
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" size={size} className={className}>
          {status}
        </Badge>
      );
  }
}
