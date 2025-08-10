import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch { return null; }
}

export default function Topbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('authToken') || '';

  const { email, fullName, initial } = useMemo(() => {
    const p = decodeJwt(token) || {};
    const email = p.email || '';
    const fullName = p.fullname || p.name || p.username || '';
    const initialSource = fullName || email || 'U';
    const initial = (initialSource.trim().charAt(0) || 'U').toUpperCase();
    return { email, fullName, initial };
  }, [token]);

  function logout() {
    localStorage.removeItem('authToken');
    navigate('/login', { replace: true });
  }

  return (
    <header className="mb-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2 flex items-center justify-between shadow-sm">
        <div className="text-sm text-slate-500 px-2 py-1 rounded-lg">Welcome back 👋</div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-slate-900 text-sm font-medium">{email || '—'}</div>
            <div className="text-slate-500 text-xs">{fullName || 'User'}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center font-semibold">{initial}</div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm"
            title="Logout"
          >
            <LogOut size={16}/> Logout
          </button>
        </div>
      </div>
    </header>
  );
}