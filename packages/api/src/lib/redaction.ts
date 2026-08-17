/**
 * Central redaction policy for PawTag.
 *
 * Provides consistent, safe redaction of sensitive data across:
 * - Structured logs
 * - Error metadata
 * - Request/response payloads
 * - Audit events
 *
 * Rules:
 * - Never log raw environment variables
 * - Never log .env contents
 * - Never log complete request headers by default
 * - Never log complete request bodies by default
 * - Redaction happens centrally - developers don't need to remember every field
 */

// ─── Sensitive Field Patterns ──────────────────────────────────────

/**
 * Exact field names that are always sensitive (case-insensitive match).
 */
const SENSITIVE_FIELDS = new Set([
  // Authentication
  'password',
  'passwordhash',
  'hashedpassword',
  'passwd',
  'pwd',

  // Tokens & secrets
  'token',
  'accesstoken',
  'refreshtoken',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'sessiontoken',
  'secret',
  'jwtsecret',
  'jwt_secret',
  'secretkey',
  'secret_key',
  'privatekey',
  'private_key',

  // API keys
  'apikey',
  'api_key',
  'apisecret',
  'api_secret',

  // HTTP headers
  'authorization',
  'cookie',
  'set-cookie',

  // OTP & MFA
  'otp',
  'otpcode',
  'otp_code',
  'mfa_secret',
  'mfasecret',
  'mfacode',
  'mfa_code',
  'totpsecret',
  'totp_secret',

  // Payment credentials
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'csc',
  'pin',
  'ssn',
  'social_security_number',

  // PawTag-specific sensitive
  'finderphone',
  'finderphone',
  'finderemail',
  'finderemail',
  'emergencycontact',
  'emergency_contact',
  'emergencyphone',
  'emergency_phone',
]);

/**
 * Regex patterns for field names that are sensitive (partial matches).
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /private.?key/i,
  /session/i,
  /cookie/i,
  /otp/i,
  /mfa/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
];

// ─── PawTag-Specific Sensitive Fields ──────────────────────────────

/**
 * Fields that need partial masking (not full redaction).
 * These are sensitive but may need partial visibility for operations.
 */
const PARTIAL_MASK_FIELDS: Record<string, (value: string) => string> = {
  // Show first 3 chars, mask rest
  email: (v: string) => {
    const [local, domain] = v.split('@');
    if (!domain) return '***';
    return `${local.substring(0, 3)}***@${domain}`;
  },
  // Show last 4 digits
  phonenumber: (v: string) => {
    const cleaned = v.replace(/\D/g, '');
    return `***-***-${cleaned.slice(-4)}`;
  },
  phone: (v: string) => {
    const cleaned = v.replace(/\D/g, '');
    return `***-***-${cleaned.slice(-4)}`;
  },
};

// ─── Core Redaction Functions ──────────────────────────────────────

/**
 * Check if a field name is sensitive.
 */
export function isSensitiveField(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();

  // Check exact matches
  if (SENSITIVE_FIELDS.has(lower)) return true;

  // Check pattern matches
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Redact a single value based on field name.
 * Returns '[REDACTED]' for sensitive fields, original value otherwise.
 */
export function redactValue(value: unknown, fieldName: string): unknown {
  if (value === undefined || value === null) return value;

  if (isSensitiveField(fieldName)) {
    return '[REDACTED]';
  }

  return value;
}

/**
 * Deep redact an object, replacing sensitive field values with '[REDACTED]'.
 * Handles nested objects and arrays.
 *
 * @example
 *   const data = { password: 'secret', name: 'John', nested: { token: 'abc' } };
 *   const safe = deepRedact(data);
 *   // { password: '[REDACTED]', name: 'John', nested: { token: '[REDACTED]' } }
 */
export function deepRedact(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === undefined || obj === null) return obj;

  // Handle primitives
  if (typeof obj !== 'object') return obj;

  // Handle Date
  if (obj instanceof Date) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => deepRedact(item, seen));
  }

  // Handle plain objects
  if (seen.has(obj)) return '[CIRCULAR]';
  seen.add(obj);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object') {
      result[key] = deepRedact(value, seen);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Safe serialization for logging.
 * Redacts sensitive fields and handles circular references.
 */
export function safeSerialize(obj: unknown): unknown {
  return deepRedact(obj);
}

/**
 * Sanitize a request body for logging.
 * Only includes safe fields, redacts sensitive ones.
 */
export function sanitizeRequestBody(body: unknown, allowedFields?: string[]): unknown {
  if (!body || typeof body !== 'object') return body;

  const redacted = deepRedact(body);

  if (allowedFields) {
    const filtered: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in (redacted as Record<string, unknown>)) {
        filtered[field] = (redacted as Record<string, unknown>)[field];
      }
    }
    return filtered;
  }

  return redacted;
}

/**
 * Sanitize request headers for logging.
 * Only includes safe headers, redacts sensitive ones.
 */
export function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const safeHeaders: Record<string, unknown> = {};
  const allowedHeaders = [
    'content-type',
    'accept',
    'user-agent',
    'x-request-id',
    'x-correlation-id',
    'x-trace-id',
    'origin',
    'referer',
    'host',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (allowedHeaders.includes(lower)) {
      safeHeaders[key] = value;
    }
    // All other headers are excluded by default
  }

  return safeHeaders;
}

/**
 * Sanitize environment variables for logging.
 * Returns only safe keys with redacted values.
 */
export function sanitizeEnvVars(env: Record<string, string | undefined>): Record<string, string> {
  const safeEnv: Record<string, string> = {};
  const safeKeys = [
    'NODE_ENV',
    'PORT',
    'LOG_LEVEL',
    'SERVICE_NAME',
    'SERVICE_VERSION',
  ];

  for (const key of safeKeys) {
    if (env[key] !== undefined) {
      safeEnv[key] = env[key]!;
    }
  }

  return safeEnv;
}

/**
 * Mask a value partially (for fields like email, phone).
 * Returns the masked version if a mask function exists for the field,
 * otherwise returns '[REDACTED]'.
 */
export function partialMask(value: unknown, fieldName: string): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return '[REDACTED]';

  const lower = fieldName.toLowerCase();
  const maskFn = PARTIAL_MASK_FIELDS[lower];

  if (maskFn) {
    try {
      return maskFn(value);
    } catch {
      return '[REDACTED]';
    }
  }

  return '[REDACTED]';
}
