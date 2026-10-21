/**
 * Card processing fee: add American Express to the fee networks + update the
 * customer FAQ copy.
 *
 * Founder decision (Oct 2026): Amex is charged the same card processing fee
 * as Visa/Mastercard (Stripe's domestic rate is identical — 2.65% + NZ$0.30),
 * and all customer-facing copy says "Visa, Mastercard or American Express".
 *
 * Fresh databases get the new defaults from the code/seed; this script
 * updates EXISTING databases:
 *
 *   1. Setting `commerce.cpf.appliesTo`: `visa,mastercard` →
 *      `visa,mastercard,amex` — ONLY when the stored value is exactly the
 *      old default. A custom value set by an admin is never overwritten
 *      (it is reported instead).
 *   2. CMS FAQ answer "Why is there a card payment fee?": updated ONLY when
 *      it exactly matches the old seeded text. Admin-edited answers are
 *      never overwritten (reported instead).
 *
 * Non-destructive and idempotent: a second run is a no-op.
 *
 * Usage (from the repository root):
 *   npx tsx scripts/migrate-card-fee-brands.ts              # dry-run report
 *   npx tsx scripts/migrate-card-fee-brands.ts --apply --yes # execute
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { CmsPage } from '../packages/db/src/models/CmsPage';
import { Setting } from '../packages/db/src/models/Setting';

const OLD_ANSWER =
  'A card payment fee (including GST) applies when you pay by Visa or Mastercard. It covers the cost of processing your card payment and is included in the total you see before you confirm your payment. The exact fee is shown at checkout before you pay. The fee is not refunded if you cancel your order or return an item, because your card payment processing cost is incurred at the moment you pay.';
const NEW_ANSWER =
  'A card payment fee (including GST) applies when you pay by Visa, Mastercard or American Express. It covers the cost of processing your card payment and is included in the total you see before you confirm your payment. The exact fee is shown at checkout before you pay. The fee is not refunded if you cancel your order or return an item, because your card payment processing cost is incurred at the moment you pay.';
const FEE_QUESTION = 'Why is there a card payment fee?';

const OLD_APPLIES_TO = 'visa,mastercard';
const NEW_APPLIES_TO = 'visa,mastercard,amex';

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

  let changesPlanned = 0;

  // ── 1. Setting: commerce.cpf.appliesTo ──────────────────────────────
  const setting = await Setting.findOne({ key: 'commerce.cpf.appliesTo' }).lean();
  if (!setting) {
    console.log('Setting commerce.cpf.appliesTo: not stored — the new code default (visa,mastercard,amex) applies. No change needed.');
  } else {
    const current = String((setting as any).value ?? '').trim().toLowerCase();
    if (current === NEW_APPLIES_TO) {
      console.log('Setting commerce.cpf.appliesTo: already visa,mastercard,amex — no-op.');
    } else if (current === OLD_APPLIES_TO) {
      console.log(`Plan: setting commerce.cpf.appliesTo  "${current}"  ->  "${NEW_APPLIES_TO}"`);
      changesPlanned++;
      if (apply) {
        await Setting.updateOne({ key: 'commerce.cpf.appliesTo' }, { $set: { value: NEW_APPLIES_TO } });
        console.log('  Applied.');
      }
    } else {
      console.log(
        `Setting commerce.cpf.appliesTo: stored value "${current}" is neither the old nor the new default — looks admin-customised. LEAVING UNCHANGED (add ",amex" manually in Admin → Commerce Settings if desired).`,
      );
    }
  }

  // ── 2. CMS FAQ answer ───────────────────────────────────────────────
  const faq = await CmsPage.findOne({ slug: 'faq', deletedAt: null });
  if (!faq) {
    console.log('FAQ page: not found — no-op.');
  } else {
    let matched = false;
    let alreadyUpdated = false;
    let faqChangeApplied = false;
    for (const section of faq.sections || []) {
      const items = (section as any).content?.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (item?.question !== FEE_QUESTION) continue;
        matched = true;
        if (item.answer === NEW_ANSWER) {
          alreadyUpdated = true;
        } else if (item.answer === OLD_ANSWER) {
          console.log('Plan: FAQ answer for "Why is there a card payment fee?" — add American Express to the wording.');
          changesPlanned++;
          if (apply) {
            item.answer = NEW_ANSWER;
            // section.content is Schema.Types.Mixed — Mongoose cannot detect
            // deep array mutations, so without this markModified the save()
            // would silently write nothing.
            (section as any).markModified?.('content');
            faqChangeApplied = true;
            console.log('  Applied.');
          }
        } else {
          console.log(
            'FAQ answer for "Why is there a card payment fee?" does not match the old seeded text — looks admin-edited. LEAVING UNCHANGED (edit it in Admin → CMS if it should mention American Express).',
          );
        }
      }
    }
    if (!matched) console.log('FAQ page: card-fee question not present — no-op (the seed adds it on fresh pages only).');
    if (alreadyUpdated) console.log('FAQ answer: already mentions American Express — no-op.');
    if (apply && faqChangeApplied) {
      await faq.save();
      // Read-after-write guard: Mixed-path saves can silently no-op, so the
      // script must prove the new text is actually in the database.
      const verify = await CmsPage.findOne({ slug: 'faq', deletedAt: null }).lean();
      const persisted = ((verify as any)?.sections || []).some((s: any) =>
        Array.isArray(s?.content?.items) &&
        s.content.items.some((i: any) => i?.question === FEE_QUESTION && i?.answer === NEW_ANSWER),
      );
      if (!persisted) {
        throw new Error('FAQ update did not persist — aborting with a clear failure instead of claiming success.');
      }
      console.log('FAQ page saved and verified in the database.');
    }
  }

  if (!apply) {
    console.log(
      changesPlanned > 0
        ? `\nDRY RUN — ${changesPlanned} change(s) planned. Re-run with --apply --yes to execute.`
        : '\nDRY RUN — nothing to change.',
    );
  } else {
    console.log('Done.');
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
