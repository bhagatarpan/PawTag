/**
 * Storage Provider Interface
 *
 * Abstracts file storage operations behind a common interface.
 * Implementations: LocalStorageProvider, R2StorageProvider.
 */

export interface UploadResult {
  url: string;
  key: string;
  filename: string;
}

export interface DeleteResult {
  success: boolean;
  key: string;
}

export interface StorageProvider {
  readonly name: string;

  /**
   * Upload a file buffer to storage
   * @param key - Object key (e.g., 'pets/abc123.jpg')
   * @param buffer - File content
   * @param contentType - MIME type
   * @returns Upload result with public URL
   */
  upload(key: string, buffer: Buffer, contentType: string): Promise<UploadResult>;

  /**
   * Delete a file from storage
   * @param key - Object key to delete
   */
  delete(key: string): Promise<DeleteResult>;

  /**
   * Get a URL for accessing a stored file
   * @param key - Object key
   * @returns Public or signed URL
   */
  getUrl(key: string): string;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;
}
