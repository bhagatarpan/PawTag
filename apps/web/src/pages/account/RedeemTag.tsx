import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, CheckCircle, ArrowRight, Home, Link as LinkIcon } from 'lucide-react';
import { API } from '@pawtag/shared/api';
import api from '../../lib/api';

export default function RedeemTag() {
  const [tagId, setTagId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redeemedTag, setRedeemedTag] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linked, setLinked] = useState(false);
  const navigate = useNavigate();

  // Fetch customer's pets after successful activation
  useEffect(() => {
    if (success && !redeemedTag?.petId) {
      api.get(API.customer.pets.list)
        .then((res) => setPets(res.data.data || []))
        .catch(() => {});
    }
  }, [success, redeemedTag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post(API.customer.tags.redeem, { tagId: tagId.trim().toUpperCase() });
      setRedeemedTag(res.data.data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to redeem tag');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkToPet = async () => {
    if (!selectedPetId || !redeemedTag) return;
    setLinking(true);
    setLinkError('');
    try {
      await api.put(API.customer.tags.linkPet(redeemedTag._id), { petId: selectedPetId });
      setLinked(true);
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Failed to link tag');
    } finally {
      setLinking(false);
    }
  };

  // Success screen — already linked to pet (replacement tag)
  if (linked) {
    const linkedPet = pets.find((p: any) => p._id === selectedPetId);
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">All Set!</h1>
          <p className="text-gray-600 mb-2">
            Tag <span className="font-mono font-bold">{redeemedTag.tagId}</span> is now linked to <span className="font-semibold">{linkedPet?.name || 'your pet'}</span>.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Attach the physical tag to your pet's collar. When someone scans it, they'll see your pet's info and can contact you.
          </p>
          <button
            onClick={() => navigate('/account')}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            Go to My Pets
          </button>
        </div>
      </div>
    );
  }

  // Success screen — needs linking
  if (success && redeemedTag && !redeemedTag.petId) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tag Activated!</h1>
          <p className="text-gray-600">
            Tag <span className="font-mono font-bold">{redeemedTag.tagId}</span> is linked to your account.
          </p>
        </div>

        {/* Link to Pet Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon size={18} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-blue-900">Link Tag to a Pet</h2>
          </div>
          <p className="text-xs text-blue-700 mb-3">
            Select which pet this tag belongs to. This lets finders see your pet's info when they scan the tag.
          </p>

          {pets.length === 0 ? (
            <p className="text-xs text-blue-600">You don't have any pets yet. Create a pet profile first, then link the tag.</p>
          ) : (
            <>
              <select
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 mb-3"
              >
                <option value="">Select a pet...</option>
                {pets.map((pet: any) => (
                  <option key={pet._id} value={pet._id}>{pet.name} ({pet.petType || pet.species})</option>
                ))}
              </select>

              {linkError && (
                <p className="text-xs text-red-600 mb-2">{linkError}</p>
              )}

              <button
                onClick={handleLinkToPet}
                disabled={!selectedPetId || linking}
                className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {linking ? 'Linking...' : 'Link to Pet'}
              </button>
            </>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/account')}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // Success screen — already linked (replacement tag)
  if (success && redeemedTag?.petId) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tag Activated!</h1>
          <p className="text-gray-600 mb-6">
            Tag <span className="font-mono font-bold">{redeemedTag.tagId}</span> has been linked to your pet automatically (replacement tag).
          </p>
          <button
            onClick={() => navigate('/account')}
            className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            Go to My Pets
          </button>
        </div>
      </div>
    );
  }

  // Activation form
  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <QrCode size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Activate Your Tag</h1>
      </div>
      <p className="text-gray-500 mb-6">
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-lg text-center transition-colors"
            required
            autoFocus
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !tagId.trim()}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Activating...' : 'Activate Tag'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-500">
          <strong>Where to find your tag ID:</strong> Look for the code starting with "PT-" printed on the back of your PawTag.
        </p>
      </div>
    </div>
  );
}
