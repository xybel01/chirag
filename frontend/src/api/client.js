import axios from 'axios';

const getBaseURL = () => {
  return import.meta.env.VITE_API_URL || '/api';
};

const getCleanHost = () => {
  const base = getBaseURL();
  if (base.startsWith('http')) {
    return base.endsWith('/api') ? base.substring(0, base.length - 4) : base;
  }
  return '';
};

const api = axios.create({ baseURL: getBaseURL() });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const fileUrl = (name) => {
  const host = getCleanHost();
  return `${host}/api/files/${encodeURIComponent(name)}?token=${localStorage.getItem('token')}`;
};

export const authedImg = (path) => {
  if (path && path.startsWith('/api')) {
    const host = getCleanHost();
    return `${host}${path}?token=${localStorage.getItem('token')}`;
  }
  return `${path}?token=${localStorage.getItem('token')}`;
};

export const apiError = (err) => err.response?.data?.error || err.message || 'Something went wrong';
export default api;
