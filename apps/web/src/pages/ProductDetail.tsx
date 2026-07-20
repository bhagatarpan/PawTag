import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, PawPrint, Package, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { Product } from '../types';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    api.get(`/finder/shop/products`)
      .then((res) => {
        const found = res.data.data?.find((p: Product) => p._id === id);
        setProduct(found || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images?.[0],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <PawPrint className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Product not found</h2>
        <Link to="/shop" className="text-teal-600 hover:text-teal-700 font-medium">
          ← Back to Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link to="/shop" className="hover:text-teal-600 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Shop
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl overflow-hidden aspect-square">
              {product.images?.length ? (
                <img src={product.images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <PawPrint className="h-48 w-48 text-teal-200" />
                </div>
              )}
              {product.images && product.images.length > 1 && (
                <>
                  <button onClick={() => setSelectedImage((prev) => prev > 0 ? prev - 1 : product.images.length - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow-lg hover:bg-white">
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </button>
                  <button onClick={() => setSelectedImage((prev) => prev < product.images.length - 1 ? prev + 1 : 0)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow-lg hover:bg-white">
                    <ChevronRight className="h-5 w-5 text-gray-700" />
                  </button>
                </>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${selectedImage === i ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200 hover:border-gray-300'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <span className="text-sm font-medium text-teal-600 uppercase tracking-wide">{product.category}</span>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{product.name}</h1>
              <p className="text-4xl font-bold text-teal-700 mt-4">${product.price.toFixed(2)} <span className="text-base font-normal text-gray-500">NZD</span></p>
            </div>

            <div className="border-t border-b border-gray-200 py-6">
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm font-medium ${product.stock > 0 ? 'text-green-700' : 'text-red-600'}`}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Quantity:</label>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg">-</button>
                  <span className="px-6 py-2 font-medium">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg">+</button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={product.stock <= 0 || added}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-lg transition-all ${
                  added
                    ? 'bg-green-500 text-white'
                    : product.stock <= 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.98] shadow-lg shadow-teal-200'
                }`}
              >
                <ShoppingCart className="h-6 w-6" />
                {added ? 'Added to Cart!' : product.stock <= 0 ? 'Out of Stock' : `Add to Cart — $${(product.price * quantity).toFixed(2)}`}
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4 pt-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <Shield className="h-8 w-8 text-teal-600" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Secure</p>
                  <p className="text-gray-500 text-xs">Encrypted checkout</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <Package className="h-8 w-8 text-teal-600" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">Fast Shipping</p>
                  <p className="text-gray-500 text-xs">NZ-wide delivery</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
