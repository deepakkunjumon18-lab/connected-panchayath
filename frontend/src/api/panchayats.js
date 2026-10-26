import api from './axios';

export const getPanchayats = () => api.get('/panchayats/public');

export const panchayatsApi = {
  getPublic: () => api.get('/panchayats/public'),
  getDirectory: () => api.get('/panchayats/directory')
};

export default panchayatsApi;
