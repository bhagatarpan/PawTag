import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Trash2, Check, X, Loader2, RefreshCw } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import PageHeader from '../components/PageHeader';

interface BenefitDef {
  key: string;
  name: string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  category: string;
  defaultValue: boolean | number | string | null;
  enabled: boolean;
  displayOrder: number;
}

interface TierValue {
  enabled: boolean;
  value: boolean | number | string | null;
}

interface Matrix {
  benefits: BenefitDef[];
  tiers: string[];
  values: Record<string, Record<string, TierValue>>;
}

const CATEGORY_ORDER = ['shipping', 'loyalty', 'notifications', 'exclusive', 'recovery', 'health', 'general'];
const CATEGORY_LABELS: Record<string, string> = {
  shipping: 'Shipping',
  loyalty: 'Loyalty',
  notifications: 'Notifications',
  exclusive: 'Exclusive',
  recovery: 'Recovery',
  health: 'Health',
  general: 'General',
};

function groupByCategory(benefits: BenefitDef[]): Record<string, BenefitDef[]> {
  const groups: Record<string, BenefitDef[]> = {};
  for (const b of benefits) {
    if (!groups[b.category]) groups[b.category] = [];
    groups[b.category].push(b);
  }
  return groups;
}

export default function MembershipEntitlements() {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBenefit, setNewBenefit] = useState({ key: '', name: '', description: '', type: 'boolean' as 'boolean' | 'number' | 'string', category: 'general', defaultValue: '' });
  const [editingCell, setEditingCell] = useState<{ tier: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const loadMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(API.admin.entitlements.matrix);
      setMatrix(res.data.data);
    } catch (err) {
      console.error('Failed to load entitlements matrix', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const toggleBoolean = async (tier: string, key: string, currentEnabled: boolean, currentValue: any) => {
    const cellId = `${tier}:${key}`;
    setSaving(cellId);
    try {
      await api.put(API.admin.entitlements.tierBenefit(tier, key), {
        enabled: true,
        value: !currentValue,
      });
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          values: {
            ...prev.values,
            [key]: {
              ...prev.values[key],
              [tier]: { enabled: true, value: !currentValue },
            },
          },
        };
      });
    } catch (err) {
      console.error('Failed to toggle benefit', err);
    } finally {
      setSaving(null);
    }
  };

  const startEditNumber = (tier: string, key: string, currentValue: any) => {
    setEditingCell({ tier, key });
    setEditValue(String(currentValue ?? ''));
  };

  const saveEditNumber = async () => {
    if (!editingCell) return;
    const { tier, key } = editingCell;
    const cellId = `${tier}:${key}`;
    setSaving(cellId);
    try {
      const numVal = parseFloat(editValue);
      const value = isNaN(numVal) ? 0 : numVal;
      await api.put(API.admin.entitlements.tierBenefit(tier, key), {
        enabled: true,
        value,
      });
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          values: {
            ...prev.values,
            [key]: {
              ...prev.values[key],
              [tier]: { enabled: true, value },
            },
          },
        };
      });
      setEditingCell(null);
    } catch (err) {
      console.error('Failed to save benefit value', err);
    } finally {
      setSaving(null);
    }
  };

  const addBenefit = async () => {
    if (!newBenefit.key || !newBenefit.name) return;
    try {
      let defaultVal: any = newBenefit.defaultValue;
      if (newBenefit.type === 'number') defaultVal = parseFloat(defaultVal) || 0;
      else if (newBenefit.type === 'boolean') defaultVal = defaultVal === 'true';

      await api.post(API.admin.entitlements.benefits, {
        ...newBenefit,
        defaultValue: defaultVal,
      });
      setShowAddModal(false);
      setNewBenefit({ key: '', name: '', description: '', type: 'boolean', category: 'general', defaultValue: '' });
      loadMatrix();
    } catch (err) {
      console.error('Failed to add benefit', err);
    }
  };

  const deleteBenefit = async (key: string) => {
    if (!confirm(`Delete benefit "${key}"? This will remove all tier values.`)) return;
    try {
      await api.delete(API.admin.entitlements.benefit(key));
      loadMatrix();
    } catch (err) {
      console.error('Failed to delete benefit', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!matrix) {
    return <div className="p-6 text-red-600">Failed to load entitlements.</div>;
  }

  const grouped = groupByCategory(matrix.benefits);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings size={20} className="text-primary-600" />}
        title="Membership Entitlements"
        subtitle="Configure benefits for each membership tier. Changes take effect immediately."
        actions={
          <div className="flex gap-2">
            <button onClick={loadMatrix} className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700">
              <Plus size={14} /> Add Benefit
            </button>
          </div>
        }
      />

      {/* Entitlements Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 w-[300px]">Benefit</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-[140px]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-yellow-400"></span> Gold
                  </span>
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-[140px]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-400"></span> Platinum
                  </span>
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-[140px]">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-gray-800"></span> Black
                  </span>
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-[80px]">Type</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700 w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const benefits = grouped[cat];
                if (!benefits || benefits.length === 0) return null;
                return (
                  <>
                    <tr key={`cat-${cat}`}>
                      <td colSpan={6} className="px-4 py-2 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {CATEGORY_LABELS[cat] || cat}
                      </td>
                    </tr>
                    {benefits.map((benefit) => {
                      const vals = matrix.values[benefit.key] || {};
                      return (
                        <tr key={benefit.key} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{benefit.name}</div>
                            {benefit.description && (
                              <div className="text-xs text-gray-400 mt-0.5">{benefit.description}</div>
                            )}
                          </td>
                          {matrix.tiers.map((tier) => {
                            const tv = vals[tier] || { enabled: false, value: null };
                            const cellId = `${tier}:${benefit.key}`;
                            const isSaving = saving === cellId;
                            const isEditing = editingCell?.tier === tier && editingCell?.key === benefit.key;

                            return (
                              <td key={tier} className="px-4 py-3 text-center">
                                {isSaving ? (
                                  <Loader2 className="w-4 h-4 text-primary-600 animate-spin mx-auto" />
                                ) : benefit.type === 'boolean' ? (
                                  <button
                                    onClick={() => toggleBoolean(tier, benefit.key, tv.enabled, tv.value)}
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                      tv.value
                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                    }`}
                                  >
                                    {tv.value ? <Check size={16} /> : <X size={16} />}
                                  </button>
                                ) : isEditing ? (
                                  <div className="flex items-center gap-1 justify-center">
                                    <input
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditNumber(); if (e.key === 'Escape') setEditingCell(null); }}
                                      className="w-20 px-2 py-1 text-center border rounded focus:ring-2 focus:ring-primary-500 text-sm"
                                      autoFocus
                                    />
                                    <button onClick={saveEditNumber} className="text-green-600 hover:text-green-700 p-0.5"><Check size={14} /></button>
                                    <button onClick={() => setEditingCell(null)} className="text-gray-400 hover:text-gray-600 p-0.5"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startEditNumber(tier, benefit.key, tv.value)}
                                    className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors min-w-[60px] inline-block"
                                  >
                                    {benefit.key === 'tag_limit' ? tv.value : benefit.key === 'free_shipping_threshold' ? (tv.value === 0 ? 'FREE' : `$${tv.value}`) : benefit.key === 'accessory_discount' ? `${tv.value}%` : String(tv.value ?? '—')}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">{benefit.type}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => deleteBenefit(benefit.key)} className="text-red-400 hover:text-red-600 p-1" title="Delete benefit">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Benefit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Benefit</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                <input
                  value={newBenefit.key}
                  onChange={(e) => setNewBenefit({ ...newBenefit, key: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. gps_tracking"
                />
                <p className="text-xs text-gray-400 mt-1">snake_case, no spaces. Used as identifier.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={newBenefit.name}
                  onChange={(e) => setNewBenefit({ ...newBenefit, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. GPS Tracking"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={newBenefit.description}
                  onChange={(e) => setNewBenefit({ ...newBenefit, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="What this benefit provides"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={newBenefit.type}
                    onChange={(e) => setNewBenefit({ ...newBenefit, type: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="boolean">Boolean (on/off)</option>
                    <option value="number">Number</option>
                    <option value="string">String</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={newBenefit.category}
                    onChange={(e) => setNewBenefit({ ...newBenefit, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    {CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
                <input
                  value={newBenefit.defaultValue}
                  onChange={(e) => setNewBenefit({ ...newBenefit, defaultValue: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder={newBenefit.type === 'boolean' ? 'true/false' : newBenefit.type === 'number' ? '0' : 'default text'}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={addBenefit}
                disabled={!newBenefit.key || !newBenefit.name}
                className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Add Benefit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
