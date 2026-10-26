import api from './axios';

export const getVerificationRequests = (params) => api.get('/verification-requests', { params });
export const getVerificationCounts = () => api.get('/verification-requests/counts');
export const getVerificationRequestById = (id, technical = false) =>
  api.get(`/verification-requests/${id}${technical ? '?technical=1' : ''}`);
export const respondVerificationRequest = (id, data) => api.post(`/verification-requests/${id}/respond`, data);
export const remindVerificationRequest = (id) => api.post(`/verification-requests/${id}/remind`);
export const cancelVerificationRequest = (id) => api.post(`/verification-requests/${id}/cancel`);
export const checkSignature = (id) => api.get(`/verification-requests/${id}/check-signature`);
export const createVerificationRequest = (data) => api.post('/verification-requests', data);

export const verifyDocument = (applicationId, docId, data) =>
  api.patch(`/applications/${applicationId}/documents/${docId}/verify`, data);

export const decideApplication = (applicationId, data) =>
  api.post(`/applications/${applicationId}/decision`, data);

export const verificationApi = {
  getRequests: getVerificationRequests,
  getCounts: getVerificationCounts,
  getRequestById: getVerificationRequestById,
  respondRequest: respondVerificationRequest,
  remindRequest: remindVerificationRequest,
  cancelRequest: cancelVerificationRequest,
  checkSignature,
  createRequest: createVerificationRequest,
  verifyDocument,
  decideApplication
};

export default verificationApi;
