import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { API_URL as BASE } from '../utils/api';

const LOGIN_PATH = process.env.REACT_APP_LOGIN_PATH || '/auth/login';
const AUTH_MODE = (process.env.REACT_APP_AUTH_MODE || 'token').toLowerCase();
const TOKEN_KEY = 'authToken';

function extractToken(res) {
  const d = res?.data || {};
  const h = res?.headers || {};
  return (
    d.token ||
    d.accessToken ||
    d.access_token ||
    d.jwt ||
    d.data?.token ||
    d.data?.accessToken ||
    d.data?.access_token ||
    (h['authorization'] && h['authorization'].startsWith('Bearer ')
      ? h['authorization'].slice(7)
      : '')
  );
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [pwd, setPwd]   = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type:'', text:'' });

  useEffect(() => {
    const remembered = localStorage.getItem('rememberEmail');
    if (remembered) setEmail(remembered);
  }, []);

  const emailValid = useMemo(() => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg({type:'', text:''});

    if (!emailValid || !email) return setMsg({type:'error', text:'Please enter a valid email.'});
    if (!pwd) return setMsg({type:'error', text:'Please enter your password.'});

    try {
      setLoading(true);
      const res = await axios.post(
        `${BASE}${LOGIN_PATH}`,
        { email, password: pwd },
        { withCredentials: AUTH_MODE === 'cookie' }
      );

      if (AUTH_MODE === 'cookie') {
        localStorage.setItem(TOKEN_KEY, 'session');
      } else {
        const token = extractToken(res);
        if (!token) throw new Error('No token returned');
        localStorage.setItem(TOKEN_KEY, token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      if (remember) localStorage.setItem('rememberEmail', email);

      setMsg({type:'ok', text:'Welcome back — redirecting…'});
      setTimeout(() => navigate('/dashboard', { replace:true }), 500);
    } catch (err) {
      setMsg({type:'error', text: err?.response?.data?.message || err?.message || 'Login failed'});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-2">
      {/* LEFT: Form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-lg">
          <div className="mb-10">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <span className="text-lg font-bold">∗</span>
            </div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            Welcome back<span className="text-indigo-600">!</span>
          </h1>
          <p className="mt-2 text-slate-500">Enter to get unlimited access to data &amp; information.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={[
                    'w-full rounded-2xl border bg-white px-10 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition',
                    email && !emailValid ? 'border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                                         : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100',
                  ].join(' ')}
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                />
              </div>
              {!emailValid && <div className="mt-1 text-xs text-rose-600">Please enter a valid email.</div>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-10 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  value={pwd}
                  onChange={(e)=>setPwd(e.target.value)}
                />
                <button
                  type="button"
                  onClick={()=>setShowPwd(s=>!s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e)=>setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Remember me
              </label>
              <span />
            </div>

            {msg.text && (
              <div className={[
                'rounded-xl border px-3 py-2 text-sm',
                msg.type === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : 'border-rose-300 bg-rose-50 text-rose-700'
              ].join(' ')}>{msg.text}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT: decorative panel */}
      <div className="relative hidden overflow-hidden bg-indigo-900 lg:block">
        <div className="absolute inset-0 grid grid-cols-2 gap-6 p-10 opacity-90">
          <div className="rounded-3xl bg-indigo-700/60 backdrop-blur" />
          <div className="rounded-3xl bg-purple-700/60 backdrop-blur" />
          <div className="rounded-3xl bg-indigo-800/60 backdrop-blur" />
          <div className="rounded-3xl bg-purple-800/60 backdrop-blur" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_250px_at_70%_40%,rgba(255,255,255,0.15),transparent_60%),radial-gradient(600px_350px_at_30%_70%,rgba(99,102,241,0.25),transparent_60%)]" />
      </div>
    </div>
  );
}