import React from 'react';

export default function CoordinatesPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-900">Coordinates</h1>
        <p className="text-sm text-slate-500">
          Coordinates module is coming soon. You can keep the menu item, but there’s no CRUD here yet.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 text-sm text-slate-600">
        If you don’t need this section now, remove the link from the Sidebar to keep things tidy.
      </div>
    </div>
  );
}