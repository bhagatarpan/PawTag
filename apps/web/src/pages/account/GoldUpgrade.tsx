import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Check, ArrowRight, Star, Shield } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';

interface GoldBenefits {
  title: string;
  description: string;
}

export default function GoldUpgrade() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isGoldMember, setIsGoldMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [settingsRes, pointsRes] = await Promise.all([
        api.get('/public/cms/settings').catch(() => ({ data: { data: {} } })),
        api.get(API.customer.guardian.points).catch(() => ({ data: { data: null } })),
      ]);

      setSettings(settingsRes.data.data || {});

      // Check if user is already Gold member
      if (pointsRes.data.data) {
        const tier = pointsRes.data.data.tier;
        const isGold = pointsRes.data.data.isGoldMember || tier === 'GOLD';
        setIsGoldMember(isGold);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Gold membership data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe() {
    setSubscribing(true);
    setError(null);
    try {
      await api.post(API.customer.subscriptions.goldSubscribe);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to subscribe to Gold');
    } finally {
      setSubscribing(false);
    }
  }

  const goldPrice = parseFloat(settings['guardian.goldPrice'] || '2.99');
  const goldMultiplier = parseInt(settings['guardian.goldMultiplier'] || '2');
  const goldBenefits: GoldBenefits[] = (() => {
    try {
      const raw = settings['guardian.gold.benefits'];
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();
  const heroHeadline = settings['guardian.gold.heroHeadline'] || 'Go Gold. Get 2× the Rewards.';
  const heroSubtext = settings['guardian.gold.heroSubtext'] || 'Earn double points on every purchase, free shipping over $50, and start at Nurture tier.';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/account/subscriptions" className="text-primary-600 hover:text-primary-700 text-sm mb-2 block">
          ← Back to Subscriptions
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{heroHeadline}</h1>
        <p className="text-gray-500 mt-1">{heroSubtext}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Gold Card */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Crown size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Gold Membership</h2>
              {isGoldMember && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                  <Check size={12} /> Current Plan
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="mb-6">
            <span className="text-5xl font-bold">${goldPrice.toFixed(2)}</span>
            <span className="text-white/70 text-lg">/month</span>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {goldBenefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={14} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white">{benefit.title}</p>
                  <p className="text-white/70 text-sm">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {isGoldMember ? (
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-white/80 text-sm">You're already a Gold member! Enjoy your benefits.</p>
              <Link to="/account/guardian" className="mt-2 inline-flex items-center gap-2 text-white font-semibold hover:underline">
                View Dashboard <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full sm:w-auto px-8 py-4 bg-white text-amber-600 rounded-xl font-bold text-lg hover:bg-white/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {subscribing ? 'Subscribing...' : 'Subscribe to Gold'}
              {!subscribing && <ArrowRight size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Comparison */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Gold vs Guardian</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="font-medium text-gray-500">Feature</div>
          <div className="font-medium text-gray-500">Guardian</div>
          <div className="font-medium text-amber-600">Gold</div>

          <div className="py-2 border-t border-gray-100">Points multiplier</div>
          <div className="py-2 border-t border-gray-100">1×</div>
          <div className="py-2 border-t border-gray-100 font-semibold text-amber-600">{goldMultiplier}×</div>

          <div className="py-2 border-t border-gray-100">Monthly PawRewards</div>
          <div className="py-2 border-t border-gray-100">$2/mo</div>
          <div className="py-2 border-t border-gray-100 font-semibold text-amber-600">$3/mo</div>

          <div className="py-2 border-t border-gray-100">Free shipping</div>
          <div className="py-2 border-t border-gray-100">Over $100</div>
          <div className="py-2 border-t border-gray-100 font-semibold text-amber-600">Over $50</div>

          <div className="py-2 border-t border-gray-100">Early access</div>
          <div className="py-2 border-t border-gray-100 text-gray-400">—</div>
          <div className="py-2 border-t border-gray-100 font-semibold text-amber-600">✓</div>

          <div className="py-2 border-t border-gray-100">Priority support</div>
          <div className="py-2 border-t border-gray-100 text-gray-400">—</div>
          <div className="py-2 border-t border-gray-100 font-semibold text-amber-600">✓</div>
        </div>
      </div>
    </div>
  );
}
