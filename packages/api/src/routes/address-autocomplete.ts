import { Router, Request, Response } from 'express';
import { Setting } from '@pawtag/db';
import { writeLog } from '../lib/log-writer';

const router = Router();

interface PhotonFeature {
  properties: {
    housenumber?: string;
    street?: string;
    name?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
}

interface NormalizedAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// Settings cache (60s TTL)
let settingsCache: Record<string, string> = {};
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60_000;

// NZ Post OAuth token cache
let nzpostToken: string | null = null;
let nzpostTokenExpiry = 0;

async function getSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (settingsCacheTime && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }

  const keys = [
    'addressAutocomplete.provider',
    'addressAutocomplete.nzpostClientId',
    'addressAutocomplete.nzpostClientSecret',
    'addressAutocomplete.defaultCountry',
  ];

  const settings = await Setting.find({ key: { $in: keys } }).lean();
  settingsCache = {};
  for (const s of settings) {
    settingsCache[s.key] = s.value;
  }
  settingsCacheTime = now;
  return settingsCache;
}

async function getNzpostToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 5-minute buffer)
  if (nzpostToken && now < nzpostTokenExpiry - 300_000) {
    return nzpostToken;
  }

  // Fetch new token using OAuth 2.0 Client Credentials
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://oauth.nzpost.co.nz/as/token.oauth2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  nzpostToken = data.access_token as string;
  nzpostTokenExpiry = now + (data.expires_in || 86399) * 1000;

  return nzpostToken;
}

function mapPhotonToAddress(feature: PhotonFeature): NormalizedAddress {
  const p = feature.properties;
  return {
    line1: [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '',
    line2: p.district || '',
    city: p.city || '',
    state: p.state || '',
    zip: p.postcode || '',
    country: (p.countrycode || 'NZ').toUpperCase(),
  };
}

function parseNzpostAddress(fullAddress: string): NormalizedAddress {
  const parts = fullAddress.split(',').map((p) => p.trim());

  if (parts.length === 1) {
    return { line1: parts[0], line2: '', city: '', state: '', zip: '', country: 'NZ' };
  }

  const lastPart = parts[parts.length - 1];
  const postcodeMatch = lastPart.match(/\s+(\d{4})$/);
  const city = postcodeMatch ? lastPart.slice(0, -postcodeMatch[1].length).trim() : lastPart;
  const zip = postcodeMatch ? postcodeMatch[1] : '';

  const streetParts = parts.slice(0, -1);
  const line1 = streetParts.join(', ');

  return { line1, line2: '', city, state: '', zip, country: 'NZ' };
}

router.get('/suggest', async (req: Request, res: Response) => {
  try {
    const { q, limit = '5' } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.json({ success: true, addresses: [] });
      return;
    }

    const settings = await getSettings();
    const provider = settings['addressAutocomplete.provider'] || 'nzpost';
    const defaultCountry = settings['addressAutocomplete.defaultCountry'] || 'NZ';

    if (provider === 'nzpost') {
      const clientId = settings['addressAutocomplete.nzpostClientId'];
      const clientSecret = settings['addressAutocomplete.nzpostClientSecret'];

      if (!clientId || !clientSecret) {
        res.status(500).json({ success: false, error: 'NZ Post credentials not configured. Please set Client ID and Client Secret in Admin → Address Autocomplete.' });
        return;
      }

      try {
        const token = await getNzpostToken(clientId, clientSecret);

        const params = new URLSearchParams({
          q: q.trim(),
          max: limit.toString(),
        });
        const apiUrl = `https://api.nzpost.co.nz/addresschecker/1.0/suggest?${params}`;
        const startTime = Date.now();
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        const responseText = await response.text();
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(responseText);
        } catch {
          writeLog({ level: 50, time: Date.now(), msg: 'NZ Post API returned non-JSON', provider: 'nzpost', operation: 'address.suggest', statusCode: response.status });
          res.status(502).json({ success: false, error: 'NZ Post API returned invalid response' });
          return;
        }

        const durationMs = Date.now() - startTime;
        writeLog({
          level: response.ok ? 30 : 40,
          time: Date.now(),
          msg: 'NZ Post Address API request',
          provider: 'nzpost',
          operation: 'address.suggest',
          query: q.trim(),
          statusCode: response.status,
          success: data.success,
          addressCount: ((data.addresses as unknown[]) || []).length,
          durationMs,
        });

        if (!response.ok || !data.success) {
          writeLog({ level: 40, time: Date.now(), msg: 'NZ Post Address API error', provider: 'nzpost', operation: 'address.suggest', errors: data.errors, response: data });
          res.status(502).json({ success: false, error: 'NZ Post API error', details: data.errors || data });
          return;
        }

        const addresses = ((data.addresses as Array<{ FullAddress: string; DPID: number }>) || []).map((addr) => ({
          ...parseNzpostAddress(addr.FullAddress),
          dpid: addr.DPID,
        }));

        res.json({ success: true, addresses });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        writeLog({ level: 50, time: Date.now(), msg: 'Failed to call NZ Post API', provider: 'nzpost', operation: 'address.suggest', err: { message: errMsg } });

        if (errMsg.includes('unauthorized_client')) {
          res.status(502).json({ success: false, error: 'NZ Post OAuth error: Client Credentials grant type not enabled. Contact NZ Post API Support (api@nzpost.co.nz).' });
        } else if (errMsg.includes('invalid_client')) {
          res.status(502).json({ success: false, error: 'NZ Post OAuth error: Invalid client credentials. Check your Client ID and Client Secret.' });
        } else {
          res.status(502).json({ success: false, error: 'Failed to reach NZ Post API' });
        }
      }
    } else {
      // Photon (OpenStreetMap) - free, no key needed
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          limit: limit.toString(),
          lang: 'en',
          countrycode: defaultCountry,
        });
        const startTime = Date.now();
        const response = await fetch(`https://photon.komoot.io/api/?${params}`);
        const data = await response.json();
        const durationMs = Date.now() - startTime;
        writeLog({
          level: 30,
          time: Date.now(),
          msg: 'Photon Address API request',
          provider: 'photon',
          operation: 'address.suggest',
          query: q.trim(),
          statusCode: response.status,
          addressCount: (data.features || []).length,
          durationMs,
        });
        const addresses = (data.features || []).map(mapPhotonToAddress);
        res.json({ success: true, addresses });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        writeLog({ level: 50, time: Date.now(), msg: 'Failed to call Photon API', provider: 'photon', operation: 'address.suggest', err: { message: errMsg } });
        res.status(502).json({ success: false, error: 'Failed to reach Photon API' });
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Invalidate cache when settings are updated
router.post('/invalidate-cache', async (_req: Request, res: Response) => {
  settingsCacheTime = 0;
  settingsCache = {};
  nzpostToken = null;
  nzpostTokenExpiry = 0;
  res.json({ success: true });
});

export default router;
