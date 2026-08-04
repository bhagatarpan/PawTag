import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function RedeemTagPage() {
  const [tagId, setTagId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redeemedTag, setRedeemedTag] = useState<any>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/customer/tags/redeem', { tagId: tagId.trim().toUpperCase() });
      setRedeemedTag(res.data.data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to redeem tag');
    } finally {
      setLoading(false);
    }
  };

  if (success && redeemedTag) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Tag Activated!</h1>
          <p className="text-gray-600 mb-4">
            Tag <span className="font-mono font-bold">{redeemedTag.tagId}</span> has been linked to your account.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You can now attach this tag to your pet's collar. Next, create a pet profile to link this tag to your pet.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/pets/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Create Pet Profile
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-2">Activate Your Tag</h1>
      <p className="text-gray-600 mb-6">
        Enter the tag ID printed on your physical PawTag. You can find it on the back of the tag.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="tagId" className="block text-sm font-medium text-gray-700 mb-1">
            Tag ID
          </label>
          <input
            type="text"
            id="tagId"
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            placeholder="PT-123456"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg text-center"
            required
            autoFocus
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !tagId.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Activating...' : 'Activate Tag'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          <strong>Where to find your tag ID:</strong> Look for the code starting with "PT-" printed on the back of your PawTag.
        </p>
      </div>
    </div>
  );
}
