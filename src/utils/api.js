// src/utils/api.js
import axios from 'axios';

/** Resolve env for CRA (REACT_APP_*) and Vite (VITE_*) */
const ENV = (typeof import.meta !== 'undefined' ? import.meta.env : process.env) || {};

const RAW_BASE   = ENV.VITE_API_BASE || ENV.REACT_APP_API_BASE || 'https://backend.delmabiz.com';
const RAW_PREFIX = ENV.VITE_API_PREFIX ?? ENV.REACT_APP_API_PREFIX ?? '/api';
const LOGIN_PATH = ENV.VITE_LOGIN_PATH || ENV.REACT_APP_LOGIN_PATH || '/users/login';

const BASE = String(RAW_BASE).replace(/\/$/, '');
const PREFIX = String(RAW_PREFIX).startsWith('/') ? RAW_PREFIX : `/${RAW_PREFIX}`;

export const API_URL = `${BASE}${PREFIX}`;

/* ------------------------ auth localStorage helpers ------------------------ */
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

/* --------------------------------- axios ---------------------------------- */
export const api = axios.create({ baseURL: API_URL });
// Attach bearer automatically
api.interceptors.request.use(cfg => {
  const t = getToken();
  if (t) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

/* --------------------------------- auth ----------------------------------- */
// POST /users/login  -> { data: { token, user } }
export async function login({ email, password }) {
  try {
    const res = await api.post(LOGIN_PATH, { email, password });
    const data = res?.data?.data ?? res?.data ?? {};
    const token =
      data.token || data.accessToken || data.jwt ||
      data?.data?.token || data?.data?.accessToken || data?.data?.jwt || null;
    const user =
      data.user || data?.data?.user ||
      (data.user === undefined && data?.data && typeof data.data === 'object' ? data.data : null);

    if (!token) throw new Error('No token returned');
    setAuth({ token, user });
    return { token, user };
  } catch (e) {
    const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Login failed';
    throw new Error(msg);
  }
}

/* ----------------------- forgot/reset password APIs ----------------------- */
// POST /api/users/forgot-password { email }
export const requestPasswordReset = (email) =>
  api.post('/users/forgot-password', { email });

// GET  /api/users/validate-reset-token/:token
export const validateResetToken = (token) =>
  api.get(`/users/validate-reset-token/${encodeURIComponent(token)}`);

// POST /api/users/reset-password { token, newPassword }
export const resetPassword = (token, newPassword) =>
  api.post('/users/reset-password', { token, newPassword });

/* --------------------------------- CRUD ----------------------------------- */
export const crud = {
  list:   (path, params)   => api.get(path, { params }),
  get:    (path, id)       => api.get(`${path}/${id}`),
  create: (path, data)     => api.post(path, data),
  update: (path, id, data) => api.put(`${path}/${id}`, data),
  remove: (path, id)       => api.delete(`${path}/${id}`),
};

/* ----------------------- dashboard helper (example) ----------------------- */
export const fetchLowStock = (kgThreshold = 10, boriThreshold = 5) =>
  api.get('/stock/low', { params: { kgThreshold, boriThreshold } })
     .then(r => r?.data?.data ?? r?.data ?? []);