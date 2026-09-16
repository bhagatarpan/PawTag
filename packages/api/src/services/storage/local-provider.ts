/**
 * Local Storage Provider
 *
 * Local filesystem implementation of the StorageProvider interface.
 * Used for development when R2 is not configured.
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../../lib/logger';
import { getLocalUploadsDir } from './config';
import type { StorageProvider, UploadResult, DeleteResult } from './storage-provider';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private get uploadsDir(): string {
    return path.resolve(getLocalUploadsDir());
  }

  isConfigured(): boolean {
    // Local storage is always available
    return true;
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<UploadResult> {
    const filePath = path.join(this.uploadsDir, key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);

    const filename = path.basename(key);
    const url = `/api/uploads/${key}`;

    logger.info({ key, size: buffer.length }, 'Local upload successful');

    return { url, key, filename };
  }

  async delete(key: string): Promise<DeleteResult> {
    const filePath = path.join(this.uploadsDir, key);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info({ key }, 'Local delete successful');
      } else {
        logger.warn({ key }, 'Local file not found for deletion');
      }
      return { success: true, key };
    } catch (err) {
      logger.error({ err, key }, 'Local delete failed');
      return { success: false, key };
    }
  }

  getUrl(key: string): string {
    return `/api/uploads/${key}`;
  }
}
