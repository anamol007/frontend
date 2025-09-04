import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { validateResetToken, resetPassword as resetPasswordApi } from '../utils/api';


export default function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [err, setErr] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');

  useEffect(() => {
    (async () => {
      setValidating(true); setErr('');
      try {
        await validateResetToken(token);
        setValid(true);
      } catch (e2) {
        setErr(e2?.response?.data?.message || e2?.message || 'Invalid or expired reset link');
        setValid(false);
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (newPassword.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPasswordApi(token, newPassword);
      setOk('Password reset successfully. You can log in with your new password.');
      // Optional: redirect to login after a short pause
      setTimeout(() => nav('/login'), 1200);
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Reset password</h1>
          <p className="text-sm text-slate-500">Set a new password for your account.</p>
        </div>

        {validating && <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">Validating link…</div>}

        {!validating && !valid && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 flex items-center gap-2">
            <AlertTriangle size={16}/> {err || 'This reset link is invalid or expired.'}
          </div>
        )}

        {!validating && valid && (
          <>
            {ok && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 flex items-center gap-2">
                <CheckCircle2 size={16}/> {ok}
              </div>
            )}
            {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}

            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-600">New password</span>
                <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200">
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    className="w-full bg-transparent outline-none"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e)=> setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-600">Confirm password</span>
                <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200">
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    className="w-full bg-transparent outline-none"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e)=> setConfirm(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        <div className="mt-4">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft size={16}/> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}