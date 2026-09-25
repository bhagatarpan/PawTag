import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Crown, Shield, Diamond, CreditCard, Calendar, Tag } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface MemberDetail {
  membership: {
    _id: string;
    userId: { _id: string; fullName: string; email: string; phoneNumber?: string };
    tierId: { tier: string; displayName: string; price: number; benefits: any };
    status: string;
    price: number;
    currentPeriodEnd: string;
    cardBrand?: string;
    cardLast4?: string;
    autoRenew: boolean;
  };
  tags: Array<{ _id: string; tagId: string; status: string }>;
}

const TIER_ICONS: Record<string, typeof Crown> = {
  gold: Crown,
  platinum: Diamond,
  black: Shield,
};

export default function MembershipSubscriberDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extendLoading, setExtendLoading] = useState(false);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id]);

  async function fetchDetail() {
    try {
      const res = await api.get(API.admin.membership.subscriber(id!));
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch member detail:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtend(extensionType: 'charge' | 'grace') {
    if (!confirm(`Extend membership by 30 days (${extensionType === 'charge' ? 'with charge' : 'complimentary'})?`)) return;
    setExtendLoading(true);
    try {
      await api.post(API.admin.membership.extend, {
        membershipId: id,
        extensionType,
        extensionDays: 30,
      });
      await fetchDetail();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to extend membership');
    } finally {
      setExtendLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <p className="text-gray-500">Member not found</p>
      </div>
    );
  }

  const { membership, tags } = data;
  const tier = membership.tierId;
  const Icon = TIER_ICONS[tier?.tier] || Crown;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Back Link */}
      <Link to="/membership/subscribers" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Back to Subscribers
      </Link>

      {/* Member Header */}
      <div className={`rounded-2xl p-6 bg-gradient-to-br ${tier?.tier === 'gold' ? 'from-yellow-400 to-amber-500' : tier?.tier === 'platinum' ? 'from-gray-300 to-gray-500' : 'from-gray-800 to-black'}`}>
        <div className="flex items-center gap-4">
          <Icon className="h-10 w-10 text-white" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{tier?.displayName || 'Unknown'} Membership</h1>
            <p className="text-white/80">{membership.userId?.fullName} ({membership.userId?.email})</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            membership.status === 'active' ? 'bg-green-500/20 text-green-100' :
            membership.status === 'cancelled' ? 'bg-amber-500/20 text-amber-100' :
            'bg-red-500/20 text-red-100'
          }`}>
            {membership.status}
          </span>
        </div>
      </div>

      {/* Membership Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Renewal Date</span>
          </div>
          <p className="font-semibold text-gray-900">{formatDate(membership.currentPeriodEnd)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Payment Method</span>
          </div>
          <p className="font-semibold text-gray-900">
            {membership.cardBrand ? `${membership.cardBrand} ending in ${membership.cardLast4}` : 'No payment method'}
          </p>
        </div>
      </div>

      {/* Tags Covered */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4" /> Tags Covered
        </h2>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">No tags linked</p>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="font-mono text-sm font-bold">{tag.tagId}</span>
                <span className={`text-xs font-medium ${tag.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                  {tag.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Admin Actions</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleExtend('charge')}
            disabled={extendLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            Extend 30 Days (Charge)
          </button>
          <button
            onClick={() => handleExtend('grace')}
            disabled={extendLoading}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            Extend 30 Days (Complimentary)
          </button>
        </div>
      </div>
    </div>
  );
}
