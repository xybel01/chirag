// Reusable paginated table. columns: [{ header, render(row) | key }]
export default function DataTable({ columns, rows, page, pageSize, total, onPage, onRowClick, emptyText = 'No records found' }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 20)));
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>{columns.map((c) => <th key={c.header} className="px-4 py-3 font-medium">{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">{emptyText}</td></tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.id ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-brand-50' : ''}>
              {columns.map((c) => <td key={c.header} className="px-4 py-2.5">{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {onPage && total > pageSize && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-sm text-gray-600">
          <span>Page {page} of {pages} ({total} records)</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
