/**
 * Free 3-Month Activation: add the `activation` entitlement column to an
 * EXISTING database (docs/ACTIVATION-ENTITLEMENTS.md).
 *
 * Fresh databases get the values from scripts/seed-entitlements.ts. This
 * script inserts MISSING `MembershipTierBenefit` rows with tier
 * 'activation' for every enabled benefit, using the shared defaults
 * (scripts/lib/activation-entitlement-defaults.ts) — it NEVER overwrites an
 * existing activation row (admin edits win) and never touches paid tiers.
 *
 * Non-destructive and idempotent: a second run is a no-op.
 *
 * Usage (from the repository root):
 *   npx tsx scripts/migrate-activation-entitlements.ts              # dry-run report
 *   npx tsx scripts/migrate-activation-entitlements.ts --apply --yes # execute
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { ACTIVATION_ENTITLEMENT_DEFAULTS } from './lib/activation-entitlement-defaults';

const ACTIVATION_CONTEXT = 'activation';

function loadDbUrl(): string | undefined {
  if (process.env.DB_URL) return process.env.DB_URL;
  const envPath = path.resolve(__dirname, '../packages/api/.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^DB_URL=(.*)$/);
      if (m) return m[1].trim();
    }
  }
  return undefined;
}

async function main() {
  const apply = process.argv.includes('--apply') && process.argv.includes('--yes');

  const uri = loadDbUrl();
  if (!uri) throw new Error('DB_URL not configured');
  await mongoose.connect(uri);

  const db = mongoose.connection.db!;
  const benefitsCol = db.collection('membershipbenefits');
  const tierBenefitsCol = db.collection('membershiptierbenefits');

  const enabledBenefits = await benefitsCol.find({ enabled: true }).project({ key: 1 }).toArray();
  const existingActivationRows = await tierBenefitsCol.find({ tier: ACTIVATION_CONTEXT }).project({ benefitKey: 1 }).toArray();
  const existingKeys = new Set(existingActivationRows.map((r: any) => r.benefitKey));

  let planned = 0;
  for (const benefit of enabledBenefits) {
    const defaults = ACTIVATION_ENTITLEMENT_DEFAULTS[benefit.key];
    if (!defaults) {
      console.log(`  SKIPPED: benefit "${benefit.key}" has no known activation default — add it to scripts/lib/activation-entitlement-defaults.ts, then re-run.`);
      continue;
    }
    if (existingKeys.has(benefit.key)) {
      console.log(`  no-op: ${benefit.key} (activation row already exists — admin edits win)`);
      continue;
    }
    console.log(`  Plan: insert activation row for ${benefit.key} → enabled=${defaults.enabled}, value=${JSON.stringify(defaults.value)}`);
    planned++;

    if (apply) {
      await tierBenefitsCol.insertOne({
        benefitKey: benefit.key,
        tier: ACTIVATION_CONTEXT,
        enabled: defaults.enabled,
        value: defaults.value,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Extra activation rows for benefits that no longer exist — report only.
  const enabledKeys = new Set(enabledBenefits.map((b: any) => b.key));
  for (const key of existingKeys) {
    if (!enabledKeys.has(key)) console.log(`  note: orphan activation row "${key}" (benefit missing or disabled) — left untouched.`);
  }

  if (!apply) {
    console.log(
      planned > 0
        ? `\nDRY RUN — ${planned} row(s) would be inserted. Re-run with --apply --yes to execute, then invalidate the entitlement cache (Admin → Entitlements → Invalidate, or restart the API).`
        : '\nDRY RUN — nothing to change.',
    );
  } else {
    console.log(`\nDone — ${planned} row(s) inserted. Invalidate the entitlement cache (Admin → Entitlements → Invalidate, or restart the API).`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
