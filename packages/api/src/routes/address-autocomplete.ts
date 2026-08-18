import { Router, Request, Response } from 'express';
import { Setting } from '@pawtag/db';
import logger from '../lib/logger';

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

  logger.info('Fetching NZ Post OAuth token...');
  const response = await fetch('https://oauth.nzpost.co.nz/as/token.oauth2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'NZ Post OAuth failed');
    throw new Error(`NZ Post OAuth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  nzpostToken = data.access_token as string;
  nzpostTokenExpiry = now + (data.expires_in || 86399) * 1000;
  logger.info('NZ Post OAuth token obtained successfully');

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
  // NZ Post returns a full address string like:
  // "8 Water Lane, New Plymouth 4310"
  // or "392 Ellerslie-Panmure Highway, Mount Wellington, Auckland 1060"
  const parts = fullAddress.split(',').map((p) => p.trim());

  if (parts.length === 1) {
    return { line1: parts[0], line2: '', city: '', state: '', zip: '', country: 'NZ' };
  }

  // Last part contains city and postcode (e.g., "New Plymouth 4310")
  const lastPart = parts[parts.length - 1];
  const postcodeMatch = lastPart.match(/\s+(\d{4})$/);
  const city = postcodeMatch ? lastPart.slice(0, -postcodeMatch[1].length).trim() : lastPart;
  const zip = postcodeMatch ? postcodeMatch[1] : '';

  // Everything before the last part is the street address
  const streetParts = parts.slice(0, -1);
  const line1 = streetParts.join(', ');

  return {
    line1,
    line2: '',
    city,
    state: '',
    zip,
    country: 'NZ',
  };
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
        // Get OAuth token
        const token = await getNzpostToken(clientId, clientSecret);

        const params = new URLSearchParams({
          q: q.trim(),
          max: limit.toString(),
        });
        const apiUrl = `https://api.nzpost.co.nz/addresschecker/1.0/suggest?${params}`;
        logger.info({ query: q.trim(), apiUrl }, 'Calling NZ Post Address API');
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();
        logger.info({ status: response.status, success: data.success, addressCount: (data.addresses || []).length, errors: data.errors }, 'NZ Post API response');

        if (!data.success) {
          res.status(502).json({ success: false, error: 'NZ Post API error', details: data.errors });
          return;
        }

        const addresses = (data.addresses || []).map((addr: { FullAddress: string; DPID: number }) => ({
          ...parseNzpostAddress(addr.FullAddress),
          dpid: addr.DPID,
        }));

        res.json({ success: true, addresses });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error({ error: errMsg }, 'Failed to call NZ Post API');
        // If OAuth fails with unauthorized_client, suggest switching to Photon
        if (errMsg.includes('unauthorized_client')) {
          res.status(502).json({
            success: false,
            error: 'NZ Post OAuth error: Client Credentials grant type not enabled. Contact NZ Post API Support (api@nzpost.co.nz) to enable it, or switch to Photon provider in Admin → Address Autocomplete.',
          });
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
        const response = await fetch(`https://photon.komoot.io/api/?${params}`);
        const data = await response.json();
        const addresses = (data.features || []).map(mapPhotonToAddress);
        res.json({ success: true, addresses });
      } catch (err) {
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
