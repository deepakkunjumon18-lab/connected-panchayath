import axios from './axios';

export const getApplications = async (params = {}) => {
  const cleanParams = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      cleanParams[key] = val;
    }
  }
  const res = await axios.get('/api/applications', { params: cleanParams });
  return res.data;
};

export const getApplicationById = async (id) => {
  const res = await axios.get(`/api/applications/${id}`);
  return res.data;
};

export const createApplication = async (formData) => {
  const res = await axios.post('/api/applications', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return res.data;
};

export const getMasterData = async (category) => {
  const res = await axios.get(`/api/master-data/${category}`);
  return res.data;
};
