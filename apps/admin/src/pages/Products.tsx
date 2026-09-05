import { useEffect, useState, useCallback, useRef } from 'react';
import { ImagePlus, X, Upload, Loader2, Search, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Download, Trash2, Edit2, Save, Settings, AlertTriangle, RotateCcw, Database, FileText, Package, Activity, CheckCircle, AlertCircle, Info, Copy, Eye, Plus } from 'lucide-react';
import { IconPicker, ICON_MAP, type IconPickerProps } from '@pawtag/ui';
import { Check } from 'lucide-react';
import api, { PaginatedData } from '../lib/api';
import { toast } from '../lib/toast';
import RichTextEditor from '../components/RichTextEditor';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
   createdAt: string;
   slug?: string;
   featureHighlights?: IFeatureHighlight[];
 }

 interface IFeatureHighlight {
   icon: string;
   description: string;
 }

 const DEFAULT_FEATURE_HIGHLIGHTS: IFeatureHighlight[] = [
   { icon: 'Check', description: 'Eligible for Free Shipping NZ Wide' },
 ];

interface SummaryData {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copied to clipboard'),
    () => toast.error('Failed to copy'),
  );
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'stock', label: 'Stock' },
  { value: 'sku', label: 'SKU' },
];

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="w-10 h-10 rounded bg-gray-200" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-3 hidden lg:table-cell"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Drawer                                                      */
/* ------------------------------------------------------------------ */

function DetailDrawer({
  product,
  onClose,
  onRefresh,
  onEdit,
}: {
  product: Product | null;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: (product: Product) => void;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'variants' | 'images'>('info');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!product) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [product, onClose]);

  useEffect(() => {
    if (product) setActiveTab('info');
  }, [product]);

  if (!product) return null;

  const handleToggleActive = async () => {
    setActionLoading('toggle');
    try {
      await api.put(`/admin/products/${product._id}`, { isActive: !product.isActive });
      toast.success(product.isActive ? 'Product deactivated' : 'Product activated');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete product "${product.name}"? This cannot be undone.`)) return;
    setActionLoading('delete');
    try {
      await api.delete(`/admin/products/${product._id}`);
      toast.success('Product deleted');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const totalStock = product.variants?.length > 0
    ? product.variants.reduce((s, v) => s + (v.stock || 0), 0)
    : product.stock;

  const tabs = [
    { key: 'info' as const, label: 'Product Info' },
    ...(product.variants?.length > 0 ? [{ key: 'variants' as const, label: `Variants (${product.variants.length})` }] : []),
    ...(product.images?.length > 0 ? [{ key: 'images' as const, label: `Images (${product.images.length})` }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Product details: ${product.name}`}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div ref={drawerRef} className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover border" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Package size={20} className="text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h2>
              <p className="text-sm text-gray-500 font-mono">{product.sku}</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${product.isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
              {product.isActive ? <CheckCircle size={13} /> : <Info size={13} />}
              {product.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <Section title="Product Details" icon={<Package size={16} />}>
<DetailRow label="Name" value={product.name} />
                 <DetailRow label="SKU" value={
                   <span className="flex items-center gap-2">
                     <span className="font-mono text-xs">{product.sku}</span>
                     <button onClick={() => copyToClipboard(product.sku)} className="text-gray-400 hover:text-gray-600"><Copy size={12} /></button>
                   </span>
                 } />
                 <DetailRow label="Slug" value={product.slug} />
                 <DetailRow label="Price" value={`$${product.price.toFixed(2)} NZD`} />
                 {product.featureHighlights && product.featureHighlights.length > 0 && (
                   <DetailRow label="Features" value={
                     <div className="space-y-1">
                       {product.featureHighlights.map((fh, i) => {
                         const IconComp = ICON_MAP[fh.icon] || Check;
                         return (
                           <div key={i} className="flex items-center gap-2 text-sm">
                             <IconComp size={14} className="text-primary-600 shrink-0" />
                             <span>{fh.description}</span>
                           </div>
                         );
                       })}
                     </div>
                   } />
                 )}
                 <DetailRow label="Category" value={product.category} />
                <DetailRow label="Total Stock" value={
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    totalStock === 0 ? 'bg-red-100 text-red-700' :
                    totalStock <= 10 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {totalStock}
                  </span>
                } />
                {product.shortDescription && <DetailRow label="Short Desc" value={product.shortDescription} />}
                <DetailRow label="Created" value={formatDate(product.createdAt)} />
              </Section>

              {product.description && (
                <Section title="Description" icon={<FileText size={16} />}>
                  <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: product.description }} />
                </Section>
              )}

              <Section title="Customization" icon={<Settings size={16} />}>
                <DetailRow label="Engraving" value={product.customizable ? 'Allowed' : 'Not allowed'} />
                {product.customizable && <DetailRow label="Extra Cost" value={`$${(product.customizationPrice || 0).toFixed(2)} NZD`} />}
              </Section>

              <Section title="Quick Actions" icon={<Activity size={16} />}>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onEdit(product)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg">
                    <Edit2 size={12} /> Edit
                  </button>
                  <button onClick={handleToggleActive} disabled={actionLoading === 'toggle'} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                    {actionLoading === 'toggle' && <Loader2 size={12} className="animate-spin" />}
                    {product.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={handleDelete} disabled={actionLoading === 'delete'} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg disabled:opacity-50">
                    {actionLoading === 'delete' && <Loader2 size={12} className="animate-spin" />}
                    Delete
                  </button>
                </div>
              </Section>
            </div>
          )}

          {activeTab === 'variants' && product.variants?.length > 0 && (
            <Section title={`Variants (${product.variants.length})`} icon={<SlidersHorizontal size={16} />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-3 font-medium text-gray-500 text-xs">Name</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">SKU</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Price</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Stock</th>
                      <th className="text-left py-2 pl-3 font-medium text-gray-500 text-xs">Attributes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {product.variants.map((v, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 font-medium text-gray-700">{v.name}</td>
                        <td className="py-2 px-3 font-mono text-xs text-gray-500">{v.sku}</td>
                        <td className="py-2 px-3">{v.price != null ? `$${v.price.toFixed(2)}` : '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${v.stock === 0 ? 'bg-red-100 text-red-700' : v.stock <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {v.stock}
                          </span>
                        </td>
                        <td className="py-2 pl-3 text-xs text-gray-500">
                          {Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">Total variant stock: <span className="font-semibold">{totalStock}</span></p>
            </Section>
          )}

          {activeTab === 'images' && product.images?.length > 0 && (
            <Section title={`Images (${product.images.length})`} icon={<ImagePlus size={16} />}>
              <div className="grid grid-cols-3 gap-3">
                {product.images.map((img, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border aspect-square">
                    <img src={img} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute top-1 left-1 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded">Main</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small reusable components for the drawer                           */
/* ------------------------------------------------------------------ */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 text-sm">
      <span className="text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-gray-700 min-w-0">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Products() {
  // Data state
  const [data, setData] = useState<PaginatedData<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Summary
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // UI state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
const [form, setForm] = useState({
     name: '', description: '', shortDescription: '', price: 0, category: 'PawTag',
     stock: 0, sku: '', currency: 'NZD', isActive: true, customizable: false, customizationPrice: 0,
     featureHighlights: DEFAULT_FEATURE_HIGHLIGHTS as IFeatureHighlight[],
     slug: '',
   });
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/admin/products', { params: { limit: 10000 } });
      const items = res.data.data.items || [];
      const total = res.data.data.total || 0;
      const active = items.filter((p: Product) => p.isActive).length;
      const lowStock = items.filter((p: Product) => {
        const ts = p.variants?.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
        return ts > 0 && ts <= 10;
      }).length;
      const outOfStock = items.filter((p: Product) => {
        const ts = p.variants?.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
        return ts === 0;
      }).length;
      const totalValue = items.reduce((sum: number, p: Product) => {
        const ts = p.variants?.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
        return sum + (p.price * ts);
      }, 0);
      setSummary({ total, active, lowStock, outOfStock, totalValue });
    } catch {
      // Non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: pageSize, sortBy, sortDir };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category) params.category = category;
      if (isActive) params.isActive = isActive;
      if (stockStatus) params.stockStatus = stockStatus;
      const res = await api.get('/admin/products', { params });
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, category, isActive, stockStatus, sortBy, sortDir]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Form handlers
const openCreate = () => {
     setEditing(null);
     setForm({ name: '', description: '', shortDescription: '', price: 0, category: 'PawTag', stock: 0, sku: '', currency: 'NZD', isActive: true, customizable: false, customizationPrice: 0, featureHighlights: [...DEFAULT_FEATURE_HIGHLIGHTS], slug: '' });
    setVariants([]);
    setImages([]);
    setShowForm(true);
  };

const openEdit = (p: Product) => {
     setEditing(p);
     setForm({
       name: p.name, description: p.description || '', shortDescription: p.shortDescription || '',
       price: p.price, category: p.category, stock: p.stock, sku: p.sku, currency: 'NZD',
       isActive: p.isActive, customizable: p.customizable || false, customizationPrice: p.customizationPrice || 0,
       featureHighlights: p.featureHighlights && p.featureHighlights.length > 0 ? [...p.featureHighlights] : [...DEFAULT_FEATURE_HIGHLIGHTS],
       slug: p.slug || '',
     });
     setVariants(p.variants?.map((v) => ({ ...v, attributes: { ...v.attributes } })) || []);
     setImages(p.images || []);
     setShowForm(true);
   };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSaving(true);
    try {
      const payload = { ...form, category: 'PawTag', variants, images };
      if (editing) {
        await api.put(`/admin/products/${editing._id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/admin/products', payload);
        toast.success('Product created');
      }
      setShowForm(false);
      fetchProducts();
      fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally {
      setFormSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('images', file));
      const res = await api.post('/upload/product-images', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploaded = res.data.data.images.map((img: { url: string }) => img.url);
      setImages((prev) => [...prev, ...uploaded]);
      toast.success('Images uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageDelete = async (imageUrl: string) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      const filename = imageUrl.split('/').pop();
      if (filename) await api.delete(`/upload/product-images/${filename}`);
      setImages((prev) => prev.filter((url) => url !== imageUrl));
      toast.success('Image deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete image');
    }
  };

  const addVariant = () => setVariants([...variants, { name: '', sku: '', price: undefined, stock: 0, attributes: {} }]);
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

  const addFeatureHighlight = () => {
    setForm({ ...form, featureHighlights: [...form.featureHighlights, { icon: 'check', description: '' }] });
  };
  const removeFeatureHighlight = (i: number) => {
    setForm({ ...form, featureHighlights: form.featureHighlights.filter((_, idx) => idx !== i) });
  };
  const updateFeatureHighlight = (i: number, field: 'icon' | 'description', value: string) => {
    const next = [...form.featureHighlights];
    next[i] = { ...next[i], [field]: value };
    setForm({ ...form, featureHighlights: next });
  };

  // Export
  const handleExport = async (format: 'csv' | 'json') => {
    setExportLoading(true);
    setShowExportMenu(false);
    try {
      const params: Record<string, unknown> = { format, limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (category) params.category = category;
      if (isActive) params.isActive = isActive;
      if (stockStatus) params.stockStatus = stockStatus;
      const res = await api.get('/admin/products', { params });
      const items = res.data.data.items || [];
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `products-${new Date().toISOString().slice(0, 10)}.json`; a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const headers = ['Name', 'SKU', 'Price', 'Stock', 'Variants', 'Active', 'Customizable', 'Created'];
        const rows = items.map((p: Product) => [
          p.name, p.sku, `$${p.price.toFixed(2)}`,
          String(p.variants?.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock),
          String(p.variants?.length || 0), p.isActive ? 'Yes' : 'No', p.customizable ? 'Yes' : 'No', formatDate(p.createdAt),
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        window.URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${items.length} products`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  // Filter helpers
  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (debouncedSearch) activeFilters.push({ key: 'search', label: `Search: "${debouncedSearch}"`, clear: () => { setSearch(''); setDebouncedSearch(''); } });
  if (category) activeFilters.push({ key: 'category', label: `Category: ${category}`, clear: () => setCategory('') });
  if (isActive) activeFilters.push({ key: 'isActive', label: `Status: ${isActive === 'true' ? 'Active' : 'Inactive'}`, clear: () => setIsActive('') });
  if (stockStatus) activeFilters.push({ key: 'stock', label: `Stock: ${stockStatus === 'in' ? 'In Stock' : stockStatus === 'low' ? 'Low' : 'Out'}`, clear: () => setStockStatus('') });

  const clearAllFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setCategory(''); setIsActive(''); setStockStatus('');
    setSortBy('createdAt'); setSortDir('desc');
    setPage(1);
  };

  const startIdx = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIdx = data ? Math.min(page * pageSize, data.total) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
              <p className="mt-1 text-sm text-gray-500">Manage products, variants, inventory, and pricing.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
                <Package size={15} /> Add Product
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {exportLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  Export
                  <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"><FileText size={14} /> Export CSV</button>
                      <button onClick={() => handleExport('json')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"><Database size={14} /> Export JSON</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <SummaryCard label="Total Products" value={summary.total} icon={<Package size={20} />} loading={summaryLoading} />
            <SummaryCard label="Active" value={summary.active} icon={<CheckCircle size={20} />} color="emerald" loading={summaryLoading} onClick={() => { setIsActive(isActive === 'true' ? '' : 'true'); setPage(1); }} active={isActive === 'true'} />
            <SummaryCard label="Low Stock" value={summary.lowStock} icon={<AlertCircle size={20} />} color="amber" loading={summaryLoading} onClick={() => { setStockStatus(stockStatus === 'low' ? '' : 'low'); setPage(1); }} active={stockStatus === 'low'} />
            <SummaryCard label="Out of Stock" value={summary.outOfStock} icon={<AlertCircle size={20} />} color="red" loading={summaryLoading} onClick={() => { setStockStatus(stockStatus === 'out' ? '' : 'out'); setPage(1); }} active={stockStatus === 'out'} />
            <SummaryCard label="Inventory Value" value={summary.totalValue} icon={<span className="text-xl">$</span>} color="primary" loading={summaryLoading} isCurrency />
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {search && (
              <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Categories</option>
            <option value="PawTag">PawTag</option>
          </select>
          <select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select value={stockStatus} onChange={(e) => { setStockStatus(e.target.value); setPage(1); }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Stock</option>
            <option value="in">In Stock (&gt;10)</option>
            <option value="low">Low Stock (1-10)</option>
            <option value="out">Out of Stock</option>
          </select>
          <div className="flex items-center gap-1">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className="border border-gray-300 rounded-lg px-2 py-2 text-sm hover:bg-gray-50" title={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
              <SlidersHorizontal className={`h-4 w-4 text-gray-500 transition-transform ${sortDir === 'asc' ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
                {f.label}
                <button onClick={f.clear} className="hover:bg-primary-200 rounded-full p-0.5 transition-colors"><X size={12} /></button>
              </span>
            ))}
            <button onClick={clearAllFilters} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">Clear All</button>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Product' : 'New Product'}</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                Active
              </label>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm font-mono" placeholder="e.g. PT-SCAN-001" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Slug (SEO-friendly URL)</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="e.g. pawtag-scan" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Base Price (NZD) *</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" required /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Base Stock</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
        <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label><input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Feature Highlights</label>
          <p className="text-xs text-gray-400 mb-2">Displayed on shop and product detail pages. Add as many as you like.</p>
          <div className="space-y-2">
            {form.featureHighlights.map((fh, i) => (
              <div key={i} className="flex items-center gap-2">
                <IconPicker
                  value={fh.icon}
                  onChange={(icon) => updateFeatureHighlight(i, 'icon', icon)}
                  className="w-40"
                />
                <input
                  value={fh.description}
                  onChange={(e) => updateFeatureHighlight(i, 'description', e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. Eligible for Free Shipping NZ Wide"
                />
                <button type="button" onClick={() => removeFeatureHighlight(i)} className="text-red-500 hover:text-red-700 p-1">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addFeatureHighlight} className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 font-medium">
            <Plus size={14} /> Add Feature
          </button>
        </div>
        <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description *</label><RichTextEditor value={form.description} onChange={(val) => setForm({ ...form, description: val })} placeholder="Describe your product..." minHeight="120px" /></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Images</h3>
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative group w-24 h-24 rounded-lg overflow-hidden border">
                      <img src={img} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => handleImageDelete(img)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || images.length >= 5} className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ImagePlus className="h-5 w-5 mb-1" /><span className="text-[10px]">Add Image</span></>}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                <p className="text-xs text-gray-400 mt-2">Up to 5 images. Max 5MB each.</p>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Customization</h3>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.customizable} onChange={(e) => setForm({ ...form, customizable: e.target.checked })} className="rounded" /> Allow pet name engraving</label>
                  {form.customizable && <div className="flex items-center gap-2"><label className="text-sm text-gray-600">Extra cost:</label><input type="number" step="0.01" value={form.customizationPrice} onChange={(e) => setForm({ ...form, customizationPrice: parseFloat(e.target.value) || 0 })} className="w-24 border rounded-md px-3 py-2 text-sm" /><span className="text-sm text-gray-500">NZD</span></div>}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Variants {variants.length > 0 && `(${variants.length})`}</h3>
                  <button type="button" onClick={addVariant} className="text-primary-600 hover:text-primary-800 text-sm font-medium">+ Add Variant</button>
                </div>
                {variants.length > 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
                      <div className="col-span-3">Name</div><div className="col-span-2">SKU</div><div className="col-span-2">Price</div><div className="col-span-1">Stock</div><div className="col-span-3">Attributes</div><div className="col-span-1"></div>
                    </div>
                    {variants.map((v, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <input value={v.name} onChange={(e) => updateVariant(i, 'name', e.target.value)} className="col-span-3 border rounded px-2 py-1.5 text-sm" placeholder="e.g. Red — Small" required />
                        <input value={v.sku} onChange={(e) => updateVariant(i, 'sku', e.target.value)} className="col-span-2 border rounded px-2 py-1.5 text-sm font-mono text-xs" placeholder="SKU" required />
                        <input type="number" step="0.01" value={v.price ?? ''} onChange={(e) => updateVariant(i, 'price', e.target.value ? parseFloat(e.target.value) : undefined)} className="col-span-2 border rounded px-2 py-1.5 text-sm" placeholder="Base" />
                        <input type="number" value={v.stock} onChange={(e) => updateVariant(i, 'stock', parseInt(e.target.value) || 0)} className="col-span-1 border rounded px-2 py-1.5 text-sm" required />
                        <input value={Object.entries(v.attributes).map(([k, val]) => `${k}:${val}`).join(', ')} onChange={(e) => { const attrs: Record<string, string> = {}; e.target.value.split(',').forEach((pair) => { const [key, val] = pair.split(':').map((s) => s.trim()); if (key && val) attrs[key] = val; }); updateVariant(i, 'attr', attrs); }} className="col-span-3 border rounded px-2 py-1.5 text-sm" placeholder="color:Red, size:Small" />
                        <button type="button" onClick={() => removeVariant(i)} className="col-span-1 text-red-500 hover:text-red-700 text-sm text-center">✕</button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 mt-1">Total variant stock: <span className="font-semibold">{variants.reduce((s, v) => s + (v.stock || 0), 0)}</span></p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button type="submit" disabled={formSaving} className="bg-primary-600 text-white px-6 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center gap-1 disabled:opacity-50">
                  {formSaving && <Loader2 size={14} className="animate-spin" />} {editing ? 'Update Product' : 'Create Product'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-md text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-10">Image</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle size={32} className="text-red-400" />
                      <p className="text-sm text-red-600">{error}</p>
                      <button onClick={fetchProducts} className="text-sm text-primary-600 hover:underline flex items-center gap-1"><RotateCcw size={14} /> Try Again</button>
                    </div>
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Package size={32} className="text-gray-300" />
                      <p className="text-sm text-gray-500">No products found</p>
                      {activeFilters.length > 0 && <button onClick={clearAllFilters} className="text-sm text-primary-600 hover:underline">Clear Filters</button>}
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items.map((p) => {
                  const totalStock = p.variants?.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
                  return (
                    <tr key={p._id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedProduct(p)}>
                      <td className="px-4 py-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Package className="h-4 w-4 text-gray-400" /></div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{p.name}</div>
                        {p.customizable && <span className="text-xs text-primary-600">Customizable</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-gray-600 text-xs">{p.sku}</td>
                      <td className="px-4 py-3 font-medium">${p.price.toFixed(2)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${totalStock === 0 ? 'bg-red-100 text-red-700' : totalStock <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {totalStock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
            <span className="text-sm text-gray-500">Showing {startIdx}–{endIdx} of {data.total} products</span>
            <div className="flex items-center gap-3">
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"><ChevronLeft size={14} /></button>
                <span className="px-3 py-1 text-sm text-gray-700">Page {page} of {data.totalPages}</span>
                <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
        )}

        {/* Detail Drawer */}
        <DetailDrawer product={selectedProduct} onClose={() => setSelectedProduct(null)} onRefresh={() => { fetchProducts(); fetchSummary(); }} onEdit={(p) => { setSelectedProduct(null); openEdit(p); }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */

function SummaryCard({ label, value, icon, color = 'primary', loading, onClick, active, isCurrency }: {
  label: string; value: number; icon: React.ReactNode;
  color?: 'primary' | 'emerald' | 'red' | 'amber';
  loading?: boolean; onClick?: () => void; active?: boolean; isCurrency?: boolean;
}) {
  const colorMap = {
    primary: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  };
  const c = colorMap[color];
  return (
    <button onClick={onClick} disabled={!onClick || loading}
      className={`text-left p-4 rounded-xl border transition-all ${active ? `${c.bg} ${c.border} ring-2 ring-offset-1 ring-${color === 'primary' ? 'primary' : color}-400` : 'bg-white border-gray-200 hover:border-gray-300'} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${loading ? 'text-gray-300' : 'text-gray-900'}`}>{loading ? '—' : isCurrency ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : value.toLocaleString()}</span>
        <span className={`${c.text}`}>{icon}</span>
      </div>
      <span className="text-sm text-gray-500 mt-1 block">{label}</span>
    </button>
  );
}
