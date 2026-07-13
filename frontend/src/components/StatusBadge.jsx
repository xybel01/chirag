const COLORS = {
  AVAILABLE: 'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  REPAIR: 'bg-amber-100 text-amber-800',
  FAULTY: 'bg-red-100 text-red-800',
  LOST: 'bg-gray-200 text-gray-700',
  DISPOSED: 'bg-gray-100 text-gray-500',
  OPEN: 'bg-blue-100 text-blue-800',
  SENT_TO_VENDOR: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
