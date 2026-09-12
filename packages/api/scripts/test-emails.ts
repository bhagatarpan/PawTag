/**
 * Test Script: Send All PawTag Emails
 * 
 * Usage: cd packages/api && node --env-file=.env --import tsx scripts/test-emails.ts
 * 
 * This script sends ALL PawTag email templates to a test recipient
 * to verify the email system works end-to-end.
 * 
 * Requires: RESEND_API_KEY in .env, MongoDB connection
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from packages/api directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Force Resend to be available by checking the env var
const resendKey = process.env.RESEND_API_KEY;
if (!resendKey) {
  console.error('ERROR: RESEND_API_KEY not found in .env');
  console.error('Please ensure packages/api/.env contains RESEND_API_KEY');
  process.exit(1);
}
console.log(`Resend API key loaded: ${resendKey.substring(0, 10)}...`);

import { connectDatabase, disconnectDatabase } from '@pawtag/db';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendPetFoundEmail,
  sendAccountStatusEmail,
  sendLoginNotification,
  sendOrderConfirmation,
  sendShippingNotification,
  sendSubscriptionWelcomeEmail,
  sendInvoiceOtpEmail,
  sendLoginOtpEmail,
  sendGuardianWelcomeEmail,
  sendTierUpgradeEmail,
  sendGuardianBirthdayEmail,
  sendMonthlySummaryEmail,
  sendPawRewardsReminderEmail,
  sendGuardianAnniversaryEmail,
  sendGuardianRenewalReminderEmail,
} from '../src/services/email.service';
import { sendMail } from '../src/services/email.service';
import {
  renderRefundProcessingEmail,
  renderRefundSettledEmail,
  renderRefundFailedEmail,
  renderOrderStatusEmail,
  renderNewOrderAlertEmail,
  renderReferralRewardEmail,
  renderTierDowngradeWarningEmail,
  renderPetAnniversaryEmail,
  renderEmergencyEscalationEmail,
  renderGenericNotificationEmail,
  renderLowStockAlertEmail,
  renderSubscriptionReminderEmail,
  renderGracePeriodReminderEmail,
  renderPaymentFailureEmail,
  renderGracePeriodStartedEmail,
  renderPaymentRetrySuccessEmail,
  renderPurchasePointsEmail,
} from '../src/services/email/templates';

const TEST_EMAIL = 'arpanbhagat@yahoo.com';
const DELAY_MS = 400;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface TestCase {
  name: string;
  fn: () => Promise<any>;
}

const testCases: TestCase[] = [
  // ═══════════════════════════════════════════
  // Account & Security (7)
  // ═══════════════════════════════════════════
  {
    name: 'Verification Email',
    fn: () => sendVerificationEmail(TEST_EMAIL, 'Test User', 'test-verify-token-123'),
  },
  {
    name: 'Welcome Email',
    fn: () => sendWelcomeEmail(TEST_EMAIL, 'Test User'),
  },
  {
    name: 'Password Reset',
    fn: () => sendPasswordResetEmail(TEST_EMAIL, 'Test User', 'test-reset-token-123'),
  },
  {
    name: 'Password Changed (Self)',
    fn: () => sendPasswordChangedEmail(TEST_EMAIL, 'Test User', 'self', '203.0.113.42', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
  },
  {
    name: 'Login Notification (Success)',
    fn: () => sendLoginNotification(TEST_EMAIL, 'Test User', TEST_EMAIL, '203.0.113.42', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', true),
  },
  {
    name: 'Login Notification (Failed)',
    fn: () => sendLoginNotification(TEST_EMAIL, 'Test User', TEST_EMAIL, '203.0.113.42', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', false),
  },
  {
    name: 'Account Status (Active)',
    fn: () => sendAccountStatusEmail(TEST_EMAIL, 'Test User', 'active'),
  },
  {
    name: 'MFA OTP',
    fn: () => sendLoginOtpEmail(TEST_EMAIL, 'Test User', '654321', '5 minutes'),
  },

  // ═══════════════════════════════════════════
  // Pet & Tag (1)
  // ═══════════════════════════════════════════
  {
    name: 'Pet Found',
    fn: () => sendPetFoundEmail(
      TEST_EMAIL,
      'Test User',
      'Buddy',
      'I found your dog at the park near Ponsonby',
      '+64 21 123 4567',
      'Ponsonby, Auckland',
      'http://localhost:3000/found/PT-428062',
    ),
  },

  // ═══════════════════════════════════════════
  // Orders & Commerce (10)
  // ═══════════════════════════════════════════
  {
    name: 'Order Confirmation',
    fn: () => sendOrderConfirmation({
      to: TEST_EMAIL,
      customerName: 'Test User',
      orderNumber: 'PT-TEST-001',
      total: 89.90,
      items: [
        { productName: 'PawTag Recovery Tag', quantity: 1, unitPrice: 59.99 },
        { productName: 'PawTag Tag Holder', quantity: 2, unitPrice: 14.99 },
      ],
      shippingAddress: { line1: '123 Test Street', city: 'Auckland', state: 'Auckland', zip: '1010' },
    }),
  },
  {
    name: 'Shipping Notification',
    fn: () => sendShippingNotification(TEST_EMAIL, 'Test User', 'PT-TEST-001', 'NZ123456789', 'NZ Post', 'https://track.nzpost.co.nz/NZ123456789'),
  },
  {
    name: 'Invoice OTP',
    fn: () => sendInvoiceOtpEmail(TEST_EMAIL, 'Test User', 'INV-TEST-001', '123456'),
  },
  {
    name: 'Order Status - Packing',
    fn: () => sendMail(TEST_EMAIL, 'Order PT-TEST-001 is being packed', renderOrderStatusEmail({ orderNumber: 'PT-TEST-001', customerName: 'Test User', status: 'packing', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Order Status - Paid',
    fn: () => sendMail(TEST_EMAIL, 'Order PT-TEST-001 confirmed', renderOrderStatusEmail({ orderNumber: 'PT-TEST-001', customerName: 'Test User', status: 'paid', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Order Status - Shipped',
    fn: () => sendMail(TEST_EMAIL, 'Order PT-TEST-001 has shipped', renderOrderStatusEmail({ orderNumber: 'PT-TEST-001', customerName: 'Test User', status: 'shipped', trackingNumber: 'NZ987654321', carrier: 'NZ Post', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Order Status - Delivered',
    fn: () => sendMail(TEST_EMAIL, 'Order PT-TEST-001 delivered', renderOrderStatusEmail({ orderNumber: 'PT-TEST-001', customerName: 'Test User', status: 'delivered', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Order Status - Cancelled',
    fn: () => sendMail(TEST_EMAIL, 'Order PT-TEST-001 cancelled', renderOrderStatusEmail({ orderNumber: 'PT-TEST-001', customerName: 'Test User', status: 'cancelled', reason: 'Changed mind', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Order Status - Refunded',
    fn: () => sendMail(TEST_EMAIL, 'Order PT-TEST-001 refunded', renderOrderStatusEmail({ orderNumber: 'PT-TEST-001', customerName: 'Test User', status: 'refunded', reason: 'Item defective', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Admin Order Alert',
    fn: () => sendMail(TEST_EMAIL, 'New PawTag order: PT-TEST-002', renderNewOrderAlertEmail('PT-TEST-002', 'Test Customer', 'test@example.com', 149.97)),
  },

  // ═══════════════════════════════════════════
  // Refunds (3)
  // ═══════════════════════════════════════════
  {
    name: 'Refund Processing',
    fn: () => sendMail(TEST_EMAIL, 'Refund Processing — Order PT-TEST-001', renderRefundProcessingEmail({ name: 'Test User', orderNumber: 'PT-TEST-001', refundId: 're_test123', amount: 89.90, currency: 'NZD', expectedArrival: '5-10 business days', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Refund Settled',
    fn: () => sendMail(TEST_EMAIL, 'Refund Settled — Order PT-TEST-001', renderRefundSettledEmail({ name: 'Test User', orderNumber: 'PT-TEST-001', refundId: 're_test123', arn: 'ARN1234567890', amount: 89.90, currency: 'NZD', settledAt: '12 Sep 2026', viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },
  {
    name: 'Refund Failed',
    fn: () => sendMail(TEST_EMAIL, 'Refund Update — Order PT-TEST-001', renderRefundFailedEmail({ name: 'Test User', orderNumber: 'PT-TEST-001', refundId: 're_test123', amount: 89.90, currency: 'NZD', failureReason: 'Insufficient funds', willRetry: true, viewOrderUrl: 'http://localhost:3000/account/orders' })),
  },

  // ═══════════════════════════════════════════
  // Subscriptions (6)
  // ═══════════════════════════════════════════
  {
    name: 'Subscription Welcome',
    fn: () => sendSubscriptionWelcomeEmail(TEST_EMAIL, 'Test User', 'PT-428062', 'PawTag Annual', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
  },
  {
    name: 'Subscription Reminder (7-day)',
    fn: () => sendMail(TEST_EMAIL, 'Your PawTag subscription expires in 7 days', renderSubscriptionReminderEmail({ name: 'Test User', tagId: 'PT-428062', daysLeft: 7, type: '7-day', renewUrl: 'http://localhost:3000/account/subscriptions' })),
  },
  {
    name: 'Grace Period Reminder',
    fn: () => sendMail(TEST_EMAIL, 'Grace period: 5 days left to renew', renderGracePeriodReminderEmail({ name: 'Test User', tagId: 'PT-428062', daysLeft: 5, renewUrl: 'http://localhost:3000/account/subscriptions' })),
  },
  {
    name: 'Payment Failure',
    fn: () => sendMail(TEST_EMAIL, 'Payment failed for your PawTag subscription', renderPaymentFailureEmail({ name: 'Test User', tagId: 'PT-428062', retryCount: 1, retriesLeft: 2, updatePaymentUrl: 'http://localhost:3000/account/subscriptions' })),
  },
  {
    name: 'Grace Period Started',
    fn: () => sendMail(TEST_EMAIL, 'Grace period started for your PawTag subscription', renderGracePeriodStartedEmail({ name: 'Test User', tagId: 'PT-428062', gracePeriodWeeks: 2, renewUrl: 'http://localhost:3000/account/subscriptions' })),
  },
  {
    name: 'Payment Retry Success',
    fn: () => sendMail(TEST_EMAIL, 'Payment successful for your PawTag subscription', renderPaymentRetrySuccessEmail({ name: 'Test User', tagId: 'PT-428062' })),
  },

  // ═══════════════════════════════════════════
  // Guardian & Loyalty (10)
  // ═══════════════════════════════════════════
  {
    name: 'Guardian Welcome',
    fn: () => sendGuardianWelcomeEmail(TEST_EMAIL, 'Test User', 'CARE', 100),
  },
  {
    name: 'Tier Upgrade',
    fn: () => sendTierUpgradeEmail(TEST_EMAIL, 'Test User', 'CARE', 'NURTURE', 250, ['2x points on purchases', 'Priority support', 'Early access to new products']),
  },
  {
    name: 'Tier Downgrade Warning',
    fn: () => sendMail(TEST_EMAIL, 'Keep your Protector Guardian status — 7 days left', renderTierDowngradeWarningEmail({ customerName: 'Test User', currentTier: 'Protector', newTier: 'Nurture', points: 150, pointsNeeded: 200, daysRemaining: 7, dashboardUrl: 'http://localhost:3000/account/guardian' })),
  },
  {
    name: 'Guardian Birthday',
    fn: () => sendGuardianBirthdayEmail(TEST_EMAIL, 'Test User', 'Buddy', 10),
  },
  {
    name: 'Guardian Anniversary',
    fn: () => sendGuardianAnniversaryEmail(TEST_EMAIL, 'Test User', 'Buddy', 2, 10),
  },
  {
    name: 'Monthly Summary',
    fn: () => sendMonthlySummaryEmail(TEST_EMAIL, 'Test User', 'NURTURE', 150, 500, 25.50, 10),
  },
  {
    name: 'PawRewards Reminder',
    fn: () => sendPawRewardsReminderEmail(TEST_EMAIL, 'Test User', 25.50, '2026-12-31', 15.00),
  },
  {
    name: 'Guardian Renewal Reminder',
    fn: () => sendGuardianRenewalReminderEmail(TEST_EMAIL, 'Test User', 'NURTURE', '2026-12-31', ['2x points on purchases', 'Priority support']),
  },
  {
    name: 'Purchase Points',
    fn: async () => sendMail(TEST_EMAIL, 'You earned 50 Guardian Points!', await renderPurchasePointsEmail({ customerName: 'Test User', orderNumber: 'PT-TEST-001', pointsEarned: 50, totalPoints: 300, tier: 'Nurture', pointsToNextTier: 200, nextTier: 'Protector', isGoldMember: false, dashboardUrl: 'http://localhost:3000/account/guardian' })),
  },
  {
    name: 'Gold Welcome',
    fn: async () => sendMail(TEST_EMAIL, 'Welcome to PawTag Gold Membership', await renderPurchasePointsEmail({ customerName: 'Test User', orderNumber: 'PT-TEST-001', pointsEarned: 100, totalPoints: 100, tier: 'Gold', pointsToNextTier: null, nextTier: null, isGoldMember: true, dashboardUrl: 'http://localhost:3000/account/guardian' })),
  },

  // ═══════════════════════════════════════════
  // Referrals (1)
  // ═══════════════════════════════════════════
  {
    name: 'Referral Reward',
    fn: () => sendMail(TEST_EMAIL, 'You earned a referral reward!', renderReferralRewardEmail({ referrerName: 'Test User', rewardMonths: 1 })),
  },

  // ═══════════════════════════════════════════
  // Lost & Found (1)
  // ═══════════════════════════════════════════
  {
    name: 'Emergency Escalation',
    fn: () => sendMail(TEST_EMAIL, 'Urgent: Test User\'s pet Buddy was found - action needed', renderEmergencyEscalationEmail({ ownerName: 'Test User', petName: 'Buddy', tagId: 'PT-428062', finderName: 'Jane Smith', finderPhone: '+64 21 987 6543', finderEmail: 'jane@example.com', viewDetailsUrl: 'http://localhost:3000/account' })),
  },

  // ═══════════════════════════════════════════
  // Admin / System (3)
  // ═══════════════════════════════════════════
  {
    name: 'Low Stock Alert',
    fn: () => sendMail(TEST_EMAIL, '[PawTag] Low Stock Alert — 2 product(s)', renderLowStockAlertEmail({ threshold: 10, products: [{ name: 'PawTag Recovery Tag', sku: 'PT-001', stock: 3, price: 59.99 }, { name: 'PawTag Tag Holder', sku: 'PT-002', stock: 7, price: 14.99 }] })),
  },
  {
    name: 'Support Request Alert',
    fn: () => sendMail(TEST_EMAIL, '[PawTag Support] New message from Test User', renderGenericNotificationEmail({ title: 'New Support Request', message: 'A customer has submitted a support request regarding their order.' })),
  },
  {
    name: 'Generic Notification',
    fn: () => sendMail(TEST_EMAIL, 'PawTag Notification', renderGenericNotificationEmail({ title: 'System Notification', message: 'This is a test notification from PawTag.', actionUrl: 'http://localhost:3000/account' })),
  },
];

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  PawTag Email Test Script — Full Suite');
  console.log('═══════════════════════════════════════════════');
  console.log(`\n  Recipient: ${TEST_EMAIL}`);
  console.log(`  Total emails: ${testCases.length}`);
  console.log(`  Delay between emails: ${DELAY_MS}ms\n`);

  console.log('Connecting to database...');
  await connectDatabase();
  console.log('Database connected.\n');

  let successCount = 0;
  let failCount = 0;
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    const prefix = `[${String(i + 1).padStart(2, '0')}/${testCases.length}]`;

    try {
      process.stdout.write(`${prefix} ${test.name}...`);
      const result = await test.fn();

      if (result?.success) {
        console.log(` ✓`);
        successCount++;
        results.push({ name: test.name, success: true });
      } else {
        console.log(` ✗ ${result?.error || 'Unknown error'}`);
        failCount++;
        results.push({ name: test.name, success: false, error: result?.error });
      }
    } catch (err: any) {
      console.log(` ✗ ${err.message}`);
      failCount++;
      results.push({ name: test.name, success: false, error: err.message });
    }

    if (i < testCases.length - 1) await sleep(DELAY_MS);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Results Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total: ${testCases.length}`);
  console.log(`  ✓ Sent: ${successCount}`);
  console.log(`  ✗ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n  Failed emails:');
    results.filter(r => !r.success).forEach(r => console.log(`    - ${r.name}: ${r.error}`));
  }

  console.log(`\n  Check ${TEST_EMAIL} inbox for ${successCount} emails.`);
  console.log('  Check Admin Communications Centre > Email Audit for delivery records.');
  console.log('═══════════════════════════════════════════════\n');

  await sleep(3000);
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
