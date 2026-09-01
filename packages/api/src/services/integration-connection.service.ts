/**
 * @module Integration Connection Service
 * @description Handles encryption/decryption of sensitive OAuth tokens
 * and CRUD operations for IntegrationConnection records.
 *
 * Encryption uses AES-256-GCM with a key derived from `JWT_SECRET`.
 * The same encryption is used for both the IntegrationConnection model
 * and the CMS setting backup (`commerce.accounting.xeroRefreshToken`).
 */

import crypto from 'crypto';
import { IntegrationConnection } from '@pawtag/db';
import { getSetting, updateSetting } from '../commerce/config';
import logger from '../lib/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from JWT_SECRET using SHA-256.
 * For production, JWT_SECRET should be at least 32 characters.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'pawtag-default-dev-secret-do-not-use-in-prod';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a token. Returns base64-encoded ciphertext.
 * Format: base64(iv + authTag + encryptedData)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a base64-encoded token.
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Get a connection by provider and tenant.
 */
export async function getConnection(provider: string, tenantId: string) {
  return IntegrationConnection.findOne({ provider, tenantId, status: 'active' });
}

/**
 * Get all active connections for a provider.
 */
export async function getActiveConnections(provider: string) {
  return IntegrationConnection.find({ provider, status: 'active' });
}

/**
 * Delete a connection.
 */
export async function deleteConnection(provider: string, tenantId: string): Promise<void> {
  await IntegrationConnection.findOneAndUpdate(
    { provider, tenantId },
    { status: 'revoked' },
  );
  logger.info({ provider, tenantId }, 'Integration connection revoked');
}

/**
 * Get decrypted access token for a provider.
 * Returns null if no active connection exists.
 */
export async function getAccessToken(provider: string, tenantId: string): Promise<string | null> {
  const conn = await getConnection(provider, tenantId);
  if (!conn) return null;
  if (conn.status !== 'active') return null;
  try {
    return decryptToken(conn.accessToken);
  } catch (err) {
    logger.error({ err, provider, tenantId }, 'Failed to decrypt access token');
    return null;
  }
}

/**
 * Backup a refresh token to the CMS setting.
 */
export async function backupRefreshToken(provider: string, encryptedToken: string, actor: string): Promise<void> {
  const key = `commerce.accounting.${provider}RefreshToken` as any;
  await updateSetting(key, encryptedToken, actor);
}

/**
 * Retrieve a backup refresh token from CMS setting.
 */
export async function getBackupRefreshToken(provider: string): Promise<string | null> {
  const key = `commerce.accounting.${provider}RefreshToken` as any;
  const token = await getSetting(key).catch(() => '');
  return token || null;
}
