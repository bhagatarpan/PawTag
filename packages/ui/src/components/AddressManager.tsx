import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Trash2, Star, Edit3, Check, Loader2, X } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { AddressComponents } from '../types';

export interface SavedAddress {
  _id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

interface AddressManagerProps {
  /** User ID to manage addresses for */
  userId: string;
  /** Show selection controls (for checkout) */
  showSelection?: boolean;
  /** Currently selected address ID */
  selectedAddressId?: string;
  /** Callback when address is selected */
  onSelect?: (address: SavedAddress) => void;
  /** Callback when addresses change */
  onChange?: () => void;
  /** Authenticated API client - parent must provide */
  apiClient: {
    get: (url: string) => Promise<{ data: any }>;
    post: (url: string, data?: any) => Promise<{ data: any }>;
    put: (url: string, data?: any) => Promise<{ data: any }>;
    delete: (url: string) => Promise<{ data: any }>;
  };
}

export function AddressManager({
  userId,
  showSelection = false,
  selectedAddressId,
  onSelect,
  onChange,
  apiClient,
}: AddressManagerProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for add/edit
  const [form, setForm] = useState({
    label: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
    country: 'NZ',
  });

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      // Pass userId as query param for admin callers managing another user's addresses
      const url = userId ? `/customer/addresses?userId=${userId}` : '/customer/addresses';
      const res = await apiClient.get(url);
      setAddresses(res.data?.data || []);
    } catch {
      setError('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  }, [apiClient, userId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleAddressSelect = (address: AddressComponents) => {
    setForm(prev => ({
      ...prev,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country || 'NZ',
    }));
  };

  const handleSave = async () => {
    try {
      const url = editingId
        ? `/customer/addresses/${editingId}`
        : '/customer/addresses';

      // Pass userId in body for admin callers managing another user's addresses
      const payload = userId ? { ...form, userId } : form;

      if (editingId) {
        await apiClient.put(url, payload);
      } else {
        await apiClient.post(url, payload);
      }

      setAdding(false);
      setEditingId(null);
      setForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NZ' });
      await fetchAddresses();
      onChange?.();
    } catch {
      setError('Failed to save address');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const url = userId ? `/customer/addresses/${id}?userId=${userId}` : `/customer/addresses/${id}`;
      await apiClient.delete(url);
      setDeleteConfirmId(null);
      await fetchAddresses();
      onChange?.();
    } catch {
      setError('Failed to delete address');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const url = userId
        ? `/customer/addresses/${id}/default`
        : `/customer/addresses/${id}/default`;
      const payload = userId ? { userId } : {};
      await apiClient.put(url, payload);
      await fetchAddresses();
      onChange?.();
    } catch {
      setError('Failed to set default');
    }
  };

  const handleEdit = (addr: SavedAddress) => {
    setEditingId(addr._id || null);
    setForm({
      label: addr.label,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country || 'NZ',
    });
    setAdding(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading addresses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {/* Address List */}
      {addresses.length > 0 && (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div
              key={addr._id}
              className={`p-4 rounded-xl border transition-all ${
                showSelection && selectedAddressId === addr._id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                        <Star size={10} /> Preferred
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                  </p>
                  <p className="text-sm text-gray-600">{addr.city} {addr.zip}</p>
                </div>

                <div className="flex items-center gap-2">
                  {showSelection && (
                    <input
                      type="radio"
                      name="address-selection"
                      checked={selectedAddressId === addr._id}
                      onChange={() => onSelect?.(addr)}
                      className="w-4 h-4 text-primary-600"
                    />
                  )}
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(addr._id!)}
                      className="text-gray-400 hover:text-primary-600 p-1"
                      title="Set as preferred"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(addr)}
                    className="text-gray-400 hover:text-primary-600 p-1"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(addr._id || null)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteConfirmId === addr._id && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700 mb-2">Delete this address?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(addr._id!)}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addresses.length === 0 && !adding && (
        <div className="text-center py-6">
          <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-3">No saved addresses yet</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {adding ? (
        <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingId ? 'Edit Address' : 'Add New Address'}
            </h3>
            <button
              onClick={() => { setAdding(false); setEditingId(null); setForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NZ' }); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., Home, Office"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
            <AddressAutocomplete
              value={form.line1}
              onChange={(val: string) => setForm(prev => ({ ...prev, line1: val }))}
              onAddressSelect={handleAddressSelect}
              placeholder="123 Main Street"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
            <input
              type="text"
              value={form.line2}
              onChange={(e) => setForm(prev => ({ ...prev, line2: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => setForm(prev => ({ ...prev, zip: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.label || !form.line1 || !form.city || !form.zip}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={14} className="inline mr-1" />
              {editingId ? 'Update' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setEditingId(null); setForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'NZ' }); }}
              className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : addresses.length < 5 ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          <Plus size={16} />
          Add New Address
        </button>
      ) : (
        <p className="text-xs text-gray-500 text-center">Maximum 5 addresses reached</p>
      )}
    </div>
  );
}
