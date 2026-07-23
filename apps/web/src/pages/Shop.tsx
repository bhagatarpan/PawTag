import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Search, Filter, PawPrint } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { Product } from '../types';
import SeoHead from '../components/SeoHead';

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [addingId, setAddingId] = useState<string | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/finder/shop/products');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...new Set(products.map((p) => p.category))];

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: Product) => {
    setAddingId(product._id);
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images?.[0],
    });
    setTimeout(() => setAddingId(null), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SeoHead 
        title="Shop"
        description="Browse our range of QR-coded pet recovery tags. Each tag links to your pet's online profile, helping them get home faster."
        keywords={['shop', 'pet tags', 'QR code tags', 'pet recovery', 'buy tags']}
      />
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Shop PawTag Products</h1>
          <p className="text-teal-100 text-lg max-w-2xl">
            Browse our range of QR-coded pet recovery tags. Each tag links to your pet's online profile, helping them get home faster.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="pl-10 pr-8 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-teal-500 appearance-none bg-white min-w-[180px]"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="h-64 bg-gray-200" />
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <PawPrint className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <div key={product._id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden group">
                <Link to={`/shop/${product._id}`} className="block">
                  <div className="relative h-64 bg-gradient-to-br from-teal-50 to-teal-100 overflow-hidden">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <PawPrint className="h-24 w-24 text-teal-200" />
                      </div>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Out of Stock
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <Link to={`/shop/${product._id}`}>
                      <h3 className="text-lg font-semibold text-gray-900 hover:text-teal-600 transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    <span className="text-xl font-bold text-teal-700">${product.price.toFixed(2)}</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {product.shortDescription || product.description}
                  </p>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock <= 0 || addingId === product._id}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                      addingId === product._id
                        ? 'bg-green-500 text-white'
                        : product.stock <= 0
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.98]'
                    }`}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {addingId === product._id ? 'Added!' : product.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
