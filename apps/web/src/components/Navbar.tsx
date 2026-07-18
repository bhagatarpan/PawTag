import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <PawPrint className="text-primary-600" size={28} />
            <span className="text-xl font-bold">
              <span className="text-primary-600">Paw</span>Tag
            </span>
          </Link>
          <div className="flex items-center gap-8">
            <Link to="/" className="text-gray-600 hover:text-primary-600 text-sm font-medium transition-colors">Home</Link>
            <Link to="/shop" className="text-gray-600 hover:text-primary-600 text-sm font-medium transition-colors">Shop</Link>
            <Link to="/about" className="text-gray-600 hover:text-primary-600 text-sm font-medium transition-colors">About</Link>
            <Link to="/login" className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
