/**
 * Seed donation settings (configurable — $setOnInsert only).
 * Usage: pnpm --filter @pawtag/api exec tsx src/seeds/seed-donations.ts
 */
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { connectDatabase, disconnectDatabase } from '@pawtag/db';
import { seedDonationSettingsIfMissing } from '../services/donation/donation-config';

async function main() {
  await connectDatabase();
  await seedDonationSettingsIfMissing();
  console.log('Donation settings ensured');
  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
