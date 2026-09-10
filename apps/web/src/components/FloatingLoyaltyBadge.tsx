import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

interface GuardianData {
  tier: string;
  points: number;
  isGoldMember: boolean;
}

export default function FloatingLoyaltyBadge() {
  const { user } = useAuth();
  const [data, setData] = useState<GuardianData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (user) {
      api.get(API.customer.guardian.tier)
        .then(res => setData(res.data.data))
        .catch(() => {});
    }
  }, [user]);

  if (!user || !data) return null;

  const tierColors: Record<string, string> = {
    CARE: 'bg-emerald-500',
    NURTURE: 'bg-teal-500',
    PROTECTOR: 'bg-purple-500',
    SAFEGUARD: 'bg-amber-500',
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 ${expanded ? 'w-64' : 'w-auto'}`}>
        {/* Collapsed State */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-2 px-3 py-2 ${tierColors[data.tier] || 'bg-primary-500'} text-white`}
        >
          <Shield size={16} />
          <span className="text-sm font-medium">{data.tier}</span>
          <span className="text-xs opacity-75">•</span>
          <span className="text-xs">{data.points} pts</span>
          {expanded ? <ChevronDown size={14} className="ml-auto" /> : <ChevronUp size={14} className="ml-auto" />}
        </button>

        {/* Expanded State */}
        {expanded && (
          <div className="p-3">
            <div className="text-xs text-gray-500 mb-2">Your Guardian Status</div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{data.tier} Tier</span>
              {data.isGoldMember && (
                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Gold</span>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-3">
              {data.points} lifetime points earned
            </div>
            <Link
              to="/account/guardian"
              className="block w-full text-center px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              View Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
