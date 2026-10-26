import api from './axios';

export const getOfficerDashboard = () => api.get('/dashboard/officer');
export const getCitizenDashboard = () => api.get('/dashboard/citizen');
export const getOfficerReports = () => api.get('/reports/officer');
export const getAdminReportsSummary = () => api.get('/admin/reports/summary');
export const getAdminSignaturesAudit = () => api.get('/admin/signatures/audit');
export const getOfficerPublicKey = (params) => api.get('/officer/me/public-key', { params });
export const getPanchayatDirectory = (search) => api.get('/panchayats/directory', { params: { search } });
