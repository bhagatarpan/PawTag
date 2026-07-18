import { useEffect, useState } from 'react';
import api from '../lib/api';
import { BarChart3, TrendingUp, Users, PawPrint, Clock, AlertTriangle, CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react';

interface StatsData {
  overview: {
    totalPets: number;
    totalLost: number;
    totalFound: number;
    totalSafe: number;
    foundByFinder: number;
    foundByOwner: number;
    lostLast30d: number;
    lostLast7d: number;
    currentlyWaiting: number;
    petsWithMultipleLosses: number;
    ownersWithHighScore: number;
  };
  performance: {
    avgTimeToFindHours: number;
    finderReuniteRate: number;
  };
  breakdown: {
    topLostPetTypes: Array<{ _id: string; count: number; totalLost: number }>;
    lostByDayOfWeek: Array<{ _id: number; count: number }>;
    responsibilityDistribution: Array<{ _id: number; count: number }>;
    monthlyTrend: Array<{ _id: string; total: number; lost: number; foundByFinder: number }>;
  };
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Statistics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats/lost-found')
      .then((r) => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading statistics...</div>;
  if (!stats) return <div className="text-center text-gray-500 py-12">Failed to load statistics</div>;

  const { overview, performance, breakdown } = stats;
  const maxPetTypeLost = Math.max(...breakdown.topLostPetTypes.map((t) => t.totalLost), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 size={28} className="text-primary-600" />
        <h1 className="text-2xl font-bold">Lost & Found Statistics</h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<PawPrint size={20} />} label="Total Pets" value={overview.totalPets} color="primary" />
        <StatCard icon={<ShieldAlert size={20} />} label="Currently Lost" value={overview.totalLost} color="red" />
        <StatCard icon={<ShieldCheck size={20} />} label="Currently Found" value={overview.totalFound} color="amber" />
        <StatCard icon={<CheckCircle size={20} />} label="Safe & Sound" value={overview.totalSafe} color="green" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Clock size={20} />} label="Waiting for Owner" value={overview.currentlyWaiting} color="blue" />
        <StatCard icon={<TrendingUp size={20} />} label="Lost (30 days)" value={overview.lostLast30d} color="orange" />
        <StatCard icon={<Users size={20} />} label="High-Risk Owners" value={overview.ownersWithHighScore} color="red" />
        <StatCard icon={<AlertTriangle size={20} />} label="Repeat Offenders" value={overview.petsWithMultipleLosses} color="red" />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Time to Reunite</h3>
          <p className="text-3xl font-bold text-primary-600">{performance.avgTimeToFindHours}h</p>
          <p className="text-xs text-gray-400 mt-1">from lost to found by finder</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Finder Reunite Rate</h3>
          <p className="text-3xl font-bold text-green-600">{performance.finderReuniteRate}%</p>
          <p className="text-xs text-gray-400 mt-1">of lost pets found via PawTag</p>
        </div>
      </div>

      {/* Top Lost Pet Types */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Lost by Pet Type</h3>
        <div className="space-y-3">
          {breakdown.topLostPetTypes.map((pt) => (
            <div key={pt._id} className="flex items-center gap-3">
              <span className="text-sm w-24 shrink-0">{pt._id}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-red-400 h-full rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.max((pt.totalLost / maxPetTypeLost) * 100, 8)}%` }}
                >
                  <span className="text-xs font-medium text-white">{pt.totalLost}</span>
                </div>
              </div>
              <span className="text-xs text-gray-400 w-12 text-right">{pt.count} pets</span>
            </div>
          ))}
          {breakdown.topLostPetTypes.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
        </div>
      </div>

      {/* Lost by Day of Week */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Lost by Day of Week</h3>
        <div className="flex items-end gap-2 h-40">
          {dayNames.map((day, i) => {
            const entry = breakdown.lostByDayOfWeek.find((d) => d._id === i + 1);
            const count = entry?.count || 0;
            const maxCount = Math.max(...breakdown.lostByDayOfWeek.map((d) => d.count), 1);
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-600">{count}</span>
                <div className="w-full bg-red-400 rounded-t" style={{ height: `${Math.max((count / maxCount) * 100, 2)}%` }} />
                <span className="text-xs text-gray-500">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Responsibility Distribution */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Owner Responsibility Distribution</h3>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Super Parent', range: '0', color: 'bg-green-500', desc: 'Score: 0' },
            { label: 'Good', range: '1-2', color: 'bg-amber-500', desc: 'Score: 1-2' },
            { label: 'Improving', range: '3-4', color: 'bg-orange-500', desc: 'Score: 3-4' },
            { label: 'At Risk', range: '5+', color: 'bg-red-500', desc: 'Score: 5+' },
            { label: 'No Pets', range: 'N/A', color: 'bg-gray-300', desc: 'No pets yet' },
          ].map((bucket) => {
            const entry = breakdown.responsibilityDistribution.find((d) => {
              if (bucket.range === '0') return d._id === 0;
              if (bucket.range === '1-2') return d._id >= 1 && d._id <= 2;
              if (bucket.range === '3-4') return d._id >= 3 && d._id <= 4;
              if (bucket.range === '5+') return d._id >= 5;
              return false;
            });
            return (
              <div key={bucket.range} className="text-center">
                <div className={`w-full h-16 ${bucket.color} rounded-lg flex items-center justify-center text-white font-bold text-lg mb-2`}>
                  {entry?.count || 0}
                </div>
                <p className="text-xs font-medium">{bucket.label}</p>
                <p className="text-xs text-gray-400">{bucket.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Trend */}
      {breakdown.monthlyTrend.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Trend (Last 6 Months)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500">Month</th>
                  <th className="text-right py-2 text-gray-500">Total</th>
                  <th className="text-right py-2 text-gray-500">Lost</th>
                  <th className="text-right py-2 text-gray-500">Found by Finder</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.monthlyTrend.map((m) => (
                  <tr key={m._id} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{m._id}</td>
                    <td className="py-2 text-right">{m.total}</td>
                    <td className="py-2 text-right text-red-600">{m.lost}</td>
                    <td className="py-2 text-right text-green-600">{m.foundByFinder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Found by Finder vs Owner */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">How Pets Are Found</h3>
        <div className="flex gap-4">
          <div className="flex-1 bg-green-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{overview.foundByFinder}</p>
            <p className="text-sm text-green-700 mt-1">Found via PawTag Finder</p>
          </div>
          <div className="flex-1 bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{overview.foundByOwner}</p>
            <p className="text-sm text-blue-700 mt-1">Found by Owner Directly</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color] || colors.primary} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
