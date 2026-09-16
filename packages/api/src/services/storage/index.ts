/**
 * Storage Service
 *
 * Unified file storage abstraction for PawTag.
 * Supports local development storage and Cloudflare R2 production storage.
 *
 * Usage:
 *   import { uploadMedia, deleteMedia, getMediaUrl } from '../services/storage';
 *
 *   // Upload
 *   const result = await uploadMedia('pet-photo', 'photo.jpg', buffer, 'image/jpeg', { petId: '123' });
 *
 *   // Get URL
 *   const url = getMediaUrl(result.key);
 *
 *   // Delete
 *   await deleteMedia(result.key);
 */

export {
  uploadMedia,
  deleteMedia,
  getMediaUrl,
  isStorageConfigured,
  getActiveDriver,
  getStorageProvider,
} from './media-service';

export type { StorageProvider, UploadResult, DeleteResult } from './storage-provider';

export {
  getStorageDriver,
  isR2Configured,
  generateUniqueFilename,
  uploadValidation,
} from './config';

export type { StorageDriver, UploadValidationRule } from './config';
