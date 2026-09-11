import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';
import PageHeader from '../components/PageHeader';

interface GuardianSettings {
  // Points earning rates (purchaseRate points earned per purchaseSpentAmount dollars spent)
  purchaseRateGuardian: number;
  purchaseRateGold: number;
  purchaseSpentAmount: number;
  purchaseSpentAmountGold: number;
  repeatPurchaseBonusGuardian: number;
  repeatPurchaseBonusGold: number;
  
  // Review points
  reviewTextPoints: number;
  reviewPhotoPoints: number;
  reviewVideoPoints: number;
  
  // Referral points
  referralSignupPoints: number;
  referralPurchasePoints: number;
  
  // Pet milestone points
  petProfilePoints: number;
  petBirthdayPoints: number;
  petAnniversaryPoints: number;
  
  // Membership milestone points
  monthlyAnniversaryPoints: number;
  annualAnniversaryPoints: number;
  
  // Tag activation points
  tagActivationPoints: number;
  
  // Social share points
  socialSharePoints: number;
  
  // Gold multiplier
  goldMultiplier: number;
  goldPrice: number;
  
  // Annual caps
  annualCapReviewText: number;
  annualCapReviewPhoto: number;
  annualCapReviewVideo: number;
  annualCapReferralSignup: number;
  
  // Tier thresholds
  tierThresholdNurture: number;
  tierThresholdProtector: number;
  tierThresholdSafeguard: number;
  
  // PawRewards allocation
  pawRewardsCare: number;
  pawRewardsNurture: number;
  pawRewardsProtector: number;
  pawRewardsSafeguard: number;
  
  // PawRewards earning rate
  pawRewardsEarningRateGuardian: number;
  pawRewardsEarningRateGold: number;
  
  // PawRewards rules
  pawRewardsMinRedemption: number;
  pawRewardsExpirationMonths: number;
  pawRewardsMaxBalanceGuardian: number;
  pawRewardsMaxBalanceGold: number;

  // Gold benefits & tier rules
  goldFreeShippingThreshold: number;
  tierDowngradeGraceDays: number;
  lifetimeSafeguardYears: number;
}

const DEFAULT_SETTINGS: GuardianSettings = {
  purchaseRateGuardian: 1,
  purchaseRateGold: 2,
  purchaseSpentAmount: 1,
  purchaseSpentAmountGold: 1,
  repeatPurchaseBonusGuardian: 10,
  repeatPurchaseBonusGold: 20,
  reviewTextPoints: 5,
  reviewPhotoPoints: 15,
  reviewVideoPoints: 25,
  referralSignupPoints: 20,
  referralPurchasePoints: 50,
  petProfilePoints: 15,
  petBirthdayPoints: 10,
  petAnniversaryPoints: 10,
  monthlyAnniversaryPoints: 5,
  annualAnniversaryPoints: 25,
  tagActivationPoints: 10,
  socialSharePoints: 3,
  goldMultiplier: 2,
  goldPrice: 1.99,
  annualCapReviewText: 30,
  annualCapReviewPhoto: 50,
  annualCapReviewVideo: 75,
  annualCapReferralSignup: 200,
  tierThresholdNurture: 100,
  tierThresholdProtector: 200,
  tierThresholdSafeguard: 300,
  pawRewardsCare: 2.00,
  pawRewardsNurture: 3.00,
  pawRewardsProtector: 5.00,
  pawRewardsSafeguard: 8.00,
  pawRewardsEarningRateGuardian: 50,
  pawRewardsEarningRateGold: 25,
  pawRewardsMinRedemption: 2.00,
  pawRewardsExpirationMonths: 6,
  pawRewardsMaxBalanceGuardian: 20.00,
  pawRewardsMaxBalanceGold: 40.00,
  goldFreeShippingThreshold: 50,
  tierDowngradeGraceDays: 90,
  lifetimeSafeguardYears: 3,
};

export default function GuardianSettings() {
  const [settings, setSettings] = useState<GuardianSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await api.get(API.admin.guardian.settings);
      setSettings({ ...DEFAULT_SETTINGS, ...res.data.data });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.put(API.admin.guardian.settings, settings);
      setSuccess('Settings saved successfully');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Shield size={20} className="text-primary-600" />}
        title="Guardian Settings"
        subtitle="Configure Guardian loyalty program settings"
        actions={
          <>
            <Link
              to="/guardian"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </>
        }
      />

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Points Earning Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Points Earning</h2>
        <p className="text-sm text-gray-500 mb-4">Formula: (Order Total ÷ Spent Amount) × Rate = Points Earned</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Rate (Guardian)
            </label>
            <input
              type="number"
              value={settings.purchaseRateGuardian}
              onChange={(e) => setSettings({ ...settings, purchaseRateGuardian: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Points earned</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spent Amount (Guardian)
            </label>
            <input
              type="number"
              value={settings.purchaseSpentAmount}
              onChange={(e) => setSettings({ ...settings, purchaseSpentAmount: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Per dollar amount spent (e.g., 10 = earn for every $10)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Rate (Gold)
            </label>
            <input
              type="number"
              value={settings.purchaseRateGold}
              onChange={(e) => setSettings({ ...settings, purchaseRateGold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Points earned (Gold members)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spent Amount (Gold)
            </label>
            <input
              type="number"
              value={settings.purchaseSpentAmountGold}
              onChange={(e) => setSettings({ ...settings, purchaseSpentAmountGold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Per dollar amount spent (Gold members)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repeat Purchase Bonus (Guardian)
            </label>
            <input
              type="number"
              value={settings.repeatPurchaseBonusGuardian}
              onChange={(e) => setSettings({ ...settings, repeatPurchaseBonusGuardian: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Bonus points on 3rd+ order</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repeat Purchase Bonus (Gold)
            </label>
            <input
              type="number"
              value={settings.repeatPurchaseBonusGold}
              onChange={(e) => setSettings({ ...settings, repeatPurchaseBonusGold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Bonus points on 3rd+ order (Gold members)</p>
          </div>
        </div>
      </div>

      {/* Review Points */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Points</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text Review
            </label>
            <input
              type="number"
              value={settings.reviewTextPoints}
              onChange={(e) => setSettings({ ...settings, reviewTextPoints: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo Review
            </label>
            <input
              type="number"
              value={settings.reviewPhotoPoints}
              onChange={(e) => setSettings({ ...settings, reviewPhotoPoints: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video Review
            </label>
            <input
              type="number"
              value={settings.reviewVideoPoints}
              onChange={(e) => setSettings({ ...settings, reviewVideoPoints: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Tier Thresholds */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Thresholds</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nurture Tier
            </label>
            <input
              type="number"
              value={settings.tierThresholdNurture}
              onChange={(e) => setSettings({ ...settings, tierThresholdNurture: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Points required</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protector Tier
            </label>
            <input
              type="number"
              value={settings.tierThresholdProtector}
              onChange={(e) => setSettings({ ...settings, tierThresholdProtector: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Points required</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Safeguard Tier
            </label>
            <input
              type="number"
              value={settings.tierThresholdSafeguard}
              onChange={(e) => setSettings({ ...settings, tierThresholdSafeguard: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Points required</p>
          </div>
        </div>
      </div>

      {/* Gold Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gold Membership</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gold Monthly Price (NZD)
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.goldPrice}
              onChange={(e) => setSettings({ ...settings, goldPrice: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Monthly subscription price for Gold members</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gold Points Multiplier
            </label>
            <input
              type="number"
              value={settings.goldMultiplier}
              onChange={(e) => setSettings({ ...settings, goldMultiplier: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Points multiplier for Gold members</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gold Free Shipping Threshold (NZD)
            </label>
            <input
              type="number"
              value={settings.goldFreeShippingThreshold}
              onChange={(e) => setSettings({ ...settings, goldFreeShippingThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum order total for Gold free shipping</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tier Downgrade Grace Period (days)
            </label>
            <input
              type="number"
              value={settings.tierDowngradeGraceDays}
              onChange={(e) => setSettings({ ...settings, tierDowngradeGraceDays: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Days before tier downgrade is applied</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lifetime Safeguard Years
            </label>
            <input
              type="number"
              value={settings.lifetimeSafeguardYears}
              onChange={(e) => setSettings({ ...settings, lifetimeSafeguardYears: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Consecutive years at Safeguard for lifetime status</p>
          </div>
        </div>
      </div>

      {/* PawRewards Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">PawRewards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Allocation (Care)
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.pawRewardsCare}
              onChange={(e) => setSettings({ ...settings, pawRewardsCare: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">NZD per month</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Allocation (Nurture)
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.pawRewardsNurture}
              onChange={(e) => setSettings({ ...settings, pawRewardsNurture: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">NZD per month</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Allocation (Protector)
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.pawRewardsProtector}
              onChange={(e) => setSettings({ ...settings, pawRewardsProtector: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">NZD per month</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Allocation (Safeguard)
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.pawRewardsSafeguard}
              onChange={(e) => setSettings({ ...settings, pawRewardsSafeguard: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">NZD per month</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Redemption
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.pawRewardsMinRedemption}
              onChange={(e) => setSettings({ ...settings, pawRewardsMinRedemption: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">NZD</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration (Months)
            </label>
            <input
              type="number"
              value={settings.pawRewardsExpirationMonths}
              onChange={(e) => setSettings({ ...settings, pawRewardsExpirationMonths: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Months before rewards expire</p>
          </div>
        </div>
      </div>
    </div>
  );
}
