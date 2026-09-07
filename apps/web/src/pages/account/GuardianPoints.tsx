import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

interface PointsData {
  balance: number;
  tier: string;
  pointsToNextTier: number | null;
  nextTier: string | null;
  history: Array<{
    _id: string;
    points: number;
    activity: string;
    description: string;
    createdAt: string;
  }>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  review_text: 'Text Review',
  review_photo: 'Photo Review',
  review_video: 'Video Review',
  referral_signup: 'Referral Signup',
  referral_purchase: 'Referral Purchase',
  pet_profile_complete: 'Pet Profile Complete',
  pet_birthday: 'Pet Birthday',
  pet_adoption_anniversary: 'Adoption Anniversary',
  membership_monthly: 'Monthly Membership',
  membership_annual: 'Annual Membership',
  tag_scan: 'Tag Scan',
  lost_pet_report: 'Lost Pet Report',
  pet_reunited: 'Pet Reunited',
  social_share: 'Social Share',
};

const ACTIVITY_ICONS: Record<string, string> = {
  purchase: '🛒',
  review_text: '📝',
  review_photo: '📷',
  review_video: '🎬',
  referral_signup: '👥',
  referral_purchase: '🎉',
  pet_profile_complete: '🐾',
  pet_birthday: '🎂',
  pet_adoption_anniversary: '📅',
  membership_monthly: '🔄',
  membership_annual: '🎉',
  tag_scan: '📱',
  lost_pet_report: '🚨',
  pet_reunited: '🏠',
  social_share: '📢',
};

export default function GuardianPoints() {
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchPointsData();
  }, [page]);

  async function fetchPointsData() {
    try {
      const [pointsRes, historyRes] = await Promise.all([
        api.get('/customer/guardian/points'),
        api.get(`/customer/guardian/activity?limit=20&offset=${(page - 1) * 20}`),
      ]);

      if (page === 1) {
        setData({
          ...pointsRes.data.data,
          history: historyRes.data.data,
        });
      } else {
        setData((prev) => prev ? {
          ...prev,
          history: [...prev.history, ...historyRes.data.data],
        } : null);
      }

      setHasMore(historyRes.data.data.length === 20);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load points data');
    } finally {
      setLoading(false);
    }
  }

  if (loading && page === 1) {
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
          onClick={() => { setLoading(true); setError(null); fetchPointsData(); }}
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
          <h1 className="text-2xl font-bold text-gray-900">Guardian Points</h1>
          <p className="text-gray-500">Your points balance and earning history</p>
        </div>
      </div>

      {/* Points Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Balance</h2>
            <p className="text-gray-500">Earn more points with purchases, reviews, and referrals</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-primary-600">{data.balance}</div>
            <div className="text-gray-500">points</div>
          </div>
        </div>
        {data.pointsToNextTier !== null && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>{data.tier}</span>
              <span>{data.nextTier}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (data.balance / (data.balance + data.pointsToNextTier)) * 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {data.pointsToNextTier} points to {data.nextTier}
            </p>
          </div>
        )}
      </div>

      {/* Points History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Points History</h2>
        {data.history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No points history yet. Start earning points today!
          </p>
        ) : (
          <div className="space-y-4">
            {data.history.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mr-4 text-lg">
                    {ACTIVITY_ICONS[item.activity] || '✨'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {ACTIVITY_LABELS[item.activity] || item.activity}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()} at{' '}
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <span className="text-green-600 font-semibold">+{item.points}</span>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setPage(page + 1)}
              disabled={loading}
              className="px-4 py-2 text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
