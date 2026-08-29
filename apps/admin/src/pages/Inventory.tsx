/**
 * @module Inventory Page
 * @description Admin page for managing product inventory.
 *
 * Provides a comprehensive inventory management interface:
 * - View stock levels for all products
 * - Adjust stock levels manually
 * - View stock movement history per product
 * - Low stock alerts
 *
 * All data is fetched from the PawTag Commerce API.
 *
 * @example
 * ```tsx
 * // Route: /inventory
 * // Requires: inventory.read, inventory.adjust permissions
 * <Inventory />
 * ```
 */

import { useEffect, useState, useCallback } from 'react';
import { Search, Loader2, Package, AlertTriangle, Plus, Minus, History, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import { toast } from '../lib/toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Product {
  _id: string;
  name: string;
  sku: string;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  stockPolicy: 'deny' | 'allow';
  isActive: boolean;
}

interface InventoryStatus {
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  stockPolicy: string;
}

interface StockMovement {
  productId: string;
  type: string;
  quantity: number;
  stockAfter: number;
  referenceId?: string;
  reason: string;
  actor: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStockStatus(product: Product): { label: string; color: string } {
  const available = product.stock - product.reserved;
  if (available <= 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700' };
  if (available <= product.lowStockThreshold) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700' };
  return { label: 'In Stock', color: 'bg-green-100 text-green-700' };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [adjustModal, setAdjustModal] = useState<{ productId: string; productName: string } | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { limit: 100 };
      if (search) params.search = search;

      const res = await api.get('/admin/commerce/products', { params });
      const data = res.data?.data;
      setProducts(data?.items || []);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const loadMovements = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    setMovementsLoading(true);
    try {
      const res = await api.get(`/admin/commerce/inventory/${productId}/movements`);
      setMovements(res.data?.data || []);
    } catch {
      toast.error('Failed to load stock movements');
    } finally {
      setMovementsLoading(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustModal || !adjustReason) return;
    setAdjusting(true);
    try {
      await api.post(`/admin/commerce/inventory/${adjustModal.productId}/adjust`, {
        quantity: adjustQuantity,
        reason: adjustReason,
      });
      toast.success(`Stock adjusted by ${adjustQuantity > 0 ? '+' : ''}${adjustQuantity}`);
      setAdjustModal(null);
      setAdjustQuantity(0);
      setAdjustReason('');
      fetchProducts();
    } catch {
      toast.error('Failed to adjust stock');
    } finally {
      setAdjusting(false);
    }
  };

  const lowStockCount = products.filter((p) => {
    const available = p.stock - p.reserved;
    return available <= p.lowStockThreshold && available > 0;
  }).length;

  const outOfStockCount = products.filter((p) => (p.stock - p.reserved) <= 0).length;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} products tracked</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><Package size={20} className="text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">In Stock</p>
              <p className="text-xl font-bold text-gray-900">{products.length - lowStockCount - outOfStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg"><AlertTriangle size={20} className="text-yellow-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-xl font-bold text-gray-900">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><Package size={20} className="text-red-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Out of Stock</p>
              <p className="text-xl font-bold text-gray-900">{outOfStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by product name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Product List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-teal-500" size={24} /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Package size={32} className="mb-2" /><p>No products found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {products.map((product) => {
              const available = product.stock - product.reserved;
              const status = getStockStatus(product);
              const isExpanded = expandedProduct === product._id;

              return (
                <div key={product._id}>
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{available} <span className="text-gray-400 font-normal">available</span></p>
                        {product.reserved > 0 && (
                          <p className="text-xs text-gray-400">{product.reserved} reserved</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>{status.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAdjustModal({ productId: product._id, productName: product.name })}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Adjust stock"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => loadMovements(product._id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View history"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <History size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Movements */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                      {movementsLoading ? (
                        <Loader2 className="animate-spin text-teal-500" size={16} />
                      ) : movements.length === 0 ? (
                        <p className="text-sm text-gray-400">No stock movements recorded</p>
                      ) : (
                        <div className="space-y-2">
                          {movements.map((m, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium text-gray-700">{m.type}</span>
                                <span className="text-gray-400 mx-2">-</span>
                                <span className="text-gray-500">{m.reason}</span>
                                {m.actor && <span className="text-gray-400 ml-2">by {m.actor}</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                                </span>
                                <span className="text-gray-400">→ {m.stockAfter}</span>
                                <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAdjustModal(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Adjust Stock: {adjustModal.productName}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Change</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAdjustQuantity(Math.max(-100, adjustQuantity - 1))} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><Minus size={16} /></button>
                  <input
                    type="number"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                    className="w-24 text-center px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={() => setAdjustQuantity(adjustQuantity + 1)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><Plus size={16} /></button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Positive = add stock, Negative = remove stock</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Stock count correction, Damaged goods"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAdjustModal(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button
                  onClick={handleAdjust}
                  disabled={adjusting || adjustQuantity === 0 || !adjustReason}
                  className="px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {adjusting ? <Loader2 className="animate-spin" size={16} /> : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
