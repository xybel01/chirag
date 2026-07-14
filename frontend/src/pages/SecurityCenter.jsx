import { useEffect, useState } from 'react';
import api from '../api/client';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';

export default function SecurityCenter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSecurity = async () => {
    try {
      const res = await api.get('/security/status');
      setData(res.data);
    } catch (err) {
      console.error('Failed to pull security logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurity();
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-12">Loading Security Compliance Center…</div>;

  return (
    <div className="space-y-6 text-xs">
      <PageHeader
        title="Endpoint Compliance & Security Center"
        subtitle="Intune patch metrics, BitLocker encryption states, Cyber Essentials score, and CVE CVE tracking"
      />

      {/* METRIC CARD GAUGES */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 bg-white border border-gray-150 text-center flex flex-col justify-between items-center">
          <span className="text-3xs uppercase font-extrabold text-gray-400 tracking-wider">Overall Security Score</span>
          <div className="text-2xl font-black text-indigo-850 mt-2">{data?.metrics?.complianceScore}%</div>
          <p className="text-4xs text-gray-400 mt-1 leading-normal">Compliance with Cyber Essentials</p>
        </div>

        <div className="card p-5 bg-white border border-gray-150 text-center flex flex-col justify-between items-center">
          <span className="text-3xs uppercase font-extrabold text-gray-400 tracking-wider">BitLocker Encryption</span>
          <div className="text-2xl font-black text-emerald-700 mt-2">{data?.metrics?.bitlockerPercentage}%</div>
          <p className="text-4xs text-gray-400 mt-1 leading-normal">Compliant endpoint disks</p>
        </div>

        <div className="card p-5 bg-white border border-gray-150 text-center flex flex-col justify-between items-center">
          <span className="text-3xs uppercase font-extrabold text-gray-400 tracking-wider">Secure Boot Active</span>
          <div className="text-2xl font-black text-emerald-700 mt-2">{data?.metrics?.secureBootPercentage}%</div>
          <p className="text-4xs text-gray-400 mt-1 leading-normal">System firmware compliance</p>
        </div>

        <div className="card p-5 bg-white border border-gray-150 text-center flex flex-col justify-between items-center">
          <span className="text-3xs uppercase font-extrabold text-gray-400 tracking-wider">Defender Protection</span>
          <div className="text-2xl font-black text-emerald-700 mt-2">{data?.metrics?.defenderPercentage}%</div>
          <p className="text-4xs text-gray-400 mt-1 leading-normal">Active real-time engines</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* VULNERABILITIES LIST */}
        <div className="md:col-span-2 card p-5 bg-white border border-gray-150 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Active CVE Vulnerabilities</h3>
          <DataTable
            columns={[
              { header: 'CVE Reference', render: (v) => <span className="font-extrabold text-indigo-900">{v.cve}</span> },
              { header: 'Severity', render: (v) => <span className={`px-2 py-0.5 rounded text-3xs font-extrabold border ${v.severity === 'HIGH' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{v.severity}</span> },
              { header: 'Software Package', key: 'package' },
              { header: 'Remediation Status', render: (v) => <span className="text-slate-500 font-extrabold uppercase text-3xs">{v.status}</span> },
              { header: 'Devices Affected', render: (v) => <span className="font-bold text-gray-850">{v.affectedCount} devices</span> }
            ]}
            rows={data?.vulnerabilities || []}
          />
        </div>

        {/* SECURITY COMPLIANCE STANDARDS LIST */}
        <div className="card p-5 bg-white border border-gray-150 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-xs uppercase tracking-wider">Standards Compliance Matrix</h3>
          <div className="divide-y divide-gray-100">
            {data?.standards?.map((std) => (
              <div key={std.name} className="py-2.5 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-gray-800">{std.name}</h4>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="font-extrabold text-indigo-700">{std.score}</span>
                  <span className={`px-1.5 py-0.5 rounded text-3xs font-extrabold border ${std.status === 'COMPLIANT' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    {std.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
