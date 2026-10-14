import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Search, Loader2 } from 'lucide-react';

/**
 * Direct-entry finder control for visitors who arrive at the finder portal
 * without scanning a QR code (someone hands them a tag, or they read the
 * ID off a found pet's collar). Mirrors the activation-card design language:
 * icon, heading, plain instructions, one input, one action, one help note.
 */
export default function FinderLanding() {
  const [tagId, setTagId] = useState('');
  const [navigating, setNavigating] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = tagId.trim().toUpperCase();
    if (!normalized || navigating) return;
    setNavigating(true);
    // The finder app resolves any single path segment as a tag id (/:tagId).
    navigate(`/${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="flex items-center gap-2 mb-4">
            <QrCode size={22} className="text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900">Find a Pet's Owner</h1>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Enter the tag ID printed on the pet's PawTag. You can find it on the back of the tag —
            no app or account needed.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="tag-id" className="block text-xs font-medium text-gray-500 mb-1">
              Tag ID
            </label>
            <input
              id="tag-id"
              type="text"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              placeholder="PT-123456"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={32}
              className="w-full text-center border border-gray-300 rounded-lg px-4 py-3 text-base font-mono tracking-widest text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={!tagId.trim() || navigating}
              className="mt-4 w-full bg-primary-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
            >
              {navigating ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Looking up tag…
                </>
              ) : (
                <>
                  <Search size={18} /> Find Pet
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
          <strong>Where to find your tag ID:</strong> Look for the code starting with "PT-"
          printed on the back of the pet's PawTag.
        </p>
      </div>
    </div>
  );
}
