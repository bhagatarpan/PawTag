import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Shield, Diamond, Edit, Save, X, ExternalLink } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface MembershipTier {
  _id: string;
  tier: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
  tagLimit: number;
  icon?: string;
  color?: string;
  gradient?: string;
  entitlements?: Record<string, { enabled: boolean; value: any; name?: string }>;
}

const TIER_ICONS: Record<string, typeof Crown> = {
  gold: Crown,
  platinum: Diamond,
  black: Shield,
};

export default function MembershipTiers() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MembershipTier | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTier, setNewTier] = useState({ tier: '', name: '', displayName: '', description: '', price: 0, tagLimit: 3 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, []);

  async function fetchTiers() {
    try {
      const res = await api.get(API.admin.membership.tiers);
      const tiersData = res.data.data || [];
      
      // Fetch entitlements for each tier
      const tiersWithEntitlements = await Promise.all(tiersData.map(async (tier: MembershipTier) => {
        try {
          const entRes = await api.get(API.admin.entitlements.tier(tier.tier));
          return { ...tier, entitlements: entRes.data.data };
        } catch {
          return tier;
        }
      }));
      
      setTiers(tiersWithEntitlements);
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

  async function handleAdd() {
    if (!newTier.tier || !newTier.name || !newTier.displayName || !newTier.description || newTier.price <= 0) {
      alert('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      await api.post(API.admin.membership.tiers, newTier);
      setAdding(false);
      setNewTier({ tier: '', name: '', displayName: '', description: '', price: 0, tagLimit: 3 });
      await fetchTiers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create tier');
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
          <p className="text-sm text-gray-500">Configure tier pricing and availability. Manage benefits in the Entitlements page.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + Add Tier
        </button>
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
                <p className="text-xs text-gray-500 mb-2">Tag Limit: {tier.tagLimit || 'Not set'}</p>
                
                {/* READ-ONLY benefit summary from entitlements */}
                {tier.entitlements && (
                  <div className="space-y-1.5 mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Configured Benefits</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(tier.entitlements)
                        .filter(([_, ent]) => ent.enabled)
                        .slice(0, 6)
                        .map(([key, entitlement]) => (
                          <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">
                            {entitlement.name || key}
                          </span>
                        ))}
                      {Object.entries(tier.entitlements).filter(([_, ent]) => ent.enabled).length > 6 && (
                        <span className="text-xs text-gray-400">
                          +{Object.entries(tier.entitlements).filter(([_, ent]) => ent.enabled).length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(tier)}
                    className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    <Edit className="inline h-4 w-4 mr-1" /> Edit Tier
                  </button>
                  <Link
                    to="/membership/entitlements"
                    className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink size={14} /> Benefits
                  </Link>
                </div>
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

      {/* Add Tier Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Add New Tier</h2>
              <button onClick={() => setAdding(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier Identifier *</label>
                <input
                  value={newTier.tier}
                  onChange={(e) => setNewTier({ ...newTier, tier: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                  placeholder="e.g., diamond"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Lowercase, no spaces. Used internally.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name *</label>
                <input
                  value={newTier.name}
                  onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                  placeholder="e.g., Diamond Membership"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                <input
                  value={newTier.displayName}
                  onChange={(e) => setNewTier({ ...newTier, displayName: e.target.value })}
                  placeholder="e.g., Diamond"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={newTier.description}
                  onChange={(e) => setNewTier({ ...newTier, description: e.target.value })}
                  placeholder="Marketing description for this tier"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (NZD/year) *</label>
                  <input
                    type="number"
                    value={newTier.price || ''}
                    onChange={(e) => setNewTier({ ...newTier, price: Number(e.target.value) })}
                    placeholder="299"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tag Limit *</label>
                  <input
                    type="number"
                    value={newTier.tagLimit || ''}
                    onChange={(e) => setNewTier({ ...newTier, tagLimit: Number(e.target.value) })}
                    placeholder="999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                <p className="text-sm text-primary-700">
                  After creating the tier, configure its benefits in the <strong>Entitlements</strong> page.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setAdding(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Tier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
