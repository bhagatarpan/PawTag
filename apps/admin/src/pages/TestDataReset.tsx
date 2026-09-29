import { useState } from 'react';
import { API } from '@pawtag/shared/api';
import { ConfirmDialog } from '@pawtag/ui';
import {
  Database, AlertTriangle, Trash2, CheckCircle, Loader2,
  ChevronDown, ChevronRight, Shield, Users, ShoppingCart,
  PawPrint, CreditCard, Bell, FileText, RotateCcw,
} from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

interface ResetResult {
  deleted: Record<string, number>;
  preserved: Record<string, number>;
  demoDataRecreated: boolean;
  totalDeleted: number;
  message: string;
}

const DELETE_CATEGORIES = [
  {
    label: 'Customer Accounts & Sessions',
    icon: Users,
    items: ['Users (non-admin)', 'Refresh Tokens', 'Verification Tokens', 'Push Tokens'],
  },
  {
    label: 'Pets & Tags',
    icon: PawPrint,
    items: ['Pets', 'Tags', 'Escalation Records', 'Tag Expiry Notifications'],
  },
  {
    label: 'Commerce & Orders',
    icon: ShoppingCart,
    items: ['Orders', 'Carts', 'Pending Orders', 'Invoices', 'Invoice Access Tokens', 'Payment Transactions', 'Fulfilments', 'Returns', 'Shipments', 'Pending Refund Retries'],
  },
  {
    label: 'Subscriptions & Membership',
    icon: CreditCard,
    items: ['Subscriptions', 'User Memberships', 'Digital Entitlements'],
  },
  {
    label: 'Loyalty & Rewards',
    icon: Shield,
    items: ['Guardian Points Ledger', 'Guardian Tier History', 'PawRewards Ledger'],
  },
  {
    label: 'Promotions & Referrals',
    icon: FileText,
    items: ['Promo Codes', 'Referrals', 'Referral Codes'],
  },
  {
    label: 'Notifications & Communication',
    icon: Bell,
    items: ['Notifications', 'Email Audit', 'Support Requests'],
  },
  {
    label: 'Audit, Logs & System',
    icon: Database,
    items: ['Audit Events', 'System Logs', 'Webhook Events', 'Stock Movements'],
  },
];

const PRESERVE_ITEMS = [
  'Admin accounts (Super Admin)',
  'RBAC roles, permissions & groups',
  'Product catalog (products, categories, collections, brands)',
  'Shipping methods',
  'Membership tier definitions (Gold, Platinum, Black)',
  'Membership benefit entitlements',
  'CMS pages, navigation, templates',
  'System settings & feature flags',
  'Background job configurations',
  'Integration connections',
];

export default function TestDataReset() {
  const [step, setStep] = useState<'initial' | 'confirm' | 'done'>('initial');
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [expandedDelete, setExpandedDelete] = useState(true);
  const [expandedPreserve, setExpandedPreserve] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');

  const isConfirmEnabled = checkboxChecked && confirmText === 'RESET';

  async function handleReset() {
    if (!isConfirmEnabled) return;
    setShowFinalConfirm(true);
  }

  async function executeReset() {
    setShowFinalConfirm(false);
    setSelectedReason('');
    setLoading(true);
    setStep('confirm');

    try {
      const res = await api.post(API.admin.testData.reset, { confirmText: 'RESET' });
      const data = res.data.data as ResetResult;
      setResult(data);
      setStep('done');
      toast.success('Test data reset complete');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset test data');
      setStep('initial');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done' && result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Complete</h1>
          </div>
          <p className="text-gray-500 ml-13">{result.message}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Deleted */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Trash2 size={16} className="text-red-400" />
              Deleted ({result.totalDeleted.toLocaleString()} documents)
            </h3>
            <div className="space-y-2">
              {Object.entries(result.deleted)
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-gray-600">{name}</span>
                    <span className="font-medium text-gray-900">{count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Preserved */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Shield size={16} className="text-green-400" />
              Preserved
            </h3>
            <div className="space-y-2">
              {Object.entries(result.preserved)
                .filter(([, count]) => count > 0)
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm">
                    <span className="text-gray-600">{name}</span>
                    <span className="font-medium text-gray-900">{count.toLocaleString()}</span>
                  </div>
                ))}
            </div>
            {result.demoDataRecreated && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Demo data re-seeded for John Smith (pets, tags, promo codes)
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            setStep('initial');
            setCheckboxChecked(false);
            setConfirmText('');
            setSelectedReason('');
            setResult(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RotateCcw size={16} /> Reset Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Database size={20} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Test Data</h1>
        </div>
        <p className="text-gray-500 ml-13">
          Delete all customer data, orders, transactions, and test records.
          Admin accounts and system configuration will be preserved.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-800">This action is irreversible</h3>
          <p className="text-sm text-red-700 mt-1">
            All customer data, orders, payments, subscriptions, and test records will be permanently deleted.
            Only admin accounts and system configuration will survive.
          </p>
        </div>
      </div>

      {/* What will be deleted */}
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedDelete(!expandedDelete)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-gray-700">What will be deleted</h3>
          </div>
          {expandedDelete ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>
        {expandedDelete && (
          <div className="px-6 pb-4 space-y-4">
            {DELETE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className="text-gray-400" />
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cat.label}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-6">
                    {cat.items.map((item) => (
                      <span key={item} className="inline-block px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* What will be preserved */}
      <div className="mb-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedPreserve(!expandedPreserve)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-green-400" />
            <h3 className="text-sm font-semibold text-gray-700">What will be preserved</h3>
          </div>
          {expandedPreserve ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>
        {expandedPreserve && (
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              {PRESERVE_ITEMS.map((item) => (
                <span key={item} className="inline-block px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Confirm Reset</h3>

        {/* Checkbox */}
        <label className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={checkboxChecked}
            onChange={(e) => setCheckboxChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-gray-700">
            I understand this will <strong>permanently delete all customer data</strong> and I cannot undo this action.
          </span>
        </label>

        {/* Text input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="font-mono font-bold text-red-600">RESET</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESET"
            className="w-full max-w-xs px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors font-mono"
          />
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          disabled={!isConfirmEnabled || loading}
          className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 active:bg-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <Trash2 size={16} />
              Reset All Test Data
            </>
          )}
        </button>
      </div>

      {/* Final Confirmation Dialog */}
      <ConfirmDialog
        open={showFinalConfirm}
        onClose={() => {
          setShowFinalConfirm(false);
          setSelectedReason('');
        }}
        onConfirm={executeReset}
        title="Permanently Delete All Test Data?"
        message="This action cannot be undone. All customer data will be permanently deleted."
        variant="danger"
        confirmLabel="Yes, Reset Everything"
        loading={loading}
        reasons={[
          'Testing a fresh deployment',
          'Cleaning up after development',
          'Preparing for demo/presentation',
          'Other',
        ]}
        selectedReason={selectedReason}
        onReasonChange={setSelectedReason}
        footnote={
          <div className="text-sm text-gray-500">
            Admin accounts, products, CMS content, and system settings will NOT be affected.
            John Smith's test account will be preserved but his data will be reset.
          </div>
        }
      >
        <p className="text-sm text-gray-600 mb-3">
          This will permanently delete:
        </p>
        <ul className="text-sm text-gray-600 space-y-1 mb-3">
          <li>• All customer accounts (except admin)</li>
          <li>• All pets, tags, and recovery records</li>
          <li>• All orders, invoices, and payment transactions</li>
          <li>• All subscriptions and memberships</li>
          <li>• All audit events and system logs</li>
          <li>• All notifications and support requests</li>
        </ul>
        <p className="text-sm text-red-600 font-medium">
          This action cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
