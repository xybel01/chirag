import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fileUrl } from '../api/client';
import DataTable from '../components/DataTable.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Select } from '../components/FormField.jsx';
import { fmtDate } from '../utils/format.js';

export default function Assignments() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/assignments', { params: { page, action } }).then((r) => setData(r.data)).catch(() => {});
  }, [page, action]);

  return (
    <div>
      <PageHeader title="Assignment History" subtitle="Full audit of assign, return, transfer, replace, repair and dispose actions" />
      <div className="mb-4 max-w-xs">
        <Select value={action} onChange={(v) => { setAction(v); setPage(1); }} placeholder="All actions"
          options={['ASSIGN', 'RETURN', 'TRANSFER', 'REPLACE', 'REPAIR', 'DISPOSE'].map((a) => ({ value: a, label: a }))} />
      </div>
      <DataTable
        columns={[
          { header: 'Date', render: (h) => fmtDate(h.createdAt) },
          { header: 'Action', render: (h) => <StatusBadge status={h.action} /> },
          { header: 'Asset', render: (h) => <span className="font-medium text-brand-700">{h.asset?.assetTag}</span> },
          { header: 'Category', render: (h) => h.asset?.category?.name },
          { header: 'Employee', render: (h) => h.user?.name },
          { header: 'Processed By', render: (h) => h.performedBy?.name },
          { header: 'Ack', render: (h) => h.ackFile ? <a className="text-brand-600 underline" href={fileUrl(h.ackFile)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>PDF</a> : '—' },
        ]}
        rows={data.items} page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage}
        onRowClick={(h) => navigate(`/assets/${h.assetId}`)}
      />
    </div>
  );
}
