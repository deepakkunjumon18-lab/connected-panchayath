import api from './axios';

export const getCertificates = (params) => api.get('/certificates', { params });

export const downloadCertificate = (id) =>
  api.get(`/certificates/${id}/download`, { responseType: 'blob' });

export const verifyCertificate = (code, isQr = false) =>
  api.get(`/certificates/verify/${code}${isQr ? '?src=qr' : ''}`);

export const issueCertificate = (applicationId) =>
  api.post(`/applications/${applicationId}/issue-certificate`);

export const downloadCertificateBlob = async (certificateId, fileName = 'certificate.pdf') => {
  const response = await api.get(`/certificates/${certificateId}/download`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data || response], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const getCertificateBlobUrl = async (certificateId) => {
  const response = await api.get(`/certificates/${certificateId}/download`, {
    responseType: 'blob'
  });
  const blob = new Blob([response.data || response], { type: 'application/pdf' });
  return window.URL.createObjectURL(blob);
};

export const certificatesApi = {
  getCertificates,
  downloadCertificate,
  verifyCertificate,
  issueCertificate,
  downloadCertificateBlob,
  getCertificateBlobUrl
};

export default certificatesApi;
