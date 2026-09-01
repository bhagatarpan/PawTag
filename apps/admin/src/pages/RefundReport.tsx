import { useState, useEffect } from 'react';
import { Download, RefreshCw, FileText, Database, FileSpreadsheet } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

const DATE_PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'Current month' },
  { value: 'custom', label: 'Custom range' },
];

const FORMATS = [
  { value: 'csv', label: 'CSV (Full)', icon: FileSpreadsheet, description: 'All columns' },
  { value: 'csv-xero', label: 'CSV (Xero)', icon: FileSpreadsheet, description: 'Xero-compatible columns' },
  { value: 'gl', label: 'GL Journal', icon: FileText, description: 'Debit/Credit journal entries' },
  { value: 'xero', label: 'Xero', icon: Database, description: 'Push to connected Xero org' },
];

const XERO_COLUMNS = [
  'Date', 'Order Number', 'Customer Name', 'Customer Email', 'Refund ID', 'ARN', 'Status', 'Amount', 'Currency',
  'Initiated By', 'Cancelled By', 'Cancellation Reason', 'Settled At', 'Stripe Payment Intent',
];

export default function RefundReport() {
  const [datePreset, setDatePreset] = useState('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(XERO_COLUMNS);
  const [exporting, setExporting] = useState(false);
  const [xeroStatus, setXeroStatus] = useState<{ connected: boolean } | null>(null);

  useEffect(() => {
    api.get('/admin/commerce/accounting/status')
      .then((res) => setXeroStatus(res.data.data.xero))
      .catch(() => {});
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {};
      if (format === 'csv-xero') {
        params.format = 'csv';
        params.mode = 'xero';
      } else {
        params.format = format;
      }
      if (format === 'csv' && selectedColumns.length > 0) {
        params.columns = selectedColumns.join(',');
      }
      if (datePreset === '7') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === '30') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === 'month') {
        const d = new Date(); d.setDate(1);
        params.dateFrom = d.toISOString();
      }
      if (datePreset === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      if (format === 'xero') {
        const res = await api.get('/admin/commerce/refunds/export', { params });
        if (res.data.success) {
          toast.success(`Created ${res.data.data.created} Xero journals (${res.data.data.failed} failed)`);
        } else {
          toast.error(res.data.error || res.data.data?.errors?.[0] || 'Xero export failed');
        }
      } else {
        const res = await api.get('/admin/commerce/refunds/export', {
          params,
          responseType: 'blob',
        });
        const blob = new Blob([res.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `refunds-${format}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export downloaded');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Refund Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export refunds for accounting reconciliation. Settled refunds only.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Date Range</h2>
          <div className="flex flex-wrap items-center gap-3">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  datePreset === p.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Export Format</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const disabled = f.value === 'xero' && !xeroStatus?.connected;
              return (
                <button
                  key={f.value}
                  onClick={() => !disabled && setFormat(f.value)}
                  disabled={disabled}
                  className={`flex flex-col items-start p-4 text-left border rounded-xl transition-colors ${
                    format === f.value
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} className={format === f.value ? 'text-primary-600' : 'text-gray-500'} />
                    <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">{f.description}</span>
                  {disabled && (
                    <span className="text-xs text-amber-600 mt-1">Not connected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {format === 'csv' && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Columns (CSV configurable mode)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {XERO_COLUMNS.map((col) => (
                <label key={col} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-700">{col}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {format === 'xero' && !xeroStatus?.connected && (
              <span>Connect Xero first via Commerce Settings → Accounting</span>
            )}
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || (format === 'xero' && !xeroStatus?.connected)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
            Export Refunds
          </button>
        </div>
      </div>
    </div>
  );
}
