import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingCart, PawPrint, User, LogOut, ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const { itemCount, items, total, removeItem, updateQuantity, clearCart } = useCart();
  const { user, logout } = useAuth();

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/about', label: 'About' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <PawPrint className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Paw<span className="text-teal-600">Tag</span></span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}>
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Cart Button */}
              <button onClick={() => setCartOpen(!cartOpen)} className="relative p-2 rounded-lg text-gray-600 hover:text-teal-600 hover:bg-teal-50 transition-all">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-teal-600 text-white text-xs font-bold h-5 w-5 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </button>

              {/* User Menu / Sign In */}
              {user ? (
                <div className="relative">
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                    <div className="h-8 w-8 bg-teal-100 rounded-full flex items-center justify-center">
                      <span className="text-teal-700 font-semibold text-sm">{user.fullName?.[0] || 'U'}</span>
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
                <Link to="/login" className="hidden md:flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all">
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
                  isActive(link.to) ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                  {link.label}
                </Link>
              ))}
              {!user && (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-3 bg-teal-600 text-white rounded-lg font-medium text-center mt-4">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Cart Drawer — rendered outside nav to avoid stacking context issue */}
      {cartOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setCartOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Your Cart ({itemCount})</h2>
              <button onClick={() => setCartOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Your cart is empty</p>
                  <button onClick={() => setCartOpen(false)} className="mt-4 text-teal-600 font-medium hover:text-teal-700">
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.productId} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="h-20 w-20 bg-teal-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                        {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover rounded-lg" /> : <PawPrint className="h-8 w-8 text-teal-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm truncate">{item.name}</h3>
                        {item.petName && <p className="text-xs text-teal-600">For: {item.petName}</p>}
                        <p className="text-sm font-semibold text-teal-700 mt-1">${item.price.toFixed(2)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="h-6 w-6 rounded border border-gray-300 flex items-center justify-center text-xs hover:bg-gray-100">-</button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="h-6 w-6 rounded border border-gray-300 flex items-center justify-center text-xs hover:bg-gray-100">+</button>
                          <button onClick={() => removeItem(item.productId)} className="ml-auto text-xs text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {items.length > 0 && (
              <div className="border-t border-gray-100 p-6 space-y-4">
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="text-teal-700">${total.toFixed(2)}</span>
                </div>
                <Link to="/checkout" onClick={() => setCartOpen(false)} className="block w-full py-3 bg-teal-600 text-white text-center rounded-xl font-semibold hover:bg-teal-700 transition-all">
                  Checkout
                </Link>
                <button onClick={clearCart} className="w-full text-sm text-gray-500 hover:text-red-500">Clear Cart</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
