export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
export const fmtMoney = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }));
export const daysUntil = (d) => (d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null);
