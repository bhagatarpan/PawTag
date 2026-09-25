import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Shield, Diamond, Edit, Save, X } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface MembershipTier {
  _id: string;
  tier: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  benefits: Record<string, boolean | number>;
  isActive: boolean;
  displayOrder: number;
}

const TIER_ICONS: Record<string, typeof Crown> = {
  gold: Crown,
  platinum: Diamond,
  black: Shield,
};

const BENEFIT_LABELS: Record<string, string> = {
  medicalAlert: 'Medical Alert to Finder',
  petHealthRecords: 'Pet Health Records',
  emailNotifications: 'Email Notifications',
  inAppNotifications: 'In-App Notifications',
  criticalEmergencyContact: 'Critical Emergency Contact',
  emergencyPersonEmail: 'Emergency Person Email',
  emergencyPersonInApp: 'Emergency Person In-App',
  petRecovery: 'Pet Recovery via PawTag',
  blackFridayDeal: 'Exclusive Black Friday Deal',
};

export default function MembershipTiers() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MembershipTier | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    try {
      const res = await api.get(API.admin.membership.tiers);
      setTiers(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch tiers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(API.admin.membership.tier(editing._id), editing);
      setEditing(null);
      await fetchTiers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save tier');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membership Tiers</h1>
          <p className="text-sm text-gray-500">Configure tier pricing, benefits, and availability</p>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {tiers.map((tier) => {
          const Icon = TIER_ICONS[tier.tier] || Crown;
          return (
            <div key={tier._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className={`bg-gradient-to-br ${tier.tier === 'gold' ? 'from-yellow-400 to-amber-500' : tier.tier === 'platinum' ? 'from-gray-300 to-gray-500' : 'from-gray-800 to-black'} p-6 text-white`}>
                <div className="flex items-center justify-between">
                  <Icon className="h-8 w-8" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tier.isActive ? 'bg-green-500/20 text-green-100' : 'bg-red-500/20 text-red-100'}`}>
                    {tier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-xl font-bold mt-3">{tier.displayName}</h3>
                <div className="text-3xl font-bold mt-1">${tier.price}<span className="text-sm font-normal">/yr</span></div>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">{tier.description}</p>
                <div className="space-y-2 mb-4">
                  {Object.entries(tier.benefits).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className={value ? 'text-green-500' : 'text-gray-300'}>{value ? '✓' : '—'}</span>
                      <span className="text-gray-600">{BENEFIT_LABELS[key] || key}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setEditing(tier)}
                  className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  <Edit className="inline h-4 w-4 mr-1" /> Edit Tier
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Edit {editing.displayName}</h2>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  value={editing.displayName}
                  onChange={(e) => setEditing({ ...editing, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (NZD/year)</label>
                <input
                  type="number"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded"
                />
                <label className="text-sm text-gray-700">Active (available for purchase)</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
