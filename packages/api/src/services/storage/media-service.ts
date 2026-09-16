/**
 * Media Service
 *
 * Central service for all file upload, delete, and URL operations.
 * Routes to the appropriate storage provider based on STORAGE_DRIVER config.
 */

import { getStorageDriver, isR2Configured, generateUniqueFilename } from './config';
import { R2StorageProvider } from './r2-provider';
import { LocalStorageProvider } from './local-provider';
import type { StorageProvider, UploadResult, DeleteResult } from './storage-provider';
import logger from '../../lib/logger';

// Singleton providers
let r2Provider: R2StorageProvider | null = null;
let localProvider: LocalStorageProvider | null = null;

function getR2Provider(): R2StorageProvider {
  if (!r2Provider) {
    r2Provider = new R2StorageProvider();
  }
  return r2Provider;
}

function getLocalProvider(): LocalStorageProvider {
  if (!localProvider) {
    localProvider = new LocalStorageProvider();
  }
  return localProvider;
}

/**
 * Get the active storage provider based on configuration
 */
export function getStorageProvider(): StorageProvider {
  const driver = getStorageDriver();

  if (driver === 'r2') {
    if (!isR2Configured()) {
      throw new Error(
        'STORAGE_DRIVER is set to "r2" but R2 environment variables are not configured. ' +
        'Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_ENDPOINT.'
      );
    }
    return getR2Provider();
  }

  // Default to local storage
  return getLocalProvider();
}

/**
 * Upload a file to the configured storage provider
 *
 * @param purpose - Upload purpose (pet-photo, profile-picture, product-image, cms-media)
 * @param originalFilename - Original filename from user
 * @param buffer - File content
 * @param contentType - MIME type
 * @param context - Optional context (petId, userId, productId) for organized key structure
 * @returns Upload result with URL
 */
export async function uploadMedia(
  purpose: string,
  originalFilename: string,
  buffer: Buffer,
  contentType: string,
  context?: { petId?: string; userId?: string; productId?: string; folder?: string },
): Promise<UploadResult> {
  const provider = getStorageProvider();
  const filename = generateUniqueFilename(originalFilename);
  const key = buildKey(purpose, filename, context);

  logger.info({ purpose, key, size: buffer.length, provider: provider.name }, 'Upload started');

  const result = await provider.upload(key, buffer, contentType);

  logger.info({ purpose, key, url: result.url }, 'Upload completed');

  return result;
}

/**
 * Delete a file from the configured storage provider
 */
export async function deleteMedia(key: string): Promise<DeleteResult> {
  const provider = getStorageProvider();

  logger.info({ key, provider: provider.name }, 'Delete started');

  const result = await provider.delete(key);

  logger.info({ key, success: result.success }, 'Delete completed');

  return result;
}

/**
 * Get a URL for accessing a stored file
 */
export function getMediaUrl(key: string): string {
  const provider = getStorageProvider();
  return provider.getUrl(key);
}

/**
 * Check if storage is properly configured
 */
export function isStorageConfigured(): boolean {
  try {
    const provider = getStorageProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Get the active storage driver name
 */
export function getActiveDriver(): string {
  return getStorageDriver();
}

/**
 * Build an organized object key based on purpose and context
 */
function buildKey(
  purpose: string,
  filename: string,
  context?: { petId?: string; userId?: string; productId?: string; folder?: string },
): string {
  switch (purpose) {
    case 'pet-photo': {
      const petDir = context?.petId || 'unknown';
      return `pets/${petDir}/${filename}`;
    }
    case 'profile-picture': {
      const userDir = context?.userId || 'unknown';
      return `avatars/${userDir}/${filename}`;
    }
    case 'product-image': {
      const productDir = context?.productId || 'unknown';
      return `products/${productDir}/${filename}`;
    }
    case 'cms-media': {
      const folder = context?.folder || 'general';
      return `cms/${folder}/${filename}`;
    }
    default:
      return `misc/${filename}`;
  }
}
