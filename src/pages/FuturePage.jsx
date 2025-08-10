import React from 'react';
import { Lock } from 'lucide-react';

export default function FuturePage({ title='Coming soon', description='This module is not enabled yet.' }) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        <p className="text-slate-500 text-sm">{description}</p>
      </div>
      <div className="card py-14 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 grid place-items-center">
            <Lock size={22}/>
          </div>
          <div className="text-lg font-medium text-slate-800">Reserved for future use</div>
          <p className="text-slate-500">We’ll activate this page when the API is available.</p>
        </div>
      </div>
    </div>
  );
}