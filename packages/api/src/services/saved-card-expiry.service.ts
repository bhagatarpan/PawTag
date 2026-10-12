/**
 * Saved-card expiry monitoring.
 *
 * Daily background scan over users with a Stripe Customer: any saved card
 * entering the 28-day pre-expiry window gets ONE email (CMS-first) and ONE
 * in-app notification per expiration period, tracked in SavedCardExpiryNotice
 * whose unique {userId, paymentMethodId, expMonth, expYear} key is the
 * send-once guarantee.
 *
 * Expiry convention: a card is valid THROUGH the last instant of its expiry
 * month — expiryEndExclusive is the first instant of the following month (UTC).
 *
 * Duplicate cards: same-fingerprint groups collapse to the oldest attached
 * card (the canonical card the live dedupe keeps), so a customer is never
 * notified twice for the same physical card.
 *
 * The in-app notification is created DIRECTLY (not via
 * notification-delivery.service) because this is payment-continuity service
 * messaging, not a tier benefit — every affected customer is warned regardless
 * of the in_app_notifications entitlement, exactly like dunning emails.
 */
import { SavedCardExpiryNotice, User, UserMembership, Notification } from '@pawtag/db';
import type Stripe from 'stripe';
import { isFakeMode } from '../commerce/payment-mode';
import { getStripeClient } from '../lib/stripe-client';
import { sendCmsEmailOrFallback } from './email.service';
import { renderSavedCardExpiringEmail } from './email/templates/saved-card-expiring';
import logger from '../lib/logger';

export const SAVED_CARD_EXPIRY_WINDOW_DAYS = 28;
const MAX_NOTIFY_ATTEMPTS = 3;

export interface ExpiryWindowStatus {
  daysRemaining: number;
  /** Inside the 28-day warning window and not yet expired. */
  eligible: boolean;
  expired: boolean;
}

/**
 * Card validity ends at the last instant of the expiry month (UTC).
 * A card expiring 11/2026 is eligible from 11/3 (28 days before 12/1 00:00 UTC).
 */
export function expiryWindowStatus(
  expMonth: number,
  expYear: number,
  now: Date = new Date(),
): ExpiryWindowStatus {
  const expiryEndExclusive = Date.UTC(expYear, expMonth, 1); // first instant AFTER the month
  const expired = now.getTime() >= expiryEndExclusive;
  const daysRemaining = Math.floor((expiryEndExclusive - now.getTime()) / 86_400_000);
  return {
    daysRemaining,
    expired,
    eligible: !expired && daysRemaining <= SAVED_CARD_EXPIRY_WINDOW_DAYS,
  };
}

function formatExpiryLabel(expMonth: number, expYear: number): string {
  return new Date(Date.UTC(expYear, expMonth - 1, 1)).toLocaleDateString('en-NZ', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export interface SavedCardExpiryCheckResult {
  usersChecked: number;
  eligibleCards: number;
  notified: number;
  alreadyNotified: number;
  failedAttempts: number;
  expiredSkipped: number;
  errors: number;
}

/**
 * Scan and notify. Accepts `now` for deterministic tests; production callers
 * use the default (current time).
 */
export async function runSavedCardExpiryCheck(
  now: Date = new Date(),
): Promise<SavedCardExpiryCheckResult> {
  const result: SavedCardExpiryCheckResult = {
    usersChecked: 0,
    eligibleCards: 0,
    notified: 0,
    alreadyNotified: 0,
    failedAttempts: 0,
    expiredSkipped: 0,
    errors: 0,
  };

  if (isFakeMode()) return result;

  const stripe = getStripeClient();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const updatePaymentUrl = `${frontendUrl}/account/settings`;

  const cursor = User.find({ stripeCustomerId: { $exists: true, $ne: null } })
    .select('_id email fullName stripeCustomerId')
    .lean()
    .cursor();

  for await (const user of cursor) {
    result.usersChecked++;
    try {
      const listed = await stripe.customers.listPaymentMethods(String(user.stripeCustomerId), {
        type: 'card',
        limit: 100,
      });
      const cards = (listed.data || []) as Stripe.PaymentMethod[];

      // Collapse same-fingerprint duplicates → notify once for the oldest
      // attached card of each physical card (same rule as live dedupe).
      const byFingerprint = new Map<string, Stripe.PaymentMethod[]>();
      for (const pm of cards) {
        const fp = pm.card?.fingerprint;
        if (!fp) continue;
        const group = byFingerprint.get(fp);
        if (group) group.push(pm);
        else byFingerprint.set(fp, [pm]);
      }
      const canonicalCards = [...byFingerprint.values()].map((group) =>
        [...group].sort((a, b) => (a.created || 0) - (b.created || 0))[0],
      );
      // Fingerprint-less cards cannot be grouped — each is notified individually.
      const candidates = [...canonicalCards, ...cards.filter((pm) => !pm.card?.fingerprint)];

      // Membership billing-card association (any card of the same physical
      // card counts, even when the membership still references a duplicate).
      const membership = await UserMembership.findOne({
        userId: user._id,
        status: 'active',
      }).lean();
      const membershipCardFingerprints = new Set<string>();
      if (membership?.paymentMethodId) {
        const refPm = cards.find((pm) => pm.id === membership.paymentMethodId);
        const refFp = refPm?.card?.fingerprint;
        if (refFp) {
          for (const pm of byFingerprint.get(refFp) || []) {
            membershipCardFingerprints.add(pm.id);
          }
        } else if (refPm) {
          membershipCardFingerprints.add(refPm.id);
        }
      }

      for (const pm of candidates) {
        const expMonth = pm.card?.exp_month;
        const expYear = pm.card?.exp_year;
        if (!expMonth || !expYear) continue;

        const window = expiryWindowStatus(expMonth, expYear, now);
        if (window.expired) {
          result.expiredSkipped++;
          continue;
        }
        if (!window.eligible) continue;
        result.eligibleCards++;

        const noticeKey = {
          userId: user._id,
          paymentMethodId: pm.id,
          expMonth,
          expYear,
        };

        // Atomic claim: the unique index guarantees ONE notice per card per
        // expiration period, even across concurrent/repeated runs.
        const existing = await SavedCardExpiryNotice.findOne(noticeKey).lean();
        if (existing?.status === 'sent') {
          result.alreadyNotified++;
          continue;
        }
        if (existing && existing.attempts >= MAX_NOTIFY_ATTEMPTS) {
          logger.warn(
            { userId: String(user._id), paymentMethodId: pm.id, attempts: existing.attempts },
            '[SavedCardExpiry] notice attempts exhausted — manual follow-up needed',
          );
          result.alreadyNotified++;
          continue;
        }

        let noticeId: unknown;
        if (existing) {
          // Retry a failed notice — atomically re-claim so two workers cannot
          // both send. The send is idempotent at the customer level anyway
          // (same content); this prevents duplicate parallel sends.
          const reclaimed = await SavedCardExpiryNotice.findOneAndUpdate(
            { ...noticeKey, status: 'failed', attempts: { $lt: MAX_NOTIFY_ATTEMPTS } },
            { $set: { status: 'pending', lastAttemptAt: now }, $inc: { attempts: 1 } },
            { new: true },
          ).lean();
          if (!reclaimed) {
            result.alreadyNotified++; // claimed elsewhere or already sent
            continue;
          }
          noticeId = reclaimed._id;
        } else {
          try {
            const created = await SavedCardExpiryNotice.create({
              ...noticeKey,
              stripeCustomerId: String(user.stripeCustomerId),
              cardBrand: pm.card?.brand,
              cardLast4: pm.card?.last4,
              status: 'pending',
              attempts: 1,
              lastAttemptAt: now,
            });
            noticeId = created._id;
          } catch (err: any) {
            if (err?.code === 11000) {
              result.alreadyNotified++; // another run claimed this card
              continue;
            }
            throw err;
          }
        }

        const cardBrand = pm.card?.brand ? pm.card!.brand.charAt(0).toUpperCase() + pm.card!.brand.slice(1) : 'Card';
        const cardLast4 = pm.card?.last4 || '????';
        const expiryLabel = formatExpiryLabel(expMonth, expYear);
        const membershipAffected = membershipCardFingerprints.has(pm.id);

        try {
          await sendCmsEmailOrFallback({
            slug: 'saved-card-expiring',
            to: String(user.email),
            vars: {
              name: (user.fullName || 'there').split(' ')[0],
              cardBrand,
              cardLast4,
              expiryLabel,
              updatePaymentUrl,
              membershipAffected: membershipAffected ? 'yes' : '',
              membershipRenewalDate: membershipAffected && membership?.currentPeriodEnd
                ? new Date(membership.currentPeriodEnd).toLocaleDateString('en-NZ', { dateStyle: 'long' })
                : '',
            },
            fallbackSubject: 'Your saved payment card is expiring soon',
            fallbackHtml: renderSavedCardExpiringEmail({
              customerName: (user.fullName || 'there').split(' ')[0],
              cardBrand,
              cardLast4,
              expiryLabel,
              updatePaymentUrl,
              membershipAffected,
              ...(membershipAffected && membership?.currentPeriodEnd
                ? {
                    membershipRenewalDate: new Date(membership.currentPeriodEnd).toLocaleDateString('en-NZ', { dateStyle: 'long' }),
                  }
                : {}),
            }),
            businessFlow: 'subscriptions',
            relatedEntityType: 'user',
            relatedEntityId: String(user._id),
            relatedEntityDisplay: `${cardBrand} ••••${cardLast4}`,
          });

          // In-app notice — deliberately NOT entitlement-gated (see module doc).
          await Notification.create({
            userId: user._id,
            audience: 'customer',
            type: 'saved_card_expiring',
            title: 'Your saved card is expiring soon',
            message: `Your saved ${cardBrand} card ending in ${cardLast4} expires ${expiryLabel}. Update your payment method to avoid interruptions.`,
            data: { paymentMethodId: pm.id, expMonth, expYear },
            priority: 'normal',
            channel: 'reminder',
            actionUrl: '/account/settings',
          });

          await SavedCardExpiryNotice.updateOne(
            { _id: noticeId },
            { $set: { status: 'sent', sentAt: new Date() } },
          );
          result.notified++;
        } catch (err: any) {
          result.failedAttempts++;
          await SavedCardExpiryNotice.updateOne(
            { _id: noticeId },
            { $set: { status: 'failed', lastError: err?.message || 'unknown error' } },
          ).catch(() => {});
          logger.error(
            { err, userId: String(user._id), paymentMethodId: pm.id },
            '[SavedCardExpiry] notification failed — will retry next run',
          );
        }
      }
    } catch (err: any) {
      result.errors++;
      logger.error({ err, userId: String(user._id) }, '[SavedCardExpiry] user scan failed');
    }
  }

  if (result.notified > 0 || result.errors > 0) {
    logger.info({ ...result }, '[SavedCardExpiry] run complete');
  }
  return result;
}
