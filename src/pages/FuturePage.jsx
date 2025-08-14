export default function FuturePage({ title }) {
  return (
    <div className="grid place-items-center h-[60vh]">
      <div className="px-6 py-8 rounded-2xl border bg-white/70 backdrop-blur text-center max-w-lg">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-slate-600">This module is planned. No API calls are made here yet.</p>
      </div>
    </div>
  );
}