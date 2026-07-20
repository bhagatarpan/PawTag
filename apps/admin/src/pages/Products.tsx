import { useEffect, useState } from 'react';
import api, { PaginatedData } from '../lib/api';

interface ProductVariant {
  name: string;
  sku: string;
  price?: number;
  stock: number;
  image?: string;
  attributes: Record<string, string>;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  sku: string;
  category: string;
  stock: number;
  isActive: boolean;
  images: string[];
  variants: ProductVariant[];
  customizable: boolean;
  customizationPrice: number;
}

const emptyVariant = (): ProductVariant => ({ name: '', sku: '', price: undefined, stock: 0, attributes: {} });

export default function Products() {
  const [data, setData] = useState<PaginatedData<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', shortDescription: '', price: 0, category: '',
    stock: 0, sku: '', currency: 'NZD', isActive: true, customizable: false, customizationPrice: 0,
  });
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const fetchProducts = () => {
    setLoading(true);
    api.get('/admin/products', { params: { page, limit: 20, search } })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', shortDescription: '', price: 0, category: '', stock: 0, sku: '', currency: 'NZD', isActive: true, customizable: false, customizationPrice: 0 });
    setVariants([]);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '', shortDescription: p.shortDescription || '',
      price: p.price, category: p.category, stock: p.stock, sku: p.sku, currency: 'NZD',
      isActive: p.isActive, customizable: p.customizable || false, customizationPrice: p.customizationPrice || 0,
    });
    setVariants(p.variants?.map((v) => ({ ...v, attributes: { ...v.attributes } })) || []);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, variants };
    if (editing) {
      await api.put(`/admin/products/${editing._id}`, payload);
    } else {
      await api.post('/admin/products', payload);
    }
    setShowForm(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/admin/products/${id}`);
    fetchProducts();
  };

  const addVariant = () => setVariants([...variants, emptyVariant()]);
  const removeVariant = (i: number) => setVariants(variants.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: string, value: any) => {
    const next = [...variants];
    if (field.startsWith('attr.')) {
      const key = field.replace('attr.', '');
      next[i] = { ...next[i], attributes: { ...next[i].attributes, [key]: value } };
    } else {
      (next[i] as any)[field] = value;
    }
    setVariants(next);
  };

  const totalStock = variants.length > 0
    ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
    : form.stock;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Product Management</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total || 0} products total</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text" placeholder="Search products..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={openCreate} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700">
            + Add Product
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">{editing ? 'Edit Product' : 'New Product'}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              Active
            </label>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (NZD) *</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. Pet Tags, Accessories" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Stock</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={3} required />
              </div>
            </div>

            {/* Customization */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Customization</h3>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.customizable} onChange={(e) => setForm({ ...form, customizable: e.target.checked })} className="rounded" />
                  Allow pet name engraving
                </label>
                {form.customizable && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Extra cost:</label>
                    <input type="number" step="0.01" value={form.customizationPrice} onChange={(e) => setForm({ ...form, customizationPrice: parseFloat(e.target.value) || 0 })} className="w-24 border rounded-md px-3 py-2 text-sm" />
                    <span className="text-sm text-gray-500">NZD</span>
                  </div>
                )}
              </div>
            </div>

            {/* Variants */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Variants {variants.length > 0 && `(${variants.length})`}</h3>
                <button type="button" onClick={addVariant} className="text-primary-600 hover:text-primary-800 text-sm font-medium">+ Add Variant</button>
              </div>

              {variants.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-2">SKU</div>
                    <div className="col-span-2">Price Override</div>
                    <div className="col-span-1">Stock</div>
                    <div className="col-span-3">Attributes (key:value)</div>
                    <div className="col-span-1"></div>
                  </div>
                  {variants.map((v, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input value={v.name} onChange={(e) => updateVariant(i, 'name', e.target.value)} className="col-span-3 border rounded px-2 py-1.5 text-sm" placeholder="e.g. Red — Small" required />
                      <input value={v.sku} onChange={(e) => updateVariant(i, 'sku', e.target.value)} className="col-span-2 border rounded px-2 py-1.5 text-sm font-mono text-xs" placeholder="SKU" required />
                      <input type="number" step="0.01" value={v.price ?? ''} onChange={(e) => updateVariant(i, 'price', e.target.value ? parseFloat(e.target.value) : undefined)} className="col-span-2 border rounded px-2 py-1.5 text-sm" placeholder="Leave empty for base" />
                      <input type="number" value={v.stock} onChange={(e) => updateVariant(i, 'stock', parseInt(e.target.value) || 0)} className="col-span-1 border rounded px-2 py-1.5 text-sm" required />
                      <input
                        value={Object.entries(v.attributes).map(([k, val]) => `${k}:${val}`).join(', ')}
                        onChange={(e) => {
                          const attrs: Record<string, string> = {};
                          e.target.value.split(',').forEach((pair) => {
                            const [key, val] = pair.split(':').map((s) => s.trim());
                            if (key && val) attrs[key] = val;
                          });
                          updateVariant(i, 'attr', attrs);
                        }}
                        className="col-span-3 border rounded px-2 py-1.5 text-sm"
                        placeholder="color:Red, size:Small"
                      />
                      <button type="button" onClick={() => removeVariant(i)} className="col-span-1 text-red-500 hover:text-red-700 text-sm text-center">✕</button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-1">Total variant stock: <span className="font-semibold">{totalStock}</span></p>
                </div>
              )}
              {variants.length === 0 && (
                <p className="text-xs text-gray-400">No variants — product uses base price and stock only.</p>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-md text-sm hover:bg-primary-700">
                {editing ? 'Update Product' : 'Create Product'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">SKU</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Price</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Stock</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Variants</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">No products found</td></tr>
            ) : (
              data?.items.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.customizable && <span className="text-xs text-primary-600">Customizable</span>}
                  </td>
                  <td className="px-5 py-3 font-mono text-gray-600 text-xs">{p.sku}</td>
                  <td className="px-5 py-3">${p.price.toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-600">{p.category}</td>
                  <td className="px-5 py-3">
                    {p.variants?.length > 0 ? (
                      <span className="text-xs text-gray-500">{p.variants.reduce((s, v) => s + v.stock, 0)} total</span>
                    ) : p.stock}
                  </td>
                  <td className="px-5 py-3">
                    {p.variants?.length > 0 ? (
                      <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">{p.variants.length} variants</span>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex gap-2">
                    <button onClick={() => openEdit(p)} className="text-primary-600 hover:text-primary-800 text-xs">Edit</button>
                    <button onClick={() => deleteProduct(p._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {data.page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="text-xs border rounded px-3 py-1 disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(Math.min(data.totalPages, page + 1))} disabled={page >= data.totalPages} className="text-xs border rounded px-3 py-1 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
