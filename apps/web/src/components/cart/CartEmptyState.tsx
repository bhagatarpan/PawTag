import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CartEmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShoppingCart size={32} className="text-gray-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
      <p className="text-gray-500 mb-2 max-w-sm mx-auto">
        Looks like you haven't added any PawTag products yet. Find the perfect tag for your pet!
      </p>
      <p className="text-sm text-gray-400 mb-6">
        Free shipping on orders over $50 • Secure checkout
      </p>
      <Link
        to="/shop"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
      >
        Shop Tags
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
