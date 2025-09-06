// src/pages/ResetPassword.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { validateResetToken, resetPassword as resetPasswordApi } from '../utils/api';
import { Lock, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

export default function ResetPassword() {
  const nav = useNavigate();
  const { token: tokenFromPath } = useParams();
  const [search] = useSearchParams();
  const tokenFromQuery = search.get('token') || '';

  const token = useMemo(() => tokenFromPath || tokenFromQuery || '', [tokenFromPath, tokenFromQuery]);

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [who, setWho] = useState(null); // optional: { email, fullname }
  const [err, setErr] = useState('');

  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      setErr('');
      if (!token) {
        setValid(false);
        setValidating(false);
        return;
      }
      try {
        setValidating(true);
        const r = await validateResetToken(token); // GET /users/validate-reset-token/:token
        if (!alive) return;
        setValid(true);
        setWho(r?.data?.data || r?.data || null);
      } catch (e) {
        if (!alive) return;
        const msg = e?.response?.data?.message || e?.message || 'Invalid or expired reset link';
        setErr(msg);
        setValid(false);
      } finally {
        if (alive) setValidating(false);
      }
    }
    run();

    return () => { alive = false; };
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!token) { setErr('Missing reset token'); return; }
    if (!p1 || p1.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (p1 !== p2) { setErr('Passwords do not match'); return; }

    try {
      setBusy(true);
      await resetPasswordApi(token, p1); // POST /users/reset-password { token, newPassword }
      setDone(true);
      // after a short pause, send to login
      setTimeout(() => nav('/login', { replace: true }), 1600);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to reset password';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur">
        {/* header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white shadow">
            <Shield size={18} />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">Reset your password</div>
            <div className="text-xs text-slate-500">Set a new password for your account</div>
          </div>
        </div>

        {/* status / errors */}
        {validating && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Validating reset link…
          </div>
        )}
        {!validating && !valid && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            <AlertCircle size={16} className="mt-0.5" />
            <div>
              <div className="font-medium">This reset link isn’t valid.</div>
              <div className="text-sm">{err || 'Please request a new password reset email.'}</div>
              <div className="mt-2">
                <Link to="/forgot-password" className="text-indigo-600 hover:underline">Request a new link</Link>
              </div>
            </div>
          </div>
        )}

        {/* form */}
        {!validating && valid && !done && (
          <form onSubmit={submit} className="space-y-4">
            {!!who?.email && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Resetting password for <span className="font-medium text-slate-800">{who.email}</span>
              </div>
            )}

            {err && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                {err}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-600">New password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <Lock size={16} className="text-slate-400" />
                <input
                  type="password"
                  className="w-full bg-transparent outline-none"
                  placeholder="••••••••"
                  value={p1}
                  onChange={(e) => setP1(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-600">Confirm password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
                <Lock size={16} className="text-slate-400" />
                <input
                  type="password"
                  className="w-full bg-transparent outline-none"
                  placeholder="••••••••"
                  value={p2}
                  onChange={(e) => setP2(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* success */}
        {!validating && valid && done && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-800">
            <CheckCircle2 size={18} className="mt-0.5" />
            <div>
              <div className="font-medium">Password updated.</div>
              <div className="text-sm">You’ll be redirected to sign in.</div>
              <div className="mt-2"><Link to="/login" className="text-emerald-800 underline">Go to login now</Link></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}