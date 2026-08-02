import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gift, CheckCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function Refer() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [validation, setValidation] = useState<{ valid: boolean; referrerName?: string } | null>(null);
  const [loading, setLoading] = useState(!!code);

  useEffect(() => {
    if (code) {
      api.get(`/finder/referral/${code}`)
        .then(r => setValidation(r.data.data))
        .catch(() => setValidation({ valid: false }))
        .finally(() => setLoading(false));
    }
  }, [code]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Gift size={32} className="text-primary-600" />
      </div>

      <h1 className="text-3xl font-bold mb-4">Refer Friends, Earn Rewards</h1>
      <p className="text-gray-600 mb-8">
        Share your referral code with friends. When they buy a PawTag, you both get <strong>1 month free</strong> on your subscription!
      </p>

      {loading && <p className="text-gray-400">Validating referral code...</p>}

      {!loading && validation?.valid && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <CheckCircle size={24} className="text-green-600 mx-auto mb-2" />
          <p className="text-green-800 font-medium">
            You were invited by <strong>{validation.referrerName}</strong>!
          </p>
          <p className="text-green-600 text-sm mt-1">
            Sign up and purchase a tag to both earn a free month.
          </p>
        </div>
      )}

      {!loading && validation && !validation.valid && code && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <p className="text-amber-800 font-medium">Invalid or expired referral code</p>
          <p className="text-amber-600 text-sm mt-1">You can still sign up and get started!</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/shop" className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">
          Shop Now <ArrowRight size={18} />
        </Link>
        <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-white text-primary-600 border-2 border-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors">
          Create Account
        </Link>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <div className="bg-white rounded-xl border p-5">
          <div className="text-2xl font-bold text-primary-600 mb-2">1</div>
          <h3 className="font-semibold mb-1">Share Your Code</h3>
          <p className="text-sm text-gray-500">Send your unique referral code to friends and family.</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-2xl font-bold text-primary-600 mb-2">2</div>
          <h3 className="font-semibold mb-1">Friend Purchases</h3>
          <p className="text-sm text-gray-500">They buy any PawTag using your code at checkout.</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="text-2xl font-bold text-primary-600 mb-2">3</div>
          <h3 className="font-semibold mb-1">Both Earn Rewards</h3>
          <p className="text-sm text-gray-500">You both get 1 month free on your subscription!</p>
        </div>
      </div>
    </div>
  );
}
