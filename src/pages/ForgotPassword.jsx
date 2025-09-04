import React, { useState } from 'react';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { requestPasswordReset } from '../utils/api';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setOk(''); setErr('');
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      // API returns 200 even if email doesn’t exist — we show a generic success.
      setOk('If that email exists, a reset link has been sent.');
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || 'Failed to request reset');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-slate-900">Forgot password</h1>
          <p className="text-sm text-slate-500">Enter your email and we’ll send you a reset link.</p>
        </div>

        {ok && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{ok}</div>}
        {err && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200">
              <Mail className="h-5 w-5 text-slate-400" />
              <input
                type="email"
                className="w-full bg-transparent outline-none"
                placeholder="you@company.com"
                value={email}
                onChange={(e)=> setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send size={16}/> {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-4">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
            <ArrowLeft size={16}/> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}