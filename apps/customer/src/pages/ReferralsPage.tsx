import { useState, useEffect } from 'react';
import { Copy, Share2, Users, Gift, Clock, CheckCircle } from 'lucide-react';
import api from '../lib/api';

export default function ReferralsPage() {
  const [code, setCode] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/customer/referral'),
      api.get('/customer/referral/stats'),
      api.get('/customer/referral/history'),
    ]).then(([codeRes, statsRes, historyRes]) => {
      setCode(codeRes.data.data.code);
      setShareUrl(codeRes.data.data.shareUrl);
      setStats(statsRes.data.data);
      setHistory(historyRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: 'Join PawTag', text: 'Get a free pet tag with my referral code!', url: shareUrl });
    } else {
      copyCode();
    }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <p className="text-sm text-gray-500">Invite friends and both earn 1 month free on your subscription!</p>
      </div>

      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white">
        <h2 className="text-lg font-semibold mb-2">Your Referral Code</h2>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl font-mono font-bold tracking-wider">{code}</span>
          <button onClick={copyCode} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
            {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
          </button>
          <button onClick={shareLink} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
            <Share2 size={20} />
          </button>
        </div>
        <p className="text-sm text-primary-100">
          {copied ? 'Copied to clipboard!' : 'Share this code with friends. When they buy a tag, you both get 1 month free!'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Users size={16} /> Total Referrals</div>
          <p className="text-2xl font-bold">{stats?.totalReferrals || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><CheckCircle size={16} /> Completed</div>
          <p className="text-2xl font-bold text-green-600">{stats?.completedReferrals || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Clock size={16} /> Pending</div>
          <p className="text-2xl font-bold text-amber-600">{stats?.pendingReferrals || 0}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Gift size={16} /> Rewards Earned</div>
          <p className="text-2xl font-bold text-primary-600">{stats?.totalRewardMonths || 0} mo</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-5 py-3 border-b font-medium">Referral History</div>
        {history.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400">No referrals yet. Share your code to get started!</div>
        ) : (
          <div className="divide-y">
            {history.map((r: any) => (
              <div key={r._id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.refereeId?.fullName || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{r.refereeId?.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'rewarded' ? 'bg-green-100 text-green-700' :
                    r.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{r.status}</span>
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
