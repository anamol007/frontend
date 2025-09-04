// src/pages/MyProfilePage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  User2, Mail, Shield, ShieldCheck, Save, RotateCw, KeyRound, CheckCircle2, AlertTriangle, X
} from 'lucide-react';
import { api } from '../utils/api';

// tiny helpers
const allow = (whitelist, obj) => {
  const set = new Set(whitelist);
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (!set.has(k)) return;
    if (v === '' || v == null) return;
    out[k] = v;
  });
  return out;
};

function Banner({ tone = 'ok', children, onClose }) {
  const palette = tone === 'ok'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-700';
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-2 ${palette}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">{children}</div>
      {onClose && (
        <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-white/40">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default function MyProfilePage() {
  // who am I
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // edit profile
  const [form, setForm] = useState({ fullname: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // change password
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  // messages
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  // load user
  async function fetchMe() {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get('/users/verify-token');
      // backend variations: {data:{user}} | {user} | whole object
      const u = r?.data?.data?.user || r?.data?.user || r?.data || null;
      setMe(u);
      setForm({ fullname: u?.fullname || '', email: u?.email || '' });
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchMe(); }, []);

  const dirty = useMemo(() => {
    if (!me) return false;
    return (form.fullname ?? '') !== (me.fullname ?? '') || (form.email ?? '') !== (me.email ?? '');
  }, [form, me]);

  // save profile
  async function submitProfile(e) {
    e?.preventDefault?.();
    if (!me?.id || savingProfile || !dirty) return;
    setErr(''); setOk('');
    setSavingProfile(true);
    try {
      const body = allow(['fullname', 'email'], form);
      await api.put(`/users/${me.id}`, body);
      setOk('Profile updated');
      await fetchMe(); // refresh header + local state
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  }

  // change password
  async function submitPassword(e) {
    e?.preventDefault?.();
    if (!me?.id || savingPwd) return;

    const { oldPassword, newPassword, confirmPassword } = pwd;
    setErr(''); setOk('');

    if (!oldPassword || !newPassword) {
      setErr('Current password and new password are required');
      return;
    }
    if (newPassword.length < 6) {
      setErr('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('New password and confirm do not match');
      return;
    }

    setSavingPwd(true);
    try {
      // Swagger expects currentPassword + newPassword. Send both keys for safety.
      await api.put(`/users/${me.id}/change-password`, {
        currentPassword: oldPassword,
        oldPassword,   // harmless alias if the server accepts it
        newPassword
      });
      setOk('Password changed');
      setPwd({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || 'Password change failed');
    } finally {
      setSavingPwd(false);
    }
  }

  // reset profile form
  const resetForm = () => {
    if (!me) return;
    setForm({ fullname: me.fullname || '', email: me.email || '' });
  };

  return (
    <div className="space-y-5">
      {/* header card */}
      <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_rgba(255,255,255,.6),0_10px_30px_-12px_rgba(2,6,23,.25)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <User2 size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
            <p className="text-sm text-slate-500">Update your information and change your password.</p>
          </div>
        </div>

        {err && <Banner tone="err" onClose={() => setErr('')}>{err}</Banner>}
        {ok  && <Banner tone="ok"  onClose={() => setOk('')}>{ok}</Banner>}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
          <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white/60" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* left: profile */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                <span className="text-lg font-semibold">
                  {(me?.fullname || me?.email || '?').trim().charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-900">
                  {me?.fullname || '—'}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={14} className="text-slate-400" />
                  <span className="truncate">{me?.email || '—'}</span>
                </div>
                {!!me?.role && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                    <Shield size={12} /> {me.role}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={submitProfile} className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Full name</span>
                <input
                  value={form.fullname}
                  onChange={(e)=> setForm(f => ({ ...f, fullname: e.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  placeholder="Your name"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e)=> setForm(f => ({ ...f, email: e.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  placeholder="you@company.com"
                />
              </label>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <RotateCw size={16} /> Reset
                </button>
                <button
                  type="submit"
                  disabled={!dirty || savingProfile}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow hover:shadow-md disabled:opacity-60
                    ${(!dirty || savingProfile) ? 'bg-slate-400' : 'bg-gradient-to-r from-indigo-600 to-violet-600'}`}
                >
                  <Save size={16} /> {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>

          {/* right: password */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-slate-900">
              <ShieldCheck size={18} className="text-indigo-600" />
              <div className="font-semibold">Change password</div>
            </div>

            <form onSubmit={submitPassword} className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Current password</span>
                <input
                  type="password"
                  value={pwd.oldPassword}
                  onChange={(e)=> setPwd(p => ({ ...p, oldPassword: e.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">New password</span>
                <input
                  type="password"
                  value={pwd.newPassword}
                  onChange={(e)=> setPwd(p => ({ ...p, newPassword: e.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                <span className="text-[11px] text-slate-400">Minimum 6 characters</span>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-600">Confirm new password</span>
                <input
                  type="password"
                  value={pwd.confirmPassword}
                  onChange={(e)=> setPwd(p => ({ ...p, confirmPassword: e.target.value }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <KeyRound size={16} /> {savingPwd ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}