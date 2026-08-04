import { useState } from 'react';
import api from '../lib/api';

export default function WriteNfcTag() {
  const [tagId, setTagId] = useState('');
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tagInfo, setTagInfo] = useState<any>(null);

  const lookupTag = async () => {
    if (!tagId.trim()) return;
    setError('');
    setSuccess('');
    setTagInfo(null);
    setLoading(true);

    try {
      const res = await api.get(`/admin/tags?search=${tagId.trim().toUpperCase()}`);
      const tags = res.data.data;
      const found = tags.find((t: any) => t.tagId === tagId.trim().toUpperCase());
      if (found) {
        setTagInfo(found);
      } else {
        setError('Tag not found in the database');
      }
    } catch {
      setError('Failed to look up tag');
    } finally {
      setLoading(false);
    }
  };

  const writeNfcTag = async () => {
    if (!tagInfo) return;
    setWriting(true);
    setError('');
    setSuccess('');

    try {
      // Check Web NFC support
      if (!('NDEFReader' in window)) {
        setError('Web NFC is not supported in this browser. Use Chrome on Android.');
        setWriting(false);
        return;
      }

      const ndef = new (window as any).NDEFReader();
      await ndef.scan();

      // Build the finder URL
      const baseUrl = window.location.origin;
      const finderUrl = `${baseUrl}/finder/${tagInfo.tagId}`;

      // Write the URL to the NFC tag
      await ndef.write({
        records: [{ recordType: 'url', data: finderUrl }],
      });

      // Update the tag in the database
      await api.put(`/admin/tags/${tagInfo._id}`, { nfcEnabled: true });

      setSuccess(`NFC tag written successfully! Tag ${tagInfo.tagId} is now NFC-enabled.`);
      setTagInfo({ ...tagInfo, nfcEnabled: true });
    } catch (err: any) {
      if (err.message?.includes('permission')) {
        setError('NFC permission denied. Please allow NFC access and try again.');
      } else {
        setError(`Failed to write NFC tag: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setWriting(false);
    }
  };

  // Check if Web NFC is supported
  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Write NFC Tag</h1>

      {/* Browser compatibility notice */}
      <div className={`p-4 rounded-lg mb-6 ${nfcSupported ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-start gap-3">
          <div className={`text-2xl ${nfcSupported ? 'text-green-600' : 'text-amber-600'}`}>
            {nfcSupported ? '✓' : '⚠'}
          </div>
          <div>
            <p className={`font-medium ${nfcSupported ? 'text-green-800' : 'text-amber-800'}`}>
              {nfcSupported ? 'NFC Supported' : 'NFC Not Supported'}
            </p>
            <p className={`text-sm mt-1 ${nfcSupported ? 'text-green-700' : 'text-amber-700'}`}>
              {nfcSupported
                ? 'Your browser supports Web NFC. You can write NFC tags.'
                : 'NFC writing requires Chrome on Android. This feature is not available on iOS, Safari, or Firefox.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tag lookup */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">1. Look Up Tag</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            placeholder="Enter tag ID (e.g. PT-123456)"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 font-mono"
            onKeyDown={(e) => e.key === 'Enter' && lookupTag()}
          />
          <button
            onClick={lookupTag}
            disabled={loading || !tagId.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Looking up...' : 'Look Up'}
          </button>
        </div>

        {tagInfo && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Tag ID</p>
                <p className="font-mono font-bold">{tagInfo.tagId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="capitalize">{tagInfo.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">NFC Enabled</p>
                <p className={tagInfo.nfcEnabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {tagInfo.nfcEnabled ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Owner</p>
                <p>{tagInfo.ownerId ? 'Claimed' : 'Unclaimed'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NFC write */}
      {tagInfo && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. Write NFC Tag</h2>
          <p className="text-sm text-gray-600 mb-4">
            Place a blank NFC tag against your Android device, then click the button below.
            The tag will be programmed with the finder URL: <code className="bg-gray-100 px-1 rounded">/finder/{tagInfo.tagId}</code>
          </p>

          {tagInfo.nfcEnabled ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">This tag is already NFC-enabled.</p>
              <p className="text-sm text-green-700 mt-1">You can rewrite it if needed.</p>
            </div>
          ) : null}

          <button
            onClick={writeNfcTag}
            disabled={writing || !nfcSupported}
            className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {writing ? 'Writing... Hold tag against device' : 'Write NFC Tag'}
          </button>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold mb-3">Instructions</h3>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Enter the tag ID from the physical PawTag</li>
          <li>Click "Look Up" to verify the tag exists in the database</li>
          <li>Place a blank NFC tag against your Android device</li>
          <li>Click "Write NFC Tag" and wait for the write to complete</li>
          <li>Test by tapping the written NFC tag against another NFC-enabled Android phone</li>
          <li>The tag should open the finder page for that tag</li>
        </ol>
        <p className="text-xs text-gray-500 mt-4">
          <strong>Note:</strong> NFC writing requires Chrome on Android. This feature is not available on iOS, Safari, or Firefox. QR codes work on all devices as a fallback.
        </p>
      </div>
    </div>
  );
}
