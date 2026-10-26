import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_TITLES = {
  '/': 'Welcome',
  '/login': 'Officer & Citizen Login',
  '/register': 'Citizen Registration',
  '/track': 'Track Application',
  '/verify': 'Verify Certificate',
  '/notifications': 'Notifications',
  '/citizen': 'Citizen Dashboard',
  '/citizen/apply': 'Apply for Certificate',
  '/citizen/applications': 'My Applications',
  '/citizen/certificates': 'My Certificates',
  '/citizen/profile': 'Citizen Profile',
  '/officer': 'Officer Dashboard',
  '/officer/applications': 'Verify & Request',
  '/officer/incoming': 'Incoming Requests',
  '/officer/certificates': 'Issued Certificates',
  '/officer/directory': 'Panchayat Directory',
  '/officer/reports': 'Verification Reports',
  '/officer/settings': 'Officer Settings',
  '/admin': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/admin/panchayats': 'Panchayat Registry',
  '/admin/certificate-types': 'Certificate Schemas',
  '/admin/master-data': 'Master Data',
  '/admin/audit-logs': 'Audit Trail',
  '/admin/reports': 'Statewide Reports',
  '/admin/signatures': 'Signature Audit'
};

export default function useDocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let pageTitle = ROUTE_TITLES[path];

    if (!pageTitle) {
      if (path.startsWith('/citizen/apply/')) {
        pageTitle = 'Application Form';
      } else if (path.startsWith('/citizen/applications/')) {
        pageTitle = 'Application Details';
      } else if (path.startsWith('/officer/applications/')) {
        pageTitle = 'Application Review';
      } else if (path.startsWith('/officer/incoming/')) {
        pageTitle = 'Review & Sign Request';
      } else if (path.startsWith('/verify/')) {
        pageTitle = 'Certificate Verification';
      } else if (path.startsWith('/track/')) {
        pageTitle = 'Track Application';
      } else {
        pageTitle = 'Connected Panchayat';
      }
    }

    document.title = `Connected Panchayat — ${pageTitle}`;
  }, [location.pathname]);
}
