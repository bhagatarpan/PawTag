/**
 * Storage Configuration
 *
 * Centralizes storage-related configuration and validation rules.
 * Reads from environment variables with sensible defaults.
 */

export type StorageDriver = 'local' | 'r2';

export interface UploadValidationRule {
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  maxFiles?: number;
}

/**
 * Get the configured storage driver from environment
 */
export function getStorageDriver(): StorageDriver {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  if (driver === 'r2') return 'r2';
  return 'local';
}

/**
 * Get the local uploads root directory
 */
export function getLocalUploadsDir(): string {
  return process.env.LOCAL_UPLOADS_DIR || 'uploads';
}

/**
 * R2 configuration from environment
 */
export const r2Config = {
  get endpoint(): string { return process.env.R2_ENDPOINT || ''; },
  get accessKeyId(): string { return process.env.R2_ACCESS_KEY_ID || ''; },
  get secretAccessKey(): string { return process.env.R2_SECRET_ACCESS_KEY || ''; },
  get bucketName(): string { return process.env.R2_BUCKET_NAME || ''; },
  get publicUrl(): string { return process.env.R2_PUBLIC_URL || ''; },
};

/**
 * Check if R2 credentials are configured
 */
export function isR2Configured(): boolean {
  return !!(
    r2Config.accessKeyId &&
    r2Config.secretAccessKey &&
    r2Config.bucketName &&
    r2Config.endpoint
  );
}

/**
 * Upload validation rules per purpose
 */
export const uploadValidation: Record<string, UploadValidationRule> = {
  'pet-photo': {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
    ],
    maxFiles: 1,
  },
  'profile-picture': {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
    ],
    maxFiles: 1,
  },
  'product-image': {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
    ],
    maxFiles: 5,
  },
  'cms-media': {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/avif',
      'video/mp4',
      'video/webm',
      'application/pdf',
    ],
    maxFiles: 10,
  },
};

/**
 * Generate a unique filename for storage
 * @param originalFilename - Original filename from user
 * @returns Unique filename with same extension
 */
export function generateUniqueFilename(originalFilename: string): string {
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = originalFilename.includes('.')
    ? originalFilename.split('.').pop()
    : 'jpg';
  return `${uniquePrefix}.${ext}`;
}
