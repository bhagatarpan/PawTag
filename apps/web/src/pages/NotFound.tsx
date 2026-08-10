import { Link } from 'react-router-dom';
import { PawPrint, Home, ArrowLeft } from 'lucide-react';
import { useSiteSettings } from '../hooks/useCms';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function NotFound() {
  const { settings } = useSiteSettings();
  const companyName = settings?.['company.name'] || 'PawTag';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-8">
            <span className="text-9xl font-bold text-teal-600">404</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-500 text-lg mb-8 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-all"
            >
              <Home size={18} />
              Go Home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              <ArrowLeft size={18} />
              Go Back
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
