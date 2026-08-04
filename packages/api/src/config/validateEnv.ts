const REQUIRED_IN_PRODUCTION = ['DB_URL', 'JWT_SECRET'] as const;

const RECOMMENDED = ['BOOTSTRAP_ADMIN_PASSWORD', 'STRIPE_SECRET_KEY', 'ADMIN_ALERT_EMAIL'] as const;

export function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const missingRequired: string[] = [];
  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!process.env[key]) {
      missingRequired.push(key);
    }
  }

  if (nodeEnv === 'production' && missingRequired.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missingRequired.join(', ')}.\n` +
      `Set them before starting the server. See docs/environments.md for details.`
    );
  }

  if (nodeEnv !== 'production') {
    for (const key of missingRequired) {
      console.warn(`⚠ [config] ${key} is not set — using defaults for ${nodeEnv} mode`);
    }
  }

  const missingRecommended: string[] = [];
  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      missingRecommended.push(key);
    }
  }

  if (missingRecommended.length > 0) {
    console.warn(`⚠ [config] Optional but recommended variables not set: ${missingRecommended.join(', ')}`);
  }
}
