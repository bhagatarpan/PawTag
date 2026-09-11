import { Link } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';

export default function Breadcrumb() {
  const items = useBreadcrumbs();

  return (
    <nav aria-label="Breadcrumb" className="text-sm py-2 px-4 md:px-6 bg-gray-50 border-b border-gray-100">
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight size={14} className="text-gray-300 mx-1.5 flex-shrink-0" />
            )}
            {item.isCurrent ? (
              <span className="flex items-center gap-1.5 text-gray-900 font-medium">
                {index === 0 && <Home size={14} className="text-gray-400" />}
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                to={item.href}
                className="flex items-center gap-1.5 text-gray-500 hover:text-primary-600 cursor-pointer transition-colors"
              >
                {index === 0 && <Home size={14} className="text-gray-400" />}
                {item.label}
              </Link>
            ) : (
              <span className="flex items-center gap-1.5 text-gray-500">
                {index === 0 && <Home size={14} className="text-gray-400" />}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
