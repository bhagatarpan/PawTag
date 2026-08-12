import crypto from 'crypto';
import { Setting, Tag } from '@pawtag/db';

const DEFAULT_PREFIX = 'PT';
const TAG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
const TAG_LENGTH = 8;

/**
 * Read the tag ID prefix from CMS settings (tag.idPrefix).
 * Falls back to DEFAULT_PREFIX if the setting doesn't exist.
 */
async function getTagPrefix(): Promise<string> {
  try {
    const setting = await Setting.findOne({ key: 'tag.idPrefix' }).lean();
    if (setting?.value && typeof setting.value === 'string') {
      return setting.value.trim().toUpperCase();
    }
  } catch {
    // Setting collection may not exist yet during bootstrap
  }
  return DEFAULT_PREFIX;
}

/**
 * Generate a cryptographically secure random tag ID.
 * Format: {PREFIX}-{XXXXXXXX} (8 alphanumeric chars, ~2.8T combinations)
 */
function randomTagId(prefix: string): string {
  const bytes = crypto.randomBytes(TAG_LENGTH);
  let id = '';
  for (let i = 0; i < TAG_LENGTH; i++) {
    id += TAG_CHARS[bytes[i] % TAG_CHARS.length];
  }
  return `${prefix}-${id}`;
}

/**
 * Generate a unique tag ID. Retries up to 10 times on collision.
 */
export async function generateTagId(): Promise<string> {
  const prefix = await getTagPrefix();
  let tagId: string;
  let attempts = 0;
  do {
    tagId = randomTagId(prefix);
    attempts++;
  } while (await Tag.findOne({ tagId }) && attempts < 10);
  return tagId;
}

/**
 * Validate a tag ID. Accepts both old format (PT-NNNNNN) and new format (PT-XXXXXXXX).
 */
export async function isValidTagId(tagId: string): Promise<boolean> {
  const prefix = await getTagPrefix();
  // New format: PT-XXXXXXXX (8 alphanumeric)
  const newRegex = new RegExp(`^${prefix}-[A-Z2-9]{${TAG_LENGTH}}$`);
  if (newRegex.test(tagId.toUpperCase())) return true;
  // Legacy format: PT-NNNNNN (6 digits) — still valid for existing tags
  const legacyRegex = new RegExp(`^${prefix}-\\d{6}$`);
  return legacyRegex.test(tagId);
}

/**
 * Get the current tag ID format description for error messages.
 */
export async function getTagIdFormat(): Promise<string> {
  const prefix = await getTagPrefix();
  return `${prefix}-${'X'.repeat(TAG_LENGTH)}`;
}
