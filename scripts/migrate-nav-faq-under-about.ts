/**
 * Move the FAQ menu item under About in the header navigation.
 *
 * Founder decision: FAQ is a submenu of About (dropdown on desktop,
 * indented row on mobile) rather than a top-level item.
 *
 * Non-destructive: MOVES the existing FAQ item (preserving its label/url)
 * into About's children; never deletes unrelated items; idempotent (a
 * second run is a no-op). Footer navigation is untouched.
 *
 * Usage (from the repository root):
 *   npx tsx scripts/migrate-nav-faq-under-about.ts              # dry-run report
 *   npx tsx scripts/migrate-nav-faq-under-about.ts --apply --yes # execute
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { CmsNavigation } from '../packages/db/src/models/CmsNavigation';

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

async function main() {
  const apply = process.argv.includes('--apply') && process.argv.includes('--yes');

  const uri = loadDbUrl();
  if (!uri) throw new Error('DB_URL not configured');
  await mongoose.connect(uri);

  // lean() — plain objects; spreading Mongoose subdocuments drops schema
  // fields and breaks the re-find below
  const menu = await CmsNavigation.findOne({ location: 'header', status: 'published', deletedAt: null }).lean();
  if (!menu) {
    console.log('No published header navigation found — nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const items = (menu.items || []) as any[];
  const faqIdx = items.findIndex((i) => i.url === '/faq');
  const aboutIdx = items.findIndex((i) => i.url === '/about');

  if (faqIdx === -1) {
    const nested =
      aboutIdx !== -1 &&
      Array.isArray(items[aboutIdx].children) &&
      (items[aboutIdx].children as any[]).some((c) => c.url === '/faq');
    console.log(nested ? 'FAQ already nested under About — no-op.' : 'No FAQ item found in header navigation — no-op.');
    await mongoose.disconnect();
    return;
  }
  if (aboutIdx === -1) {
    console.log('About item not found — aborting (manual review needed).');
    await mongoose.disconnect();
    return;
  }

  const faq = items[faqIdx];
  const aboutLabel = items[aboutIdx].label;
  const children = Array.isArray(items[aboutIdx].children) ? [...(items[aboutIdx].children as any[])] : [];
  if (children.some((c) => c.url === '/faq')) {
    console.log('FAQ already present under About — no-op.');
    await mongoose.disconnect();
    return;
  }

  console.log('Plan:');
  console.log(`  - remove top-level "${faq.label}" (order ${faq.order})`);
  console.log(`  - add "${faq.label}" as a child of "${aboutLabel}"`);
  console.log('  - renumber remaining top-level items sequentially');

  const newChildren = [...children, { label: faq.label, url: faq.url, order: children.length, visible: faq.visible !== false }];
  // Remove FAQ, renumber, then attach the children to About's new position
  const newItems = items.filter((_, i) => i !== faqIdx).map((item, i) => ({ ...item, order: i }));
  const aboutAfter = newItems.findIndex((i) => i.url === '/about');
  (newItems[aboutAfter] as any).children = newChildren;

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply --yes to execute.');
    await mongoose.disconnect();
    return;
  }

  await CmsNavigation.updateOne({ _id: menu._id }, { $set: { items: newItems } });
  console.log('Applied — FAQ now lives under About.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
