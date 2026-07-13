export default function StatCard({ label, value, accent = 'text-brand-700', onClick }) {
  return (
    <div onClick={onClick} className={`card p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value ?? '—'}</div>
    </div>
  );
}
