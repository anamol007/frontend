import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { setAuth, getToken } from './utils/api'; // ✅ use existing exports

// Load token (from localStorage or your api helper) and attach to axios
const token = (typeof getToken === 'function' ? getToken() : localStorage.getItem('token'));
if (token) setAuth(token);

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);