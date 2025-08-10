// src/utils/api.js
import axios from 'axios';

/* ----- BASE URL ----- */
const API_BASE = (process.env.REACT_APP_API_BASE || 'http://localhost:3000').replace(/\/$/, '');
const API_PREFIX = process.env.REACT_APP_API_PREFIX || '/api';
export const API_URL = `${API_BASE}${API_PREFIX}`;

/* ----- TOKEN STORAGE HELPERS ----- */
export const getToken = () => {
  try {
    const u = JSON.parse(localStorage.getItem('auth_user') || '{}');
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      u?.token ||
      ''
    );
  } catch { return ''; }
};
export const setToken = (token, user) => {
  if (token) localStorage.setItem('auth_token', token);
  if (user)  localStorage.setItem('auth_user', JSON.stringify(user));
};

/* ----- GLOBAL AXIOS INJECTION (works for axios and for your pages) ----- */
axios.defaults.baseURL = API_URL;
axios.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${t}`; // most middlewares
    cfg.headers['x-access-token'] = t;         // some middlewares
  }
  return cfg;
});

/* For places you already pass headers: { headers: authHeaders() } */
export const authHeaders = () => {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, 'x-access-token': t, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

/* Small UI helper */
export const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-slate-600 mb-1">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
  </label>
);