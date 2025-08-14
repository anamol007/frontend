import { useNavigate } from 'react-router-dom';
import { clearAuth, getUser } from '../utils/api';
import { LogOut } from 'lucide-react';

export default function Topbar() {
  const nav = useNavigate();
  const user = getUser();
  const email = user?.email || '—';
  const fullname = user?.fullname || user?.name || '';
  const initial = (fullname || email || '?').charAt(0).toUpperCase();

  function logout() { clearAuth(); nav('/login', { replace: true }); }

  return (
    <header className="relative z-10 h-16 border-b border-slate-200 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-900">Dashboard</span>
          <span className="mx-2">•</span>
          <span className="hidden sm:inline">Welcome back</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-white">{initial}</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{email}</div>
              <div className="text-xs text-slate-500">{fullname}</div>
            </div>
          </div>

          <button onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}