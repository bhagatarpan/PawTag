import { useState, useEffect } from 'react';
import { Scan, Calendar, Filter, ChevronDown, Monitor, Smartphone, Tablet, Globe, Eye, Bell, MapPin } from 'lucide-react';
import api from '../lib/api';
import { API } from '@pawtag/shared/api';
import { formatDistanceToNow } from 'date-fns';

interface ScanAnalytics {
  summary: {
    totalScans: number;
    scansInPeriod: number;
    uniqueTags: number;
    uniquePets: number;
    notifiedCount: number;
    locationSharedCount: number;
  };
  byDeviceType: Array<{ type: string; count: number; percentage: number }>;
  byBrowser: Array<{ browser: string; count: number; percentage: number }>;
  byOS: Array<{ os: string; count: number; percentage: number }>;
  byAction: Array<{ action: string; count: number; percentage: number }>;
  topTags: Array<{ tagId: string; tagName: string; scanCount: number }>;
  topPets: Array<{ petId: string; petName: string; scanCount: number }>;
  scansByDay: Array<{ date: string; count: number }>;
  recentScans: Array<{
    _id: string;
    tagId: { tagId: string } | null;
    petId: { name: string } | null;
    deviceType: string;
    deviceBrowser: string;
    deviceOS: string;
    action: string;
    ipLocation?: { city?: string; region?: string; country?: string };
    createdAt: string;
  }>;
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 30 Days', value: '30days' },
  { label: 'Last 90 Days', value: '90days' },
  { label: 'Custom', value: 'custom' },
];

function getDateRange(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: string;

  switch (preset) {
    case 'today':
      start = end;
      break;
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + 1);
      start = d.toISOString().split('T')[0];
      break;
    }
    case 'month':
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    case '30days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
      break;
    }
    case '90days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      start = d.toISOString().split('T')[0];
      break;
    }
    default:
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  return { startDate: start, endDate: end };
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={24} className="text-white" />
        </div>
        <div>
          <p className="text-3xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function HorizontalBarChart({ items, labelKey, color = 'bg-primary-500' }: {
  items: Array<{ [key: string]: string | number; count: number; percentage: number }>;
  labelKey: string;
  color?: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item[labelKey]} className="flex items-center gap-3">
          <span className="text-sm text-gray-600 w-28 truncate">{String(item[labelKey] || 'Unknown')}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-4">
            <div
              className={`${color} h-4 rounded-full transition-all duration-500`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-900 w-16 text-right">
            {item.count} ({item.percentage}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function ScanAnalyticsPage() {
  const [analytics, setAnalytics] = useState<ScanAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [datePreset, setDatePreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = datePreset === 'custom'
        ? { startDate: customStart, endDate: customEnd }
        : getDateRange(datePreset);
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`${API.admin.finderScans.analytics}?${params.toString()}`);
      setAnalytics(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [datePreset, customStart, customEnd]);

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        </div>
      </div>
    );
  }

  const selectedPreset = DATE_PRESETS.find(p => p.value === datePreset);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Scan size={24} className="text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Scan Analytics</h1>
              <p className="text-sm text-gray-500">Monitor finder activity and scan patterns</p>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Calendar size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{selectedPreset?.label || 'Select'}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {showDateDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      setDatePreset(preset.value);
                      setShowDateDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      datePreset === preset.value ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Range */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}

        {analytics && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <StatCard
                label="Total Scans"
                value={analytics.summary.totalScans}
                icon={Scan}
                color="bg-primary-600"
              />
              <StatCard
                label="Scans in Period"
                value={analytics.summary.scansInPeriod}
                icon={Calendar}
                color="bg-blue-600"
              />
              <StatCard
                label="Unique Tags Scanned"
                value={analytics.summary.uniqueTags}
                icon={Globe}
                color="bg-green-600"
              />
              <StatCard
                label="Unique Pets Found"
                value={analytics.summary.uniquePets}
                icon={Globe}
                color="bg-purple-600"
              />
              <StatCard
                label="Owner Notifications"
                value={analytics.summary.notifiedCount}
                icon={Bell}
                color="bg-amber-600"
              />
              <StatCard
                label="Location Shared"
                value={analytics.summary.locationSharedCount}
                icon={MapPin}
                color="bg-cyan-600"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Device Type */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Type</h3>
                {analytics.byDeviceType.length > 0 ? (
                  <HorizontalBarChart items={analytics.byDeviceType} labelKey="type" color="bg-primary-500" />
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>

              {/* Browser */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Browser</h3>
                {analytics.byBrowser.length > 0 ? (
                  <HorizontalBarChart items={analytics.byBrowser} labelKey="browser" color="bg-blue-500" />
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Operating System */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Operating System</h3>
                {analytics.byOS.length > 0 ? (
                  <HorizontalBarChart items={analytics.byOS} labelKey="os" color="bg-green-500" />
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>

              {/* Action */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Action</h3>
                {analytics.byAction.length > 0 ? (
                  <HorizontalBarChart items={analytics.byAction} labelKey="action" color="bg-purple-500" />
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>
            </div>

            {/* Top Tags & Pets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Top Tags */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Scanned Tags</h3>
                {analytics.topTags.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topTags.map((tag) => (
                      <div key={tag.tagId} className="flex items-center gap-3">
                        <span className="text-sm font-mono text-gray-600 w-28 truncate">{tag.tagId}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4">
                          <div
                            className="bg-primary-500 h-4 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((tag.scanCount / (analytics.topTags[0]?.scanCount || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-20 text-right">
                          {tag.scanCount} scans
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>

              {/* Top Pets */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Scanned Pets</h3>
                {analytics.topPets.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topPets.map((pet) => (
                      <div key={pet.petId} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-28 truncate">{pet.petName || 'Unknown'}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4">
                          <div
                            className="bg-green-500 h-4 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((pet.scanCount / (analytics.topPets[0]?.scanCount || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-20 text-right">
                          {pet.scanCount} scans
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Scans</h3>
              {analytics.recentScans.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Time</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Tag</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Pet</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Device</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Browser</th>
                        <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analytics.recentScans.map((scan) => (
                        <tr key={scan._id} className="hover:bg-gray-50">
                          <td className="py-3 text-sm text-gray-600">
                            {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
                          </td>
                          <td className="py-3 text-sm font-mono text-gray-600">
                            {scan.tagId?.tagId || 'N/A'}
                          </td>
                          <td className="py-3 text-sm text-gray-600">
                            {scan.petId?.name || 'Unknown'}
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                              {scan.deviceType === 'mobile' && <Smartphone size={14} />}
                              {scan.deviceType === 'tablet' && <Tablet size={14} />}
                              {scan.deviceType === 'desktop' && <Monitor size={14} />}
                              {scan.deviceType || 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-gray-600">
                            {scan.deviceBrowser || 'Unknown'}
                          </td>
                          <td className="py-3 text-sm text-gray-600">
                            {scan.ipLocation?.city || 'Unknown'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent scans</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ScanAnalyticsPage;
