import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getToken } from '../utils/api';

export default function ProtectedRoute({ children }) {
  const loc = useLocation();
  const token = (typeof getToken === 'function' ? getToken() : localStorage.getItem('token'));

  if (!token) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children ? <>{children}</> : <Outlet />;
}