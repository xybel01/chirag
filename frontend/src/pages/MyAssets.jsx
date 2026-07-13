import { useEffect, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtDate } from '../utils/format.js';

export default function MyAssets() {
  const [assets, setAssets] = useState([]);
  useEffect(() => { api.get('/assignments/my-assets').then((r) => setAssets(r.data)).catch(() => {}); }, []);

  return (
    <div>
      <PageHeader title="My Assets" subtitle="Company equipment currently assigned to you" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-brand-700">{a.assetTag}</div>
                <div className="text-sm text-gray-600">{a.manufacturer} {a.model}</div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <dl className="mt-3 space-y-1 text-sm text-gray-500">
              <div className="flex justify-between"><dt>Category</dt><dd className="text-gray-700">{a.category?.name}</dd></div>
              <div className="flex justify-between"><dt>Serial No.</dt><dd className="text-gray-700">{a.serialNumber}</dd></div>
              <div className="flex justify-between"><dt>Location</dt><dd className="text-gray-700">{a.location?.name || '—'}</dd></div>
              <div className="flex justify-between"><dt>Warranty until</dt><dd className="text-gray-700">{fmtDate(a.warrantyEnd)}</dd></div>
            </dl>
          </div>
        ))}
        {assets.length === 0 && <p className="text-gray-400">No assets are currently assigned to you.</p>}
      </div>
    </div>
  );
}
