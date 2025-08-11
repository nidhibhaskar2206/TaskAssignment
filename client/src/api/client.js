import axios from 'axios';
import store from '../redux/store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  // try redux first
  const tokenFromStore = store.getState()?.auth?.token;
  const token = tokenFromStore || JSON.parse(localStorage.getItem('token'));
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err?.response?.data?.message || err.message)
);

export default api;
