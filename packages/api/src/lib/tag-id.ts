import { Setting, Tag } from '@pawtag/db';

const DEFAULT_PREFIX = 'PT';
const DEFAULT_DIGITS = 6;

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
 * Generate a random tag ID using the DB-configured prefix.
 * Format: {PREFIX}-{NNNNNN}  (6 random digits, range 100000–999999)
 */
function randomTagId(prefix: string): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${digits}`;
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
 * Validate a custom tag ID against the current DB-configured prefix.
 * Format: {PREFIX}-{NNNNNN}
 */
export async function isValidTagId(tagId: string): Promise<boolean> {
  const prefix = await getTagPrefix();
  const regex = new RegExp(`^${prefix}-\\d{${DEFAULT_DIGITS}}$`);
  return regex.test(tagId);
}

/**
 * Get the current tag ID format description for error messages.
 */
export async function getTagIdFormat(): Promise<string> {
  const prefix = await getTagPrefix();
  return `${prefix}-${'N'.repeat(DEFAULT_DIGITS)}`;
}
