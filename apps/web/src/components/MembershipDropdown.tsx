import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Shield, Diamond, ArrowRight, ChevronDown } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface MembershipTier {
  _id: string;
  tier: 'gold' | 'platinum' | 'black';
  name: string;
  displayName: string;
  description: string;
  price: number;
  benefits: {
    pointsMultiplier: number;
    freeShippingThreshold: number;
    inAppNotifications: boolean;
    criticalEmergencyContact: boolean;
    petRecovery: boolean;
  };
  icon: string;
  gradient: string;
}

const TIER_CONFIG: Record<string, { icon: typeof Crown; gradient: string; bgGradient: string; benefits: string[] }> = {
  gold: {
    icon: Crown,
    gradient: 'from-yellow-400 to-amber-500',
    bgGradient: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    benefits: ['1× Points', 'Free shipping $100+'],
  },
  platinum: {
    icon: Diamond,
    gradient: 'from-gray-300 to-gray-500',
    bgGradient: 'bg-gradient-to-br from-gray-300 to-gray-500',
    benefits: ['2× Points', 'Emergency Contacts'],
  },
  black: {
    icon: Shield,
    gradient: 'from-gray-800 to-black',
    bgGradient: 'bg-gradient-to-br from-gray-800 to-black',
    benefits: ['3× Points', 'Pet Recovery'],
  },
};

export default function MembershipDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTiers();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
          isOpen
            ? 'bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white shadow-lg scale-105'
            : 'bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg hover:scale-105'
        }`}
      >
        <Crown className="h-4 w-4" />
        <span className="hidden sm:block">Membership</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="font-bold text-gray-900">Membership Plans</span>
            </div>
            <span className="text-xs text-gray-400">Annual billing</span>
          </div>

          {/* Tier Cards */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {tiers.map((tier) => {
                const config = TIER_CONFIG[tier.tier] || TIER_CONFIG.gold;
                const Icon = config.icon;

                return (
                  <Link
                    key={tier._id}
                    to="/membership"
                    onClick={() => setIsOpen(false)}
                    className="group"
                  >
                    <div className={`rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all hover:scale-105`}>
                      {/* Card Header */}
                      <div className={`${config.bgGradient} p-3 text-center`}>
                        <Icon className="h-6 w-6 text-white mx-auto mb-1" />
                        <div className="text-white font-bold text-xs">{tier.displayName}</div>
                      </div>

                      {/* Card Body */}
                      <div className="bg-white p-3">
                        <div className="text-lg font-bold text-gray-900 text-center">
                          ${tier.price}
                          <span className="text-xs text-gray-400 font-normal">/yr</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {config.benefits.map((benefit, i) => (
                            <div key={i} className="text-[10px] text-gray-500 text-center">
                              {benefit}
                            </div>
                          ))}
                        </div>
                        {tier.tier === 'black' && (
                          <div className="mt-2 text-[10px] text-gray-400 text-center font-medium">
                            COMING SOON
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* View All Button */}
          <Link
            to="/membership"
            onClick={() => setIsOpen(false)}
            className="block w-full py-2 bg-primary-600 text-white rounded-lg font-semibold text-sm text-center hover:bg-primary-700 transition-colors"
          >
            View All Plans <ArrowRight className="inline h-4 w-4 ml-1" />
          </Link>
        </div>
      )}
    </div>
  );
}
