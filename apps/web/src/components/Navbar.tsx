import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ShoppingCart, PawPrint, User, LogOut, ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../hooks/useCms';
import { CartDrawer } from '@pawtag/ui';
import { useCartInteraction } from '../context/CartInteractionContext';

// Memoized cart icon — only re-renders when itemCount changes
const CartIcon = memo(function CartIcon({ onClick }: { onClick: () => void }) {
  const { itemCount } = useCart();
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const { tokens } = useCartInteraction();
  const prevItemCount = useRef(itemCount);

  useEffect(() => {
    if (itemCount > prevItemCount.current && cartButtonRef.current) {
      const el = cartButtonRef.current;
      el.animate([
        { transform: 'scale(1)' },
        { transform: `scale(${tokens.cartIcon.scaleBounce})` },
        { transform: 'scale(1)' },
      ], {
        duration: tokens.cartIcon.duration,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      });
    }
    prevItemCount.current = itemCount;
  }, [itemCount, tokens]);

  return (
    <button ref={cartButtonRef} data-cart-icon onClick={onClick} className="relative p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-primary-50 transition-all">
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <span data-cart-badge className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </button>
  );
});

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { items, total, removeItem, updateQuantity, clearCart } = useCart();
  const { user, logout } = useAuth();
  const { menus, loading } = useNavigation('header');

  const fallbackLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/about', label: 'About' },
  ];

  const navLinks = loading || !menus.length ? fallbackLinks : menus[0]?.items?.map(item => ({
    to: item.url,
    label: item.label,
  })) || fallbackLinks;

  const isActive = (path: string) => location.pathname === path;

  const handleCheckout = useCallback(() => {
    setCartOpen(false);
    navigate('/checkout');
  }, [navigate]);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <PawPrint className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Paw<span className="text-primary-600">Tag</span></span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}>
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Memoized Cart Icon */}
              <CartIcon onClick={() => setCartOpen(!cartOpen)} />

              {/* User Menu / Sign In */}
              {user ? (
                <div className="relative">
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                    <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-semibold text-sm">{user.fullName?.[0] || 'U'}</span>
                    </div>
                    <span className="hidden sm:block">{user.fullName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <Link to="/account" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setUserMenuOpen(false)}>
                          <User className="h-4 w-4" /> My Account
                        </Link>
                        <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          <LogOut className="h-4 w-4" /> Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link to="/login" className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-all">
                  <User className="h-4 w-4" /> Sign In
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50">
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className={`block px-4 py-3 rounded-lg font-medium transition-all ${
                  isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                  {link.label}
                </Link>
              ))}
              {!user && (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 bg-primary-600 text-white rounded-lg font-medium text-center mt-4">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Cart Drawer — only rendered when open */}
      {cartOpen && (
        <CartDrawer
          open={true}
          onClose={() => setCartOpen(false)}
          items={items}
          total={total}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onClearCart={clearCart}
          onCheckout={handleCheckout}
        />
      )}
    </>
  );
}
