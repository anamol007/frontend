// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../utils/api';
import { Eye, EyeOff, Shield, Mail, Lock } from 'lucide-react';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login({ email, password });
      nav('/dashboard', { replace: true });
    } catch (e2) {
      setErr(e2?.message || 'Error during login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-50">
      {/* LEFT: form */}
      <div className="relative flex items-center justify-center p-8 md:p-14">
        <div className="w-full max-w-md">
          {/* tiny brand */}
          <div className="mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div className="font-semibold text-slate-800">Inventory Console</div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-6">
            Welcome back!
          </h1>

          {err && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm ring-0 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 transition">
                <Mail className="h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  className="w-full bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-600">Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm ring-0 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 transition">
                <Lock className="h-5 w-5 text-slate-400" />
                <input
                  type={show ? 'text' : 'password'}
                  className="w-full bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-500"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 font-semibold text-white shadow-lg hover:shadow-xl disabled:opacity-60 transition"
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          {/* subtle footer */}
          <p className="mt-6 text-sm text-slate-500">
            By continuing you agree to our terms & privacy policy.
          </p>
        </div>
      </div>

      {/* RIGHT: animated visual */}
      <div className="relative hidden md:block overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_40%_at_20%_-10%,rgba(99,102,241,.35),transparent),radial-gradient(60%_50%_at_100%_0%,rgba(16,185,129,.25),transparent),radial-gradient(80%_60%_at_50%_120%,rgba(139,92,246,.25),transparent)]" />
        <div className="absolute inset-0">
          {/* floating shapes */}
          <div className="absolute left-16 top-24 h-24 w-24 rounded-3xl bg-white/60 backdrop-blur shadow-2xl animate-[float_9s_ease-in-out_infinite]" />
          <div className="absolute right-16 top-40 h-28 w-28 rounded-full bg-white/50 backdrop-blur shadow-xl animate-[float_7s_ease-in-out_infinite]" />
          <div className="absolute left-24 bottom-24 h-40 w-40 rotate-12 rounded-2xl bg-white/40 backdrop-blur shadow-xl animate-[float_11s_ease-in-out_infinite]" />
        </div>
        <style>{`
          @keyframes float {
            0%   { transform: translateY(0px) }
            50%  { transform: translateY(-16px) }
            100% { transform: translateY(0px) }
          }
        `}</style>
      </div>
    </div>
  );
}