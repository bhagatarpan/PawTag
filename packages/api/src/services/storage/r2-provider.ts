/**
 * R2 Storage Provider
 *
 * Cloudflare R2 implementation of the StorageProvider interface.
 * Wraps the existing r2.service.ts to maintain backward compatibility.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logIntegration } from '../../lib/timing';
import logger from '../../lib/logger';
import { r2Config } from './config';
import type { StorageProvider, UploadResult, DeleteResult } from './storage-provider';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: r2Config.endpoint,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export class R2StorageProvider implements StorageProvider {
  readonly name = 'r2';

  isConfigured(): boolean {
    return !!(
      r2Config.accessKeyId &&
      r2Config.secretAccessKey &&
      r2Config.bucketName &&
      r2Config.endpoint
    );
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    return logIntegration('CloudflareR2', 'upload', async () => {
      const client = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: r2Config.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      const url = `${r2Config.publicUrl}/${key}`;
      logger.info({ key, contentType, size: buffer.length }, 'R2 upload successful');

      return { url, key, filename: key.split('/').pop() || key };
    }, { key, contentType, size: buffer.length });
  }

  async delete(key: string): Promise<DeleteResult> {
    return logIntegration('CloudflareR2', 'delete', async () => {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: r2Config.bucketName,
          Key: key,
        }),
      );

      logger.info({ key }, 'R2 delete successful');
      return { success: true, key };
    }, { key });
  }

  getUrl(key: string): string {
    return `${r2Config.publicUrl}/${key}`;
  }

  /**
   * Generate a presigned URL for private file access
   * @param key - Object key
   * @param expiresIn - URL expiration in seconds (default: 3600)
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: r2Config.bucketName,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }
}
