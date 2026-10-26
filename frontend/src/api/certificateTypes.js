import api from './axios';

export const certificateTypesApi = {
  getAll: () => api.get('/certificate-types')
};
