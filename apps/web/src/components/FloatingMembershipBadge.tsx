import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Shield, Diamond, ArrowRight, X } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface MembershipTier {
  _id: string;
  tier: 'gold' | 'platinum' | 'black';
  name: string;
  displayName: string;
  price: number;
  gradient: string;
}

const TIER_CONFIG: Record<string, { icon: typeof Crown; gradient: string; bgGradient: string }> = {
  gold: { icon: Crown, gradient: 'from-yellow-400 to-amber-500', bgGradient: 'bg-gradient-to-br from-yellow-400 to-amber-500' },
  platinum: { icon: Diamond, gradient: 'from-gray-300 to-gray-500', bgGradient: 'bg-gradient-to-br from-gray-300 to-gray-500' },
  black: { icon: Shield, gradient: 'from-gray-800 to-black', bgGradient: 'bg-gradient-to-br from-gray-800 to-black' },
};

const STORAGE_KEY = 'pawtag_membership_badge_dismissed';

export default function FloatingMembershipBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismissedTime = localStorage.getItem(STORAGE_KEY);
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!dismissed) {
      fetchTiers();
    }
  }, [dismissed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (badgeRef.current && !badgeRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleDismiss() {
    setDismissed(true);
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }

  async function fetchTiers() {
    try {
      const res = await api.get(API.public.membership.tiers);
      setTiers(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch membership tiers:', err);
    } finally {
      setLoading(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={badgeRef}>
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-300 ${
          isHovered || isOpen
            ? 'bg-gradient-to-r from-yellow-500 via-gray-400 to-gray-800 text-white shadow-2xl scale-110'
            : 'bg-gradient-to-r from-yellow-500 via-gray-400 to-gray-800 text-white shadow-lg hover:shadow-xl hover:scale-105'
        }`}
      >
        <Crown className="h-5 w-5" />
        <span className="hidden sm:block">Membership</span>
        {/* Pulse animation on first load */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          </span>
        )}
      </button>

      {/* Carousel Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                <span className="font-bold">Membership Plans</span>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-white/80 mt-1">Protect your pet with premium benefits</p>
          </div>

          {/* Tier Cards */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {tiers.map((tier) => {
                const config = TIER_CONFIG[tier.tier] || TIER_CONFIG.gold;
                const Icon = config.icon;

                return (
                  <Link
                    key={tier._id}
                    to="/membership"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className={`${config.bgGradient} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{tier.displayName}</span>
                        <span className="font-bold text-gray-900">${tier.price}<span className="text-xs text-gray-400">/yr</span></span>
                      </div>
                      {tier.tier === 'black' && (
                        <span className="text-[10px] text-gray-400 font-medium">COMING SOON</span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* View All Button */}
          <div className="p-4 pt-0">
            <Link
              to="/membership"
              onClick={() => setIsOpen(false)}
              className="block w-full py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm text-center hover:bg-primary-700 transition-colors"
            >
              View All Plans <ArrowRight className="inline h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
