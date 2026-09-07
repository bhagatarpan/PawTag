import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

interface RewardsData {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  nextExpiration: Date | null;
  expirationAmount: number;
  history: Array<{
    _id: string;
    amount: number;
    type: 'allocation' | 'earning' | 'redemption' | 'expiration';
    description: string;
    createdAt: string;
  }>;
}

const TRANSACTION_LABELS: Record<string, string> = {
  allocation: 'Monthly Allocation',
  earning: 'Purchase Earning',
  redemption: 'Redemption',
  expiration: 'Expired',
};

const TRANSACTION_ICONS: Record<string, string> = {
  allocation: '🎁',
  earning: '💰',
  redemption: '🛒',
  expiration: '⏰',
};

const TRANSACTION_COLORS: Record<string, string> = {
  allocation: 'text-green-600',
  earning: 'text-green-600',
  redemption: 'text-red-600',
  expiration: 'text-amber-600',
};

export default function GuardianRewards() {
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    fetchRewardsData();
  }, []);

  async function fetchRewardsData() {
    try {
      const [balanceRes, historyRes] = await Promise.all([
        api.get('/customer/guardian/rewards'),
        api.get('/customer/guardian/rewards/history'),
      ]);

      setData({
        ...balanceRes.data.data,
        history: historyRes.data.data,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem() {
    if (!redeemAmount || parseFloat(redeemAmount) < 2) {
      alert('Minimum redemption is $2.00');
      return;
    }

    setRedeeming(true);
    try {
      await api.post('/customer/guardian/rewards/redeem', {
        amount: parseFloat(redeemAmount),
      });
      setRedeemModalOpen(false);
      setRedeemAmount('');
      await fetchRewardsData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to redeem rewards');
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded-2xl mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchRewardsData(); }}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/account/guardian" className="text-primary-600 hover:text-primary-700 text-sm mb-2 block">
            ← Back to Guardian Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">PawRewards</h1>
          <p className="text-gray-500">Your redeemable rewards balance</p>
        </div>
        <button
          onClick={() => setRedeemModalOpen(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Redeem Rewards
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Available Balance</h2>
            <p className="text-white/80">Redeem on any purchase (min $2.00)</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">${data.balance.toFixed(2)}</div>
            <div className="text-white/80">NZD</div>
          </div>
        </div>
        {data.nextExpiration && (
          <div className="mt-4 bg-white/10 rounded-lg p-3">
            <p className="text-sm">
              ⚠️ ${data.expirationAmount.toFixed(2)} expires on{' '}
              {new Date(data.nextExpiration).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Earned</h3>
          <div className="text-2xl font-bold text-green-600">${data.totalEarned.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Redeemed</h3>
          <div className="text-2xl font-bold text-primary-600">${data.totalRedeemed.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Expired</h3>
          <div className="text-2xl font-bold text-amber-600">${data.totalExpired.toFixed(2)}</div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
        {data.history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No transactions yet. Start earning rewards with your Guardian membership!
          </p>
        ) : (
          <div className="space-y-4">
            {data.history.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4 text-lg">
                    {TRANSACTION_ICONS[item.type]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {TRANSACTION_LABELS[item.type] || item.type}
                    </p>
                    <p className="text-sm text-gray-500">{item.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${TRANSACTION_COLORS[item.type]}`}>
                  {item.type === 'redemption' || item.type === 'expiration' ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Modal */}
      {redeemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Redeem PawRewards</h3>
            <p className="text-gray-500 mb-4">
              Enter the amount you want to redeem. Minimum redemption is $2.00.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (NZD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="2"
                  max={data.balance}
                  step="0.01"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">Available: ${data.balance.toFixed(2)}</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRedeemModalOpen(false); setRedeemAmount(''); }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={redeeming || !redeemAmount || parseFloat(redeemAmount) < 2}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {redeeming ? 'Redeeming...' : 'Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
