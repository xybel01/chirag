export default function StatCard({ title, label, value, color, accent, onClick }) {
  const cardTitle = title || label;
  
  // Map color strings to tailwind text color classes
  const colorMap = {
    indigo: 'text-indigo-650',
    emerald: 'text-emerald-600',
    slate: 'text-slate-600',
    amber: 'text-amber-600',
    red: 'text-red-650',
    rose: 'text-rose-600'
  };
  const accentClass = accent || colorMap[color] || 'text-brand-700';

  return (
    <div onClick={onClick} className={`card p-4 shadow-sm bg-white border border-gray-150 rounded-xl hover:shadow transition-all ${onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-99' : ''}`}>
      <div className="text-3xs uppercase font-extrabold tracking-wider text-gray-400">{cardTitle}</div>
      <div className={`mt-1 text-xl font-bold tracking-tight ${accentClass}`}>{value ?? '—'}</div>
    </div>
  );
}
