import api from './axios';

export const adminApi = {
  getStats: () => api.get('/admin/stats'),

  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  updateUserStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }),
  resetPassword: (id, newPassword) => api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword }),

  // Panchayats
  getPanchayats: (params) => api.get('/admin/panchayats', { params }),
  createPanchayat: (data) => api.post('/admin/panchayats', data),
  updatePanchayat: (id, data) => api.put(`/admin/panchayats/${id}`, data),
  updatePanchayatStatus: (id, status) => api.patch(`/admin/panchayats/${id}/status`, { status }),

  // Certificate Types
  getCertificateTypes: () => api.get('/admin/certificate-types'),
  updateCertificateType: (id, data) => api.put(`/admin/certificate-types/${id}`, data),

  // Master Data
  getMasterData: (params) => api.get('/admin/master-data', { params }),
  createMasterData: (data) => api.post('/admin/master-data', data),
  updateMasterData: (id, data) => api.put(`/admin/master-data/${id}`, data),
  updateMasterDataStatus: (id, status) => api.patch(`/admin/master-data/${id}/status`, { status }),

  // Audit Logs
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),

  // Reports & Signatures Audit
  getReportsSummary: () => api.get('/admin/reports/summary'),
  getSignaturesAudit: () => api.get('/admin/signatures/audit')
};
