import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as loginApi, api } from '../utils/api';
import { Eye, EyeOff, Shield, Mail, Lock } from 'lucide-react';
import gsap from 'gsap';

function extractAuth(payload) {
  const p = payload?.data ?? payload ?? {};
  const token =
    p.token || p.accessToken || p.jwt || p?.data?.token || p?.data?.accessToken || p?.data?.jwt || null;
  const user =
    p.user || p?.data?.user || (p.user === undefined && p?.data && typeof p.data === 'object' ? p.data : null);
  return { token, user };
}

export default function Login() {
  const nav = useNavigate();
  const rootRef = useRef(null);
  const stageRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.login-card', { y: 16, opacity: 0, duration: 0.6, ease: 'power2.out' });
      gsap.from('.art-stage', { opacity: 0, duration: 0.8, ease: 'power2.out' });
      gsap.to('.bg-clouds', { duration: 10, '--g1x': '12%', '--g2x': '98%', '--g3y': '118%', ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to('.blob', {
        x: () => gsap.utils.random(-18, 18),
        y: () => gsap.utils.random(-24, 24),
        rotate: () => gsap.utils.random(-6, 6),
        scale: () => gsap.utils.random(0.96, 1.04),
        duration: () => gsap.utils.random(6, 10),
        yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.2,
      });
      gsap.to('.ring', { rotate: 360, duration: 40, repeat: -1, ease: 'none' });
      gsap.to('.chip', { y: -10, x: 10, duration: 8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      gsap.to('.sparkle', {
        opacity: () => gsap.utils.random(0.2, 0.9),
        scale: () => gsap.utils.random(0.8, 1.4),
        duration: () => gsap.utils.random(1.2, 2.4),
        repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: { each: 0.12, from: 'random' },
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const move = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      const dx = (clientX - r.left) / r.width - 0.5;
      const dy = (clientY - r.top) / r.height - 0.5;
      gsap.to('.parallax', { x: dx * 24, y: dy * 24, rotate: dx * 6, duration: 0.6, overwrite: 'auto', ease: 'sine.out' });
    };
    const onMouse = (e) => move(e.clientX, e.clientY);
    const onTouch = (e) => { const t = e.touches?.[0]; if (t) move(t.clientX, t.clientY); };
    el.addEventListener('mousemove', onMouse);
    el.addEventListener('touchmove', onTouch, { passive: true });
    return () => { el.removeEventListener('mousemove', onMouse); el.removeEventListener('touchmove', onTouch); };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await loginApi({ email, password });
      const { token, user } = extractAuth(res);
      if (token) { try { localStorage.setItem('token', token); localStorage.setItem('accessToken', token); } catch {} }
      if (user)  { try { localStorage.setItem('user', JSON.stringify(user)); } catch {} }
      try { await api.get('/auth/me'); } catch {}
      window.location.replace('/dashboard');
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || 'Error during login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={rootRef} className="min-h-screen grid md:grid-cols-2 bg-slate-50">
      {/* LEFT: form */}
      <div className="relative flex items-center justify-center p-8 md:p-14">
        <div className="login-card w-full max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div className="font-semibold text-slate-800">Inventory Console</div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-6">Welcome back!</h1>

          {err && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{err}</div>}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
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

            {/* Password */}
            <div className="block">
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
            </div>

            {/* Forgot password (moved OUTSIDE label to avoid click being swallowed) */}
            <div className="mt-1 flex items-center justify-end gap-3">
              <Link to="/forgot-password" className="text-sm text-indigo-700 hover:text-indigo-900">
                Forgot password?
              </Link>
              {/* optional extra safety: an explicit button that navigates */}
              <button
                type="button"
                onClick={() => nav('/forgot-password')}
                className="hidden rounded-md px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
              >
                Go
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 font-semibold text-white shadow-lg hover:shadow-xl disabled:opacity-60 transition"
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">By continuing you agree to our terms & privacy policy.</p>
        </div>
      </div>

      {/* RIGHT: GSAP animated visual */}
      <div ref={stageRef} className="relative hidden md:block overflow-hidden">
        <div
          className="bg-clouds absolute inset-0"
          style={{
            '--g1x': '20%',
            '--g2x': '100%',
            '--g3y': '120%',
            background:
              'radial-gradient(60% 40% at var(--g1x) -10%, rgba(99,102,241,0.35), transparent),' +
              'radial-gradient(60% 50% at var(--g2x) 0%, rgba(16,185,129,0.25), transparent),' +
              'radial-gradient(80% 60% at 50% var(--g3y), rgba(139,92,246,0.25), transparent)',
          }}
        />
        <div className="art-stage absolute inset-0">
          <div className="parallax blob absolute left-16 top-20 h-40 w-40 rounded-[2rem] bg-white/35 backdrop-blur-xl shadow-2xl ring-1 ring-white/30" />
          <div className="parallax blob absolute right-16 top-32 h-28 w-28 rounded-full bg-white/30 backdrop-blur-xl shadow-xl ring-1 ring-white/30" />
          <div className="parallax blob absolute left-24 bottom-24 h-44 w-44 rotate-12 rounded-3xl bg-white/25 backdrop-blur-xl shadow-xl ring-1 ring-white/30" />
          <div className="parallax ring absolute right-24 bottom-24 h-48 w-48 rounded-full border border-white/30" />
          <div className="parallax chip absolute right-28 bottom-36 h-2 w-40 rounded-full bg-white/60 backdrop-blur-md shadow" />
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="sparkle absolute h-1.5 w-1.5 rounded-full bg-white/70 shadow"
              style={{ left: `${10 + (i * 5.7) % 80}%`, top: `${12 + (i * 7.3) % 75}%`, opacity: 0.4 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}