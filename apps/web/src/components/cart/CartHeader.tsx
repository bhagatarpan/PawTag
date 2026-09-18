import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CartHeaderProps {
  itemCount: number;
}

export default function CartHeader({ itemCount }: CartHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <ShoppingCart size={24} className="text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Cart</h1>
          <p className="text-sm text-gray-500">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <Link
        to="/shop"
        className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
      >
        <ArrowLeft size={16} />
        Continue Shopping
      </Link>
    </div>
  );
}
