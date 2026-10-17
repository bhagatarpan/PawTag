/**
 * Add the line-items block to the live order-confirmation CMS template.
 *
 * The founder's order emails were missing line items because the CMS
 * template body never displayed them (the fallback renderer did). The
 * backend now passes a server-built `{{itemsHtml}}` styled table; this
 * migration inserts it into the live template body after the Total line.
 *
 * Non-destructive and additive: only inserts the items block, only when
 * {{itemsHtml}} is not already present; every other template edit
 * (subject, copy, CTA) is preserved. Idempotent.
 *
 * Usage (from the repository root):
 *   npx tsx scripts/migrate-order-email-items.ts              # dry-run
 *   npx tsx scripts/migrate-order-email-items.ts --apply --yes # execute
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { CmsEmailTemplate } from '../packages/db/src/models/CmsEmailTemplate';

function loadDbUrl(): string | undefined {
  if (process.env.DB_URL) return process.env.DB_URL;
  const envPath = path.resolve(__dirname, '../packages/api/.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && m[1] === 'DB_URL') return m[2].trim();
    }
  }
  return undefined;
}

const ITEMS_BLOCK = '{{itemsHtml}}';

async function main() {
  const apply = process.argv.includes('--apply') && process.argv.includes('--yes');

  const uri = loadDbUrl();
  if (!uri) throw new Error('DB_URL not configured');
  await mongoose.connect(uri);

  const template = await CmsEmailTemplate.findOne({ slug: 'order-confirmation', deletedAt: null }).lean();
  if (!template) {
    console.log('No order-confirmation template found — nothing to do (fresh DBs get the seeded template with items).');
    await mongoose.disconnect();
    return;
  }

  const body: string = (template as any).body || '';
  if (body.includes(ITEMS_BLOCK)) {
    console.log('Template already includes {{itemsHtml}} — no-op.');
    await mongoose.disconnect();
    return;
  }

  // Insert after the Total line so items sit between totals and shipping
  const anchor = body.match(/Total:[^\n]*\n/);
  const newBody = anchor
    ? body.replace(anchor[0], `${anchor[0]}\n${ITEMS_BLOCK}\n`)
    : `${body}\n\n${ITEMS_BLOCK}\n`;

  console.log('Plan: insert {{itemsHtml}} into the order-confirmation template body.');
  console.log(anchor ? '  - anchor: after the "Total:" line' : '  - anchor: none found — appending at end');
  console.log('\nBefore:');
  console.log(body.slice(0, 300));
  console.log('\nAfter:');
  console.log(newBody.slice(0, 320));

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply --yes to execute.');
    await mongoose.disconnect();
    return;
  }

  await CmsEmailTemplate.updateOne(
    { _id: (template as any)._id },
    { $set: { body: newBody, updatedAt: new Date() } },
  );
  console.log('\nApplied — order confirmation emails now include line items.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
