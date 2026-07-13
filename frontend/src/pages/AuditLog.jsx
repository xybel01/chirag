import { useEffect, useState } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { Select } from '../components/FormField.jsx';

export default function AuditLog() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get('/audit', { params: { page, entity } }).then((r) => setData(r.data)).catch(() => {});
  }, [page, entity]);

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Complete record of who did what, and when" />
      <div className="mb-4 max-w-xs">
        <Select value={entity} onChange={(v) => { setEntity(v); setPage(1); }} placeholder="All entities"
          options={['Asset', 'User', 'RepairTicket', 'License', 'StockItem'].map((e) => ({ value: e, label: e }))} />
      </div>
      <DataTable
        columns={[
          { header: 'Date & Time', render: (l) => new Date(l.createdAt).toLocaleString() },
          { header: 'User', render: (l) => l.user?.name || 'System' },
          { header: 'Action', render: (l) => <span className="font-medium">{l.action}</span> },
          { header: 'Entity', key: 'entity' },
          { header: 'Record ID', key: 'entityId' },
          { header: 'IP', render: (l) => l.ip || '—' },
        ]}
        rows={data.items} page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage}
        onRowClick={setDetail}
      />
      <Modal open={!!detail} title={`${detail?.action} ${detail?.entity} #${detail?.entityId}`} onClose={() => setDetail(null)} wide>
        <div className="grid gap-4 md:grid-cols-2 text-xs">
          <div>
            <h4 className="mb-2 font-semibold text-gray-700">Before</h4>
            <pre className="max-h-80 overflow-auto rounded bg-gray-50 p-3">{JSON.stringify(detail?.before, null, 2) || '—'}</pre>
          </div>
          <div>
            <h4 className="mb-2 font-semibold text-gray-700">After</h4>
            <pre className="max-h-80 overflow-auto rounded bg-gray-50 p-3">{JSON.stringify(detail?.after, null, 2) || '—'}</pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
