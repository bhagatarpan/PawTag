import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logIntegration } from '../lib/timing';
import logger from '../lib/logger';

const r2Config = {
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
};

const r2Client = new S3Client(r2Config);
const bucketName = process.env.R2_BUCKET_NAME || '';
const publicUrl = process.env.R2_PUBLIC_URL || '';

/**
 * Upload a file buffer to R2
 * @param key - The object key (e.g., 'pets/filename.jpg')
 * @param buffer - The file buffer
 * @param contentType - The MIME type
 * @returns The public URL of the uploaded file
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  return logIntegration('CloudflareR2', 'upload', async () => {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return `${publicUrl}/${key}`;
  }, { key, contentType, size: buffer.length });
}

/**
 * Delete a file from R2
 * @param key - The object key to delete
 */
export async function deleteFromR2(key: string): Promise<void> {
  return logIntegration('CloudflareR2', 'delete', async () => {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
  }, { key });
}

/**
 * Get a presigned URL for downloading a file from R2
 * @param key - The object key
 * @param expiresIn - URL expiration in seconds (default: 3600)
 * @returns The presigned URL
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generate a unique filename for R2
 * @param originalFilename - The original filename
 * @returns A unique filename with the same extension
 */
export function generateUniqueFilename(originalFilename: string): string {
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = originalFilename.includes('.') ? originalFilename.split('.').pop() : 'jpg';
  return `${uniquePrefix}.${ext}`;
}

/**
 * Check if R2 is configured
 * @returns true if R2 credentials are set
 */
export function isR2Configured(): boolean {
  return !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_ENDPOINT);
}
