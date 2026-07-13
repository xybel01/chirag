import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

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

export const fileUrl = (name) => `/api/files/${encodeURIComponent(name)}?token=${localStorage.getItem('token')}`;
export const authedImg = (path) => `${path}?token=${localStorage.getItem('token')}`;
export const apiError = (err) => err.response?.data?.error || err.message || 'Something went wrong';
export default api;
