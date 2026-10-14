/**
 * Migrate the homepage hero to the v2 three-slide story.
 *
 * Non-destructive by design:
 *   - ADDS the three approved hero slides when missing (matched by headline);
 *   - DEACTIVATES legacy slides (isActive = false) — records are preserved
 *     and can be re-enabled any time from Admin → CMS → Homepage Sections;
 *   - NEVER deletes a document and NEVER reseeds over admin-edited content.
 *
 * This also removes the obsolete `/gold` dead link from live homepages,
 * because the seeded Gold slide it lives on is deactivated (not deleted).
 *
 * Usage:
 *   npx tsx scripts/migrate-hero-slides-v2.ts              # dry-run report
 *   npx tsx scripts/migrate-hero-slides-v2.ts --apply --yes # execute
 */
import mongoose from 'mongoose';
import readline from 'readline';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import '@pawtag/db';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), 'packages/api/.env'),
  path.resolve(process.cwd(), 'packages/api/.env.local'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const APPROVED_SLIDES = [
  {
    title: 'Hero — Pet Safety',
    subtitle: 'Give your pet a simple way to be identified.',
    content: {
      eyebrow: 'PET SAFETY, SIMPLIFIED',
      headline: "They can't tell someone where they live. Their tag can.",
      sub: 'Give your pet a simple way to be identified and help someone reach you if they wander.',
      ctaText: 'Shop PawTag',
      ctaUrl: '/shop',
      secondaryCtaText: 'How PawTag Works',
      secondaryCtaUrl: '/about',
      duration: 7,
      desktopImageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      imageFocalPoint: 'center',
    },
  },
  {
    title: 'Hero — Smart Identification',
    subtitle: 'One scan can make all the difference.',
    content: {
      eyebrow: 'SMART IDENTIFICATION',
      headline: 'One scan can make all the difference.',
      sub: 'Someone finds your pet, scans the tag with their phone, and can get in touch. No app required for the finder.',
      ctaText: 'See How It Works',
      ctaUrl: '/about',
      secondaryCtaText: 'Explore PawTag',
      secondaryCtaUrl: '/shop',
      duration: 7,
      desktopImageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      imageFocalPoint: 'center',
    },
  },
  {
    title: 'Hero — Pet Profiles',
    subtitle: 'Their important details, always close.',
    content: {
      eyebrow: 'MORE THAN A NAME TAG',
      headline: 'Their important details, always close.',
      sub: 'Create a pet profile and manage the information a finder can see when they scan your PawTag.',
      ctaText: 'Discover Pet Profiles',
      ctaUrl: '/pet-recovery',
      secondaryCtaText: 'Get Started',
      secondaryCtaUrl: '/shop',
      duration: 7,
      desktopImageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      imageFocalPoint: 'center',
    },
  },
];

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

async function confirmApply(): Promise<boolean> {
  if (process.argv.includes('--yes')) return true;
  if (!process.stdin.isTTY) {
    console.error('Refusing --apply without a TTY. Re-run interactively or pass --yes.');
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) =>
    rl.question('Type "apply" to modify homepage hero slides: ', resolve),
  );
  rl.close();
  return answer.trim() === 'apply';
}

async function migrate() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.DB_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('DB_URL not set');

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB — ${apply ? 'APPLY (will mutate)' : 'DRY RUN (no mutations)'}`);

  const { CmsHomepageSection } = await import('@pawtag/db');

  const existing = await CmsHomepageSection.find({ sectionType: 'hero_slide', deletedAt: null })
    .sort({ order: 1 })
    .lean();

  const approvedHeadlines = new Set(APPROVED_SLIDES.map((s) => normalize(s.content.headline)));
  const existingApproved = existing.filter((doc) =>
    approvedHeadlines.has(normalize(String((doc.content as Record<string, unknown>)?.headline || ''))),
  );
  const legacy = existing.filter((doc) => !existingApproved.includes(doc));

  const missing = APPROVED_SLIDES.filter(
    (s) => !existing.some((doc) => normalize(String((doc.content as Record<string, unknown>)?.headline || '')) === normalize(s.content.headline)),
  );

  const legacyActive = legacy.filter((doc) => doc.isActive);
  const maxOrder = existing.reduce((max, doc) => Math.max(max, doc.order || 0), 0);

  console.log('\n── Plan ──────────────────────────────────────────────');
  console.log(`Existing hero slides:        ${existing.length}`);
  console.log(`Approved slides already present: ${existingApproved.length}`);
  console.log(`Approved slides to ADD:      ${missing.length}`);
  for (const slide of missing) console.log(`   + ${slide.title} — "${slide.content.headline}"`);
  console.log(`Legacy slides to deactivate: ${legacyActive.length} (kept, restorable)`);
  for (const doc of legacyActive) {
    console.log(`   ~ ${doc.title} — "${String((doc.content as Record<string, unknown>)?.headline || '').slice(0, 60)}"`);
  }
  console.log(`Legacy slides already hidden: ${legacy.length - legacyActive.length}`);

  if (!apply) {
    console.log('\nDRY RUN — nothing changed. Re-run with --apply --yes to execute.');
    await mongoose.disconnect();
    return;
  }

  let order = maxOrder;
  for (const slide of missing) {
    await CmsHomepageSection.create({
      sectionType: 'hero_slide',
      title: slide.title,
      subtitle: slide.subtitle,
      content: slide.content,
      order: ++order,
      isActive: true,
    });
    console.log(`  + created ${slide.title}`);
  }

  for (const doc of legacyActive) {
    await CmsHomepageSection.updateOne({ _id: doc._id }, { $set: { isActive: false } });
    console.log(`  ~ deactivated ${doc.title} (restorable from Admin → CMS → Homepage Sections)`);
  }

  console.log('\nDone. Approved slides are live; legacy slides preserved but hidden.');
  await mongoose.disconnect();
}

(async () => {
  await migrate();
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
