/**
 * @module Xero Accounting Exporter
 * @description Connects to Xero via OAuth 2.0 and creates Manual Journals
 * for refund transactions.
 *
 * Flow:
 * 1. Admin clicks "Connect to Xero" → redirect to Xero OAuth
 * 2. Admin authorises → callback stores tokens in IntegrationConnection + CMS setting
 * 3. Admin exports refunds → exporter uses stored tokens to create journals in Xero
 *
 * Configuration via env:
 * - XERO_CLIENT_ID
 * - XERO_CLIENT_SECRET
 * - XERO_REDIRECT_URI
 *
 * Tokens stored in:
 * - IntegrationConnection model (primary)
 * - commerce.accounting.xeroRefreshToken CMS setting (backup)
 */

import { IntegrationConnection } from '@pawtag/db';
import { encryptToken, decryptToken } from '../../services/integration-connection.service';
import { getSetting, updateSetting } from '../../commerce/config';
import logger from '../../lib/logger';

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

const XERO_SCOPES = [
  'accounting.transactions',
  'accounting.contacts',
  'offline_access',
].join(' ');

export interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId: string;
  tenantName?: string;
}

export interface XeroExportRow {
  refundId: string;
  orderNumber: string;
  amount: number;
  description: string;
  date: Date;
}

/**
 * Build the Xero OAuth authorization URL.
 */
export function buildXeroAuthUrl(state: string): string {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('XERO_CLIENT_ID and XERO_REDIRECT_URI must be configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: XERO_SCOPES,
    state,
  });

  return `${XERO_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the OAuth code for tokens.
 */
export async function exchangeXeroCode(code: string, userId: string): Promise<XeroTokens> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Xero credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Xero token exchange failed: ${err}`);
  }

  const tokenData: any = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 1800) * 1000);

  // Get tenant connections to find the tenant ID
  const connRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!connRes.ok) {
    throw new Error('Failed to fetch Xero connections');
  }
  const connections: any[] = await connRes.json();
  if (!connections.length) {
    throw new Error('No Xero organisation connected. Please connect an organisation to Xero.');
  }
  const tenantId = connections[0].tenantId;
  const tenantName = connections[0].tenantName;

  // Store tokens in IntegrationConnection model
  await IntegrationConnection.findOneAndUpdate(
    { provider: 'xero', tenantId },
    {
      provider: 'xero',
      tenantId,
      tenantName,
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: encryptToken(tokenData.refresh_token),
      expiresAt,
      scopes: XERO_SCOPES.split(' '),
      connectedBy: userId,
      connectedAt: new Date(),
      status: 'active',
    },
    { upsert: true, new: true },
  );

  // Also store refresh token in CMS setting as backup
  await updateSetting('commerce.accounting.xeroRefreshToken' as any, encryptToken(tokenData.refresh_token), userId);

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    tenantId,
    tenantName,
  };
}

/**
 * Refresh an expired Xero access token.
 */
export async function refreshXeroToken(refreshToken: string, tenantId: string): Promise<XeroTokens> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Xero credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xero token refresh failed: ${err}`);
  }

  const data: any = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 1800) * 1000);

  // Update IntegrationConnection
  await IntegrationConnection.findOneAndUpdate(
    { provider: 'xero', tenantId },
    {
      accessToken: encryptToken(data.access_token),
      refreshToken: encryptToken(data.refresh_token),
      expiresAt,
      lastSyncedAt: new Date(),
      status: 'active',
    },
  );

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tenantId,
  };
}

/**
 * Get a valid access token, refreshing if expired.
 */
export async function getXeroAccessToken(): Promise<{ token: string; tenantId: string } | null> {
  // Try IntegrationConnection first
  let conn = await IntegrationConnection.findOne({ provider: 'xero', status: 'active' });
  if (!conn) {
    // Fall back to CMS setting (legacy/backup)
    const refreshTokenEncrypted = await getSetting('commerce.accounting.xeroRefreshToken').catch(() => '');
    if (!refreshTokenEncrypted) return null;
    // We don't have a tenantId in the CMS setting path, so we'd need a default tenant
    return null;
  }

  if (conn.expiresAt <= new Date()) {
    // Refresh
    const refreshToken = decryptToken(conn.refreshToken);
    const newTokens = await refreshXeroToken(refreshToken, conn.tenantId);
    return { token: newTokens.accessToken, tenantId: conn.tenantId };
  }

  return { token: decryptToken(conn.accessToken), tenantId: conn.tenantId };
}

/**
 * Check if Xero is connected.
 */
export async function isXeroConnected(): Promise<boolean> {
  const conn = await IntegrationConnection.findOne({ provider: 'xero', status: 'active' });
  return !!conn;
}

/**
 * Disconnect from Xero.
 */
export async function disconnectXero(): Promise<void> {
  await IntegrationConnection.updateMany(
    { provider: 'xero' },
    { status: 'revoked' },
  );
}

/**
 * Create Manual Journals in Xero for the given refund rows.
 */
export async function exportRefundsToXero(rows: XeroExportRow[]): Promise<{
  success: boolean;
  created: number;
  failed: number;
  errors: string[];
}> {
  const tokenInfo = await getXeroAccessToken();
  if (!tokenInfo) {
    return { success: false, created: 0, failed: rows.length, errors: ['Xero not connected'] };
  }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const journalLine = {
        Description: row.description,
        TaxType: 'OUTPUT',
        LineAmount: -row.amount,
      };

      const res = await fetch(`${XERO_API_BASE}/ManualJournals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenInfo.token}`,
          'Xero-Tenant-Id': tokenInfo.tenantId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ManualJournals: [{
            Narration: row.description,
            Date: row.date.toISOString().split('T')[0],
            Status: 'POSTED',
            JournalLines: [journalLine],
          }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        failed++;
        errors.push(`Row ${row.refundId}: ${res.status} ${errText}`);
        logger.error({ err: errText, refundId: row.refundId }, 'Xero journal creation failed');
      } else {
        created++;
        logger.info({ refundId: row.refundId }, 'Xero journal created');
      }
    } catch (err: any) {
      failed++;
      errors.push(`Row ${row.refundId}: ${err.message}`);
      logger.error({ err, refundId: row.refundId }, 'Xero export error');
    }
  }

  return { success: failed === 0, created, failed, errors };
}
