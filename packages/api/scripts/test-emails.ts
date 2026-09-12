/**
 * Test Script: Send All PawTag Emails
 * 
 * Usage: cd packages/api && tsx scripts/test-emails.ts
 * 
 * This script sends all PawTag email templates to a test recipient
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

const TEST_EMAIL = 'arpanbhagat@yahoo.com';
const DELAY_MS = 500; // Delay between emails to avoid rate limiting

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface TestCase {
  name: string;
  fn: () => Promise<any>;
}

const testCases: TestCase[] = [
  // ─── Account & Security ───
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
    fn: () => sendPasswordChangedEmail(TEST_EMAIL, 'Test User', 'self', '127.0.0.1'),
  },
  {
    name: 'Login Notification (Success)',
    fn: () => sendLoginNotification(TEST_EMAIL, 'Test User', TEST_EMAIL, '127.0.0.1', 'Mozilla/5.0', true),
  },
  {
    name: 'Login Notification (Failed)',
    fn: () => sendLoginNotification(TEST_EMAIL, 'Test User', TEST_EMAIL, '127.0.0.1', 'Mozilla/5.0', false),
  },
  {
    name: 'Account Status (Active)',
    fn: () => sendAccountStatusEmail(TEST_EMAIL, 'Test User', 'active'),
  },

  // ─── Pet & Tag ───
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

  // ─── Orders & Commerce ───
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
      shippingAddress: {
        line1: '123 Test Street',
        city: 'Auckland',
        state: 'Auckland',
        zip: '1010',
      },
    }),
  },
  {
    name: 'Shipping Notification',
    fn: () => sendShippingNotification(
      TEST_EMAIL,
      'Test User',
      'PT-TEST-001',
      'NZ123456789',
      'NZ Post',
      'https://track.nzpost.co.nz/NZ123456789',
    ),
  },
  {
    name: 'Invoice OTP',
    fn: () => sendInvoiceOtpEmail(TEST_EMAIL, 'Test User', 'INV-TEST-001', '123456'),
  },

  // ─── Subscriptions ───
  {
    name: 'Subscription Welcome',
    fn: () => sendSubscriptionWelcomeEmail(
      TEST_EMAIL,
      'Test User',
      'PT-428062',
      'PawTag Annual',
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    ),
  },

  // ─── MFA ───
  {
    name: 'Login MFA OTP',
    fn: () => sendLoginOtpEmail(TEST_EMAIL, 'Test User', '654321', '5 minutes'),
  },

  // ─── Guardian & Loyalty ───
  {
    name: 'Guardian Welcome',
    fn: () => sendGuardianWelcomeEmail(TEST_EMAIL, 'Test User', 'CARE', 100),
  },
  {
    name: 'Tier Upgrade',
    fn: () => sendTierUpgradeEmail(TEST_EMAIL, 'Test User', 'CARE', 'NURTURE', 250, [
      '2x points on purchases',
      'Priority support',
      'Early access to new products',
    ]),
  },
  {
    name: 'Guardian Birthday',
    fn: () => sendGuardianBirthdayEmail(TEST_EMAIL, 'Test User', 'Buddy', 10),
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
    name: 'Guardian Anniversary',
    fn: () => sendGuardianAnniversaryEmail(TEST_EMAIL, 'Test User', 'Buddy', 2, 10),
  },
  {
    name: 'Guardian Renewal Reminder',
    fn: () => sendGuardianRenewalReminderEmail(TEST_EMAIL, 'Test User', 'NURTURE', '2026-12-31', [
      '2x points on purchases',
      'Priority support',
    ]),
  },
];

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  PawTag Email Test Script');
  console.log('═══════════════════════════════════════════════');
  console.log(`\n  Recipient: ${TEST_EMAIL}`);
  console.log(`  Total emails: ${testCases.length}`);
  console.log(`  Delay between emails: ${DELAY_MS}ms\n`);

  // Connect to database
  console.log('Connecting to database...');
  await connectDatabase();
  console.log('Database connected.\n');

  let successCount = 0;
  let failCount = 0;
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    const prefix = `[${i + 1}/${testCases.length}]`;

    try {
      console.log(`${prefix} Sending: ${test.name}...`);
      const result = await test.fn();

      if (result?.success) {
        console.log(`  ✓ Sent (ID: ${result.messageId})`);
        successCount++;
        results.push({ name: test.name, success: true });
      } else {
        console.log(`  ✗ Failed: ${result?.error || 'Unknown error'}`);
        failCount++;
        results.push({ name: test.name, success: false, error: result?.error });
      }
    } catch (err: any) {
      console.log(`  ✗ Error: ${err.message}`);
      failCount++;
      results.push({ name: test.name, success: false, error: err.message });
    }

    // Delay between emails
    if (i < testCases.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Results Summary');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total: ${testCases.length}`);
  console.log(`  ✓ Sent: ${successCount}`);
  console.log(`  ✗ Failed: ${failCount}`);
  console.log('');

  if (failCount > 0) {
    console.log('  Failed emails:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`    - ${r.name}: ${r.error}`);
    });
    console.log('');
  }

  console.log(`  Check ${TEST_EMAIL} inbox for ${successCount} emails.`);
  console.log('  Check Admin Communications Centre > Email Audit for delivery records.');
  console.log('═══════════════════════════════════════════════\n');

  // Wait for fire-and-forget audit records to be written
  console.log('Waiting for audit records to be written...');
  await sleep(3000);

  // Disconnect
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
