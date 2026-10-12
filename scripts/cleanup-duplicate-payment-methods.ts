/**
 * Cleanup duplicate saved payment methods (same provider fingerprint).
 *
 * Saved cards live ONLY on the Stripe Customer. Stripe does not dedupe on
 * attach, so re-entering the same card created multiple pm_ objects with the
 * same card.fingerprint. This script collapses each fingerprint group to one
 * canonical card using the SAME service logic as the live webhook dedupe
 * (dedupeSavedCards) — canonical selection preserves the default card and
 * repoints active billing references before detaching.
 *
 * Safety:
 *   - DRY-RUN IS THE DEFAULT. Nothing is mutated without --apply.
 *   - --apply requires an interactive "apply" confirmation (or --yes).
 *   - Cards without a provider fingerprint are AMBIGUOUS and never touched.
 *   - Same card on MULTIPLE Stripe Customers for one user (historical create
 *     races) is REPORT-ONLY — never merged or detached automatically.
 *   - Historical PaymentTransaction / Invoice records are never touched.
 *   - Recovery: a detached pm_ can be re-attached to the same customer
 *     (stripe.paymentMethods.attach(pmId, customerId)); the report contains
 *     every removed id and the customer it belonged to.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-payment-methods.ts                 # dry-run report
 *   npx tsx scripts/cleanup-duplicate-payment-methods.ts --json out.json # dry-run + JSON report
 *   npx tsx scripts/cleanup-duplicate-payment-methods.ts --limit 50      # dry-run, first 50 users
 *   npx tsx scripts/cleanup-duplicate-payment-methods.ts --apply         # execute after confirmation
 *   npx tsx scripts/cleanup-duplicate-payment-methods.ts --apply --yes   # execute without prompt
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
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../.env.local'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// Deferred imports so env is loaded before payment-mode/stripe-client resolve it.
async function main() {
  const apply = process.argv.includes('--apply');
  const yes = process.argv.includes('--yes');
  const jsonIdx = process.argv.indexOf('--json');
  const jsonOut = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : undefined;
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : undefined;

  const { resolvePaymentMode, getPaymentModeLabel } = await import(
    '../packages/api/src/commerce/payment-mode'
  );
  const { getStripeClient } = await import('../packages/api/src/lib/stripe-client');
  const { dedupeSavedCards } = await import(
    '../packages/api/src/services/payment-method.service'
  );
  const { User } = await import('@pawtag/db');

  const uri = process.env.DB_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('DB_URL not set');
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');

  const paymentMode = resolvePaymentMode();
  if (paymentMode === 'fake') {
    throw new Error(
      'PAYMENT_MODE resolves to fake (no usable STRIPE_SECRET_KEY). This script needs a real Stripe test/live key.',
    );
  }
  if (apply && paymentMode === 'stripe_live' && !yes && !process.stdin.isTTY) {
    throw new Error('Refusing non-interactive --apply against stripe_live without --yes.');
  }

  await mongoose.connect(uri);
  console.log(
    `Connected to MongoDB — mode: ${getPaymentModeLabel(paymentMode)} — ` +
      `${apply ? 'APPLY (will mutate)' : 'DRY RUN (no mutations)'}${limit ? ` — limit ${limit}` : ''}`,
  );

  const stripe = getStripeClient();

  interface ReportUser {
    userId: string;
    email?: string;
    stripeCustomerId: string;
    duplicateGroups: number;
    redundantCards: Array<{
      paymentMethodId: string;
      wouldRemove: boolean;
      repointsInvoiceDefault: boolean;
      repointsSubscriptionDefault: boolean;
      repointsMembershipReference: boolean;
    }>;
    canonical: Array<{ paymentMethodId: string; fingerprint: string; reason: string; brand?: string | null; last4?: string | null }>;
    removedPaymentMethodIds: string[];
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    paymentMode,
    usersChecked: 0,
    usersWithDuplicates: 0,
    duplicateGroups: 0,
    redundantCards: 0,
    ambiguousCards: 0,
    errors: [] as Array<{ userId?: string; error: string }>,
    users: [] as ReportUser[],
    orphanCustomers: [] as Array<{
      userId: string;
      email?: string;
      referencedCustomerId: string;
      otherCustomerIds: string[];
      matchingCards: Array<{ customerId: string; paymentMethodId: string; brand?: string | null; last4?: string | null; fingerprint: string }>;
    }>,
    recovery: {
      note: 'Detached payment methods can be re-attached to the same Stripe Customer via stripe.paymentMethods.attach(pmId, customerId). No database records or transaction history were deleted.',
    },
  };

  let query = User.find({ stripeCustomerId: { $exists: true, $ne: null } })
    .select('_id email fullName stripeCustomerId')
    .lean();
  if (limit) query = query.limit(limit);

  const startFingerprintsFor = async (customerId: string): Promise<Map<string, { id: string; brand?: string | null; last4?: string | null }>> => {
    const map = new Map<string, { id: string; brand?: string | null; last4?: string | null }>();
    const listed = await stripe.customers.listPaymentMethods(customerId, { type: 'card', limit: 100 });
    for (const pm of listed.data || []) {
      const fp = (pm as any).card?.fingerprint;
      if (fp) map.set(fp, { id: pm.id, brand: (pm as any).card?.brand, last4: (pm as any).card?.last4 });
    }
    return map;
  };

  for await (const user of query.cursor()) {
    report.usersChecked++;
    const userId = String(user._id);
    try {
      // 1) Duplicate groups on the referenced customer (dry-run or apply).
      const result = await dedupeSavedCards(userId, { reason: `cleanup_script_${apply ? 'apply' : 'dry_run'}`, dryRun: !apply });

      if (result.ambiguousCards > 0) report.ambiguousCards += result.ambiguousCards;

      if (result.duplicateGroups > 0) {
        report.usersWithDuplicates++;
        report.duplicateGroups += result.duplicateGroups;
        report.redundantCards += result.groups.reduce((n, g) => n + g.redundant.length, 0);

        report.users.push({
          userId,
          email: user.email,
          stripeCustomerId: user.stripeCustomerId,
          duplicateGroups: result.duplicateGroups,
          canonical: result.groups.map((g) => ({
            paymentMethodId: g.canonicalPaymentMethodId,
            fingerprint: g.fingerprint,
            reason: g.canonicalReason,
            brand: g.brand,
            last4: g.last4,
          })),
          redundantCards: result.groups.flatMap((g) =>
            g.redundant.map((r) => ({
              paymentMethodId: r.paymentMethodId,
              wouldRemove: !apply,
              repointsInvoiceDefault: r.repointsInvoiceDefault,
              repointsSubscriptionDefault: r.repointsSubscriptionDefault,
              repointsMembershipReference: r.repointsMembershipReference,
            })),
          ),
          removedPaymentMethodIds: result.removedPaymentMethodIds,
        });

        console.log(
          `\n${user.email || userId} (${user.stripeCustomerId}): ${result.duplicateGroups} duplicate group(s)${apply ? `, removed ${result.removedPaymentMethodIds.length}` : ' — would remove'}`,
        );
        for (const g of result.groups) {
          const label = `${g.brand || 'card'} ••••${g.last4 || '????'}`;
          console.log(`  keep ${g.canonicalPaymentMethodId} (${label}, ${g.canonicalReason}); remove ${g.redundant.map((r) => r.paymentMethodId).join(', ')}`);
        }
      }

      // 2) Orphan-customer scan (REPORT ONLY — never mutated in either mode).
      if (user.email) {
        try {
          const listed = await stripe.customers.list({ email: user.email, limit: 10 });
          const otherIds = (listed.data || [])
            .map((c) => c.id)
            .filter((id) => id && id !== user.stripeCustomerId);
          if (otherIds.length > 0) {
            const canonicalFps = await startFingerprintsFor(user.stripeCustomerId);
            const matching: Array<{ customerId: string; paymentMethodId: string; brand?: string | null; last4?: string | null; fingerprint: string }> = [];
            for (const otherId of otherIds) {
              try {
                const otherFps = await startFingerprintsFor(otherId);
                for (const [fp, card] of otherFps) {
                  if (canonicalFps.has(fp)) {
                    matching.push({ customerId: otherId, paymentMethodId: card.id, brand: card.brand, last4: card.last4, fingerprint: fp });
                  }
                }
              } catch {
                // other-customer scan is best-effort reporting
              }
            }
            if (matching.length > 0) {
              report.orphanCustomers.push({
                userId,
                email: user.email,
                referencedCustomerId: user.stripeCustomerId,
                otherCustomerIds: otherIds,
                matchingCards: matching,
              });
              console.log(`  ⚠ same card also found on another Stripe Customer for ${user.email || userId} — manual review (report-only): ${[...new Set(matching.map((m) => m.customerId))].join(', ')}`);
            }
          }
        } catch (err: any) {
          report.errors.push({ userId, error: `orphan scan failed: ${err.message}` });
        }
      }
    } catch (err: any) {
      report.errors.push({ userId, error: err.message });
      console.error(`  ✗ ${user.email || userId}: ${err.message}`);
    }
  }

  await mongoose.disconnect();

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Users checked:            ${report.usersChecked}`);
  console.log(`Users with duplicates:    ${report.usersWithDuplicates}`);
  console.log(`Duplicate groups:         ${report.duplicateGroups}`);
  console.log(`Redundant cards ${apply ? 'removed     ': 'to remove    '}: ${report.redundantCards}`);
  console.log(`Ambiguous (no fingerprint): ${report.ambiguousCards} — never touched`);
  console.log(`Orphan-customer matches (manual review): ${report.orphanCustomers.length}`);
  console.log(`Errors:                   ${report.errors.length}`);

  if (!apply && report.redundantCards > 0) {
    console.log(`\nThis was a DRY RUN — nothing was changed.`);
    console.log(`Review the report, then run with --apply to execute the exact actions listed.`);
  }
  if (report.orphanCustomers.length > 0) {
    console.log(`\nOrphan-customer cases are REPORT-ONLY and require manual review before any action.`);
  }

  if (jsonOut) {
    fs.writeFileSync(path.resolve(process.cwd(), jsonOut), JSON.stringify(report, null, 2));
    console.log(`\nJSON report written to ${jsonOut}`);
  }

  if (apply) {
    console.log(`\nRecovery: ${report.recovery.note}`);
  }
}

async function confirmApply(): Promise<boolean> {
  if (process.argv.includes('--yes')) return true;
  if (!process.stdin.isTTY) {
    console.error('Refusing --apply without a TTY. Re-run interactively or pass --yes.');
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => rl.question('Type "apply" to modify Stripe payment methods: ', resolve));
  rl.close();
  return answer.trim() === 'apply';
}

(async () => {
  if (process.argv.includes('--apply')) {
    const ok = await confirmApply();
    if (!ok) {
      console.error('Aborted — no changes made.');
      process.exit(1);
    }
  }
  await main();
})().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
