import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token and strip leading /api to prevent duplicate /api/api
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cp_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Prevent duplicate /api/api if caller passes '/api/...'
    if (config.url) {
      if (config.url.startsWith('/api/')) {
        config.url = config.url.slice(4);
      } else if (config.url === '/api') {
        config.url = '';
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors and seamless unwrapping for both res.data.data and res.data
api.interceptors.response.use(
  (response) => {
    // If response is a blob, return full response
    if (response.config.responseType === 'blob') {
      return response;
    }

    const resData = response.data;
    if (resData && typeof resData === 'object' && 'success' in resData) {
      const inner = resData.data;
      if (inner !== null && typeof inner === 'object' && !('success' in inner)) {
        return new Proxy(resData, {
          get(target, prop, receiver) {
            if (prop === 'data') {
              return new Proxy(inner, {
                get(subTarget, subProp, subReceiver) {
                  if (subProp === 'success') return target.success;
                  if (subProp === 'message') return target.message;
                  if (subProp === 'data') return inner;
                  return Reflect.get(subTarget, subProp, subReceiver);
                }
              });
            }
            return Reflect.get(target, prop, receiver);
          }
        });
      }
    }

    return resData;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cp_token');
      localStorage.removeItem('cp_user');
      // Only redirect if not already on login or public pages
      const publicPaths = ['/', '/login', '/register', '/verify'];
      if (!publicPaths.some((p) => window.location.pathname.startsWith(p))) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
