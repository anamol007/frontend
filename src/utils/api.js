// src/utils/api.js
import axios from 'axios';

const API_BASE   = (process.env.REACT_APP_API_BASE || 'http://localhost:3000').replace(/\/$/, '');
const API_PREFIX = (process.env.REACT_APP_API_PREFIX ?? '/api').replace(/\/?$/, '');
const LOGIN_PATH = (process.env.REACT_APP_LOGIN_PATH || '/users/login');

export const API_URL = `${API_BASE}${API_PREFIX}`;

// --- auth storage helpers ---
export const getToken = () => localStorage.getItem('auth_token') || '';
export const getUser  = () => { try { return JSON.parse(localStorage.getItem('auth_user') || '{}'); } catch { return {}; } };
export const setAuth  = ({ token, user }) => {
  if (token) localStorage.setItem('auth_token', token);
  if (user)  localStorage.setItem('auth_user', JSON.stringify(user));
};
export const clearAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
};

// --- axios instance with bearer ---
export const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(cfg => {
  const t = getToken();
  if (t) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

// --- Forgot/Reset password helpers ---
export const requestPasswordReset = (email) =>
  api.post('/users/forgot-password', { email });

export const validateResetToken = (token) =>
  api.get(`/users/validate-reset-token/${encodeURIComponent(token)}`);

export const resetPassword = (token, newPassword) =>
  api.post('/users/reset-password', { token, newPassword });

// --- Login (single export; keep only this) ---
export async function login({ email, password }) {
  try {
    const res = await api.post(LOGIN_PATH, { email, password });
    const payload = res?.data?.data || {};
    const token = payload.token;
    const user  = payload.user;
    if (!token) throw new Error('No token returned');
    setAuth({ token, user });
    return payload; // { token, user }
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      'Login failed';
    throw new Error(msg);
  }
}

// --- tiny CRUD helpers ---
export const crud = {
  list:   (path, params)   => api.get(path, { params }),
  get:    (path, id)       => api.get(`${path}/${id}`),
  create: (path, data)     => api.post(path, data),
  update: (path, id, data) => api.put(`${path}/${id}`, data),
  remove: (path, id)       => api.delete(`${path}/${id}`),
};

// --- extras ---
export const fetchLowStock = (kgThreshold = 10, boriThreshold = 5) =>
  api.get('/stock/low', { params: { kgThreshold, boriThreshold } })
     .then(r => r?.data?.data ?? r?.data ?? []);