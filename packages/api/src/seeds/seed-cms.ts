import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { config } from '../config';
import {
  connectDatabase,
  disconnectDatabase,
  User,
  Setting,
  CmsNavigation,
  CmsFooter,
  CmsPage,
  CmsHomepageSection,
  CmsEmailTemplate,
  CmsSmsTemplate,
  CmsPetReference,
  CmsShopPage,
  CmsAuthPage,
  CmsOnboarding,
} from '@pawtag/db';

async function run() {
  console.log(' CMS Seed Script');
  console.log('═══════════════════════════════════════\n');

  await connectDatabase(config.dbUrl);
  console.log('Connected to database\n');

  const adminUser = await User.findOne({ email: 'admin@pawtag.co.nz' });
  if (!adminUser) {
    console.error('Admin user not found. Run seed.ts first.');
    process.exit(1);
  }
  const adminId = adminUser._id;
  console.log(`Admin user: ${adminUser.email} (${adminUser._id})\n`);

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      // ═══════════════════════════════════════
      // 1. SETTINGS
      // ═══════════════════════════════════════
      console.log('--- Seeding Settings ---');
      const auditCategories = ['AUTH', 'AUTHZ', 'CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT', 'TRANSITION', 'FINANCIAL', 'SECURITY', 'ADMIN', 'SYSTEM', 'INTEGRATION', 'FILE', 'CONFIG'];
      const auditActors = ['USER', 'ADMIN', 'CSR', 'WEB_EDITOR', 'DESIGNER', 'AUTHOR', 'SERVICE', 'SYSTEM', 'SCHEDULED_JOB', 'API_CLIENT', 'WEBHOOK', 'AI_AGENT', 'FINDER', 'UNKNOWN'];
      const settings: Array<{ key: string; value: string; displayValue?: string; category: string; description?: string }> = [
        { key: 'site.name', value: 'PawTag', displayValue: 'Site Name', category: 'site' },
        { key: 'site.tagline', value: 'Never Lose Your Pet Again', displayValue: 'Tagline', category: 'site' },
        { key: 'site.description', value: 'Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.', displayValue: 'Site Description', category: 'site' },
        { key: 'site.maintenanceMode', value: 'false', displayValue: 'Maintenance Mode', category: 'site', description: 'When enabled, visitors can browse but actions are blocked. Shows maintenance banner.' },
        { key: 'site.offlineMode', value: 'false', displayValue: 'Offline Mode', category: 'site', description: 'When enabled, the site is unavailable to all visitors except administrators.' },
        { key: 'site.maintenanceTitle', value: 'PawTag is currently under maintenance', displayValue: 'Maintenance Banner Title', category: 'site', description: 'Title shown in the maintenance warning banner' },
        { key: 'site.maintenanceMessage', value: 'Some website functionality is temporarily unavailable. Please check back shortly.', displayValue: 'Maintenance Banner Message', category: 'site', description: 'Message shown in the maintenance warning banner' },
        { key: 'site.offlineTitle', value: 'PawTag is currently offline', displayValue: 'Offline Page Title', category: 'site', description: 'Title shown on the offline page' },
        { key: 'site.offlineMessage', value: 'Please come back later.', displayValue: 'Offline Page Message', category: 'site', description: 'Message shown on the offline page' },
        { key: 'site.availabilityPollingInterval', value: '30', displayValue: 'Availability Polling Interval (seconds)', category: 'site', description: 'How often frontends check site availability status (in seconds)' },
        { key: 'company.name', value: 'PawTag', displayValue: 'Company Name', category: 'company' },
        { key: 'company.email', value: 'support@pawtag.co.nz', displayValue: 'Company Email', category: 'company' },
        { key: 'company.phone', value: '+64 21 123 4567', displayValue: 'Company Phone', category: 'company' },
        { key: 'company.address', value: 'Auckland, New Zealand', displayValue: 'Company Address', category: 'company' },
        { key: 'contact.businessHours', value: 'Mon-Fri: 7am-6pm, Sat: 8am-2pm', displayValue: 'Business Hours', category: 'contact' },
        { key: 'contact.businessHoliday', value: 'Christmas day, Boxing day, Waitangi day, ANZAC day', displayValue: 'Public Holidays', category: 'contact' },
        { key: 'seo.defaultTitle', value: 'PawTag - Never Lose Your Pet Again', displayValue: 'Default Page Title', category: 'seo' },
        { key: 'seo.defaultDescription', value: 'Smart QR-coded pet recovery tags. Because every pet deserves a safe way home.', displayValue: 'Default Meta Description', category: 'seo' },
        { key: 'seo.defaultKeywords', value: 'pet recovery, QR code, pet tag, lost pet, found pet, pet safety, New Zealand', displayValue: 'Default Keywords', category: 'seo' },
        { key: 'social.facebook', value: 'https://facebook.com/pawtag', displayValue: 'Facebook URL', category: 'social' },
        { key: 'social.instagram', value: 'https://instagram.com/pawtag', displayValue: 'Instagram URL', category: 'social' },
        { key: 'urls.customerPortal', value: 'http://localhost:3000', displayValue: 'Customer Portal URL', category: 'urls', description: 'Customer portal is served by the web app (port 3000)' },
        { key: 'urls.finderPortal', value: 'http://localhost:3003', displayValue: 'Finder Portal URL', category: 'urls' },
        { key: 'urls.frontend', value: 'http://localhost:3000', displayValue: 'Frontend URL', category: 'urls' },
        { key: 'emails.senderName', value: 'PawTag', displayValue: 'Sender Name', category: 'emails' },
        { key: 'emails.senderEmail', value: 'no-reply@pawtag.co.nz', displayValue: 'Sender Email', category: 'emails' },
        { key: 'emails.supportEmail', value: 'support@pawtag.co.nz', displayValue: 'Support Email', category: 'emails' },
        { key: 'checkout.defaultCountry', value: 'NZ', displayValue: 'Default Country', category: 'checkout' },
        { key: 'checkout.currencyLabel', value: 'NZD', displayValue: 'Currency', category: 'checkout' },
        { key: 'checkout.trustBadges.title', value: 'All PawTag devices come with', displayValue: 'Trust Badge Title', category: 'checkout', description: 'Title shown in the trust badge section on cart/checkout' },
        { key: 'checkout.trustBadges.items', value: JSON.stringify(['Lifetime activation', 'Replace if lost', '24/7 support']), displayValue: 'Trust Badge Items', category: 'checkout', description: 'JSON array of trust badge items shown on cart/checkout' },
        { key: 'checkout.otp.enabled', value: 'true', displayValue: 'Checkout OTP Verification', category: 'checkout', description: 'When true, users must verify via email + SMS OTP before checkout' },
        { key: 'checkout.otp.expiryMinutes', value: '15', displayValue: 'Checkout OTP Expiry (minutes)', category: 'checkout', description: 'How long checkout verification remains valid after both OTPs are verified' },
        { key: 'checkout.otp.requireEmail', value: 'true', displayValue: 'Require Email OTP', category: 'checkout', description: 'When true, email OTP is required for checkout verification' },
        { key: 'checkout.otp.requireSms', value: 'true', displayValue: 'Require SMS OTP', category: 'checkout', description: 'When true, SMS OTP is required for checkout verification' },
        { key: 'addressAutocomplete.provider', value: 'photon', displayValue: 'Address Provider', category: 'addressAutocomplete', description: 'Address autocomplete provider: nzpost (authoritative NZ data, free 1000/mo) or photon (global, free, less accurate)' },
        { key: 'addressAutocomplete.nzpostClientId', value: '', displayValue: 'NZ Post Client ID', category: 'addressAutocomplete', description: 'OAuth 2.0 Client ID for NZ Post Addressing API (get from nzpost.co.nz/business/ecommerce/developer-resource-centre)' },
        { key: 'addressAutocomplete.nzpostClientSecret', value: '', displayValue: 'NZ Post Client Secret', category: 'addressAutocomplete', description: 'OAuth 2.0 Client Secret for NZ Post Addressing API' },
        { key: 'addressAutocomplete.defaultCountry', value: 'NZ', displayValue: 'Default Country', category: 'addressAutocomplete', description: 'Default country code for address autocomplete (ISO 3166-1 alpha-2)' },
        { key: 'mfa.adminEnabled', value: 'false', displayValue: 'Admin MFA', category: 'mfa', description: 'Global toggle for admin/CSR MFA' },
        { key: 'mfa.customerEnabled', value: 'true', displayValue: 'Customer MFA', category: 'mfa', description: 'Default MFA setting for new customer registrations' },
        { key: 'mfa.testMode', value: 'true', displayValue: 'MFA Test Mode', category: 'mfa', description: 'Send MFA OTP and verification emails to test email instead of actual user (dev mode only)' },
        { key: 'mfa.testEmail', value: 'arpanbhagat@yahoo.com', displayValue: 'MFA Test Email', category: 'mfa', description: 'Test email address for MFA in dev mode' },
        { key: 'tag.idPrefix', value: 'PT', displayValue: 'Tag ID Prefix', category: 'tag', description: 'Prefix for auto-generated tag IDs (e.g. PT → PT-NNNNNN)' },
        { key: 'finder.showOwnerName', value: 'true', displayValue: 'Show Owner Name', category: 'finder', description: 'Global toggle: show pet owner name in finder portal. When off, suburb and city are shown instead.' },
        { key: 'rateLimit.global.max', value: '1000', displayValue: 'Global Rate Limit', category: 'rateLimit', description: 'Max requests per 15 minutes per IP for general API' },
        { key: 'rateLimit.auth.login.max', value: '5', displayValue: 'Login Rate Limit', category: 'rateLimit', description: 'Max login attempts per 15 minutes per IP' },
        { key: 'rateLimit.auth.register.max', value: '3', displayValue: 'Registration Rate Limit', category: 'rateLimit', description: 'Max registration attempts per hour per IP' },
        { key: 'rateLimit.auth.forgotPassword.max', value: '3', displayValue: 'Password Reset Rate Limit', category: 'rateLimit', description: 'Max password reset attempts per hour per IP' },
        { key: 'rateLimit.finder.view.max', value: '30', displayValue: 'Finder View Rate Limit', category: 'rateLimit', description: 'Max pet info lookups per hour per IP' },
        { key: 'rateLimit.finder.notify.max', value: '5', displayValue: 'Finder Notify Rate Limit', category: 'rateLimit', description: 'Max owner notifications per hour per IP' },
        { key: 'rateLimit.finder.location.max', value: '10', displayValue: 'Finder Location Rate Limit', category: 'rateLimit', description: 'Max location shares per hour per IP' },
        { key: 'rateLimit.auth.mfaSend.max', value: '1', displayValue: 'OTP Send Rate Limit', category: 'rateLimit', description: 'Max OTP send attempts per 30 seconds per IP' },
        { key: 'rateLimit.auth.mfaVerify.max', value: '5', displayValue: 'OTP Verify Rate Limit', category: 'rateLimit', description: 'Max OTP verify attempts per 15 minutes per IP' },
        { key: 'escalation.delayMinutes', value: '30', displayValue: 'Escalation Delay (minutes)', category: 'escalation', description: 'Minutes to wait before auto-notifying emergency contact if owner does not respond' },
        { key: 'escalation.notifyEmergencyContact', value: 'true', displayValue: 'Auto-Notify Emergency Contact', category: 'escalation', description: 'Auto-notify emergency contact when escalation delay expires' },
        { key: 'escalation.enableManualForward', value: 'true', displayValue: 'Manual Forward to Emergency Contact', category: 'escalation', description: 'Allow owner to manually forward found notification to emergency contact' },
        { key: 'otp.skipOtpDuringRegistration', value: 'false', displayValue: 'Skip Phone OTP During Registration', category: 'otp', description: 'When true, system-wide registration phone OTP is skipped. Use during SMS service outages.' },
        { key: 'otp.skipOtpForInvoice', value: 'false', displayValue: 'Skip OTP for Invoice Access', category: 'otp', description: 'When true, system-wide invoice OTP is skipped. Use during OTP service outages.' },
        ...auditCategories.map((value) => ({ key: `audit.policy.category.${value.toLowerCase()}`, value: 'true', displayValue: `Audit: ${value}`, category: 'audit', description: `Enable audit logging for ${value} events` })),
        ...auditActors.map((value) => ({ key: `audit.policy.actor.${value.toLowerCase()}`, value: 'true', displayValue: `Audit: ${value} Actor`, category: 'audit', description: `Enable audit logging for ${value} actors` })),
        { key: 'audit.settings.identifyAnonymousActors', value: 'true', displayValue: 'Identify Anonymous Actors', category: 'audit', description: 'When enabled, attempts to identify anonymous users from JWT tokens even when auth fails' },
        { key: 'audit.settings.skipPollingEndpoints', value: 'true', displayValue: 'Skip Polling Endpoints', category: 'audit', description: 'When enabled, skips audit logging for automated polling endpoints (e.g., notification badge checks)' },
        // System Log Settings
        { key: 'systemLog.enabled', value: 'true', displayValue: 'System Logging Enabled', category: 'systemLog', description: 'Master toggle for system log storage in MongoDB' },
        { key: 'systemLog.level.debug', value: 'false', displayValue: 'Log Level: Debug', category: 'systemLog', description: 'Store debug-level logs. High volume. Enable only when troubleshooting.' },
        { key: 'systemLog.level.info', value: 'true', displayValue: 'Log Level: Info', category: 'systemLog', description: 'Store info-level logs. General operational events.' },
        { key: 'systemLog.level.warn', value: 'true', displayValue: 'Log Level: Warning', category: 'systemLog', description: 'Store warning-level logs. Potential issues and degraded operations.' },
        { key: 'systemLog.level.error', value: 'true', displayValue: 'Log Level: Error', category: 'systemLog', description: 'Store error-level logs. Application errors and failures.' },
        { key: 'systemLog.level.fatal', value: 'true', displayValue: 'Log Level: Fatal', category: 'systemLog', description: 'Store fatal-level logs. Critical failures causing process exit.' },
        { key: 'systemLog.category.HTTP', value: 'true', displayValue: 'Category: HTTP', category: 'systemLog', description: 'Store HTTP request/response logs.' },
        { key: 'systemLog.category.DATABASE', value: 'true', displayValue: 'Category: Database', category: 'systemLog', description: 'Store database operation and slow query logs.' },
        { key: 'systemLog.category.AUTH', value: 'true', displayValue: 'Category: Auth', category: 'systemLog', description: 'Store authentication and identity event logs.' },
        { key: 'systemLog.category.INTEGRATION', value: 'true', displayValue: 'Category: Integration', category: 'systemLog', description: 'Store external service call logs (Stripe, Resend, Twilio, etc.).' },
        { key: 'systemLog.category.JOB', value: 'true', displayValue: 'Category: Job', category: 'systemLog', description: 'Store background job and scheduled task logs.' },
        { key: 'systemLog.category.SECURITY', value: 'true', displayValue: 'Category: Security', category: 'systemLog', description: 'Store rate limiting, CAPTCHA, and security event logs.' },
        { key: 'systemLog.category.NOTIFICATION', value: 'true', displayValue: 'Category: Notification', category: 'systemLog', description: 'Store notification delivery logs.' },
        { key: 'systemLog.category.CONFIG', value: 'true', displayValue: 'Category: Config', category: 'systemLog', description: 'Store configuration and settings change logs.' },
        { key: 'systemLog.category.GENERAL', value: 'true', displayValue: 'Category: General', category: 'systemLog', description: 'Store uncategorized logs.' },
        { key: 'systemLog.sampling.debug', value: '100', displayValue: 'Debug Sampling %', category: 'systemLog', description: 'Percentage of debug logs to store (0-100). 100 = store all.' },
        { key: 'systemLog.sampling.info', value: '100', displayValue: 'Info Sampling %', category: 'systemLog', description: 'Percentage of info logs to store (0-100). 100 = store all.' },
        { key: 'systemLog.sampling.warn', value: '100', displayValue: 'Warning Sampling %', category: 'systemLog', description: 'Percentage of warning logs to store (0-100). 100 = store all.' },
        { key: 'systemLog.sampling.error', value: '100', displayValue: 'Error Sampling %', category: 'systemLog', description: 'Percentage of error logs to store (0-100). 100 = store all.' },
        { key: 'systemLog.sampling.fatal', value: '100', displayValue: 'Fatal Sampling %', category: 'systemLog', description: 'Percentage of fatal logs to store (0-100). 100 = store all.' },
        { key: 'systemLog.retentionDays', value: '30', displayValue: 'Log Retention (days)', category: 'systemLog', description: 'Number of days to keep system logs before automatic deletion.' },
        // Commerce Settings (PawTag-native) — All 35 settings from config.ts
        // Payment
        { key: 'commerce.payment.provider', value: 'stripe', displayValue: 'Payment Provider', category: 'commerce', description: 'Payment provider identifier' },
        { key: 'commerce.payment.currency', value: 'NZD', displayValue: 'Currency', category: 'commerce', description: 'Default currency code' },
        { key: 'commerce.payment.testMode', value: 'true', displayValue: 'Test Mode', category: 'commerce', description: 'Enable demo/test payment mode' },
        // Shipping
        { key: 'commerce.shipping.enabled', value: 'true', displayValue: 'Shipping Enabled', category: 'commerce', description: 'Enable shipping calculation' },
        { key: 'commerce.shipping.provider', value: 'nz-shipping', displayValue: 'Shipping Provider', category: 'commerce', description: 'Shipping provider identifier' },
        { key: 'commerce.shipping.freeEnabled', value: 'true', displayValue: 'Free Shipping', category: 'commerce', description: 'Enable free shipping' },
        { key: 'commerce.shipping.freeThreshold', value: '0', displayValue: 'Free Shipping Threshold', category: 'commerce', description: 'Minimum order for free shipping (0 = always free)' },
        { key: 'commerce.shipping.flatRate', value: '0', displayValue: 'Flat Rate Shipping', category: 'commerce', description: 'Flat rate shipping cost (0 = free)' },
        { key: 'commerce.shipping.taxEnabled', value: 'false', displayValue: 'Tax on Shipping', category: 'commerce', description: 'Apply tax to shipping' },
        // Tax
        { key: 'commerce.tax.enabled', value: 'true', displayValue: 'Tax Enabled', category: 'commerce', description: 'Enable tax calculation' },
        { key: 'commerce.tax.provider', value: 'nz-gst', displayValue: 'Tax Provider', category: 'commerce', description: 'Tax provider identifier' },
        { key: 'commerce.tax.rate', value: '0.15', displayValue: 'Tax Rate', category: 'commerce', description: 'Tax rate (0.15 = 15% GST)' },
        { key: 'commerce.tax.label', value: 'GST', displayValue: 'Tax Label', category: 'commerce', description: 'Tax label for display' },
        { key: 'commerce.tax.inclusive', value: 'true', displayValue: 'Tax Inclusive', category: 'commerce', description: 'Prices include tax' },
        // Inventory
        { key: 'commerce.inventory.enabled', value: 'true', displayValue: 'Inventory Tracking', category: 'commerce', description: 'Enable inventory tracking' },
        { key: 'commerce.inventory.lowStockThreshold', value: '10', displayValue: 'Low Stock Threshold', category: 'commerce', description: 'Low stock alert threshold' },
        { key: 'commerce.inventory.outOfStockThreshold', value: '0', displayValue: 'Out of Stock Threshold', category: 'commerce', description: 'Out of stock threshold' },
        { key: 'commerce.inventory.defaultPolicy', value: 'deny', displayValue: 'Default Stock Policy', category: 'commerce', description: 'Default stock policy (deny or allow)' },
        { key: 'commerce.inventory.reservationTtlMinutes', value: '30', displayValue: 'Reservation TTL (min)', category: 'commerce', description: 'How long to hold stock during checkout' },
        // Checkout
        { key: 'commerce.checkout.guestEnabled', value: 'false', displayValue: 'Guest Checkout', category: 'commerce', description: 'Allow guest checkout' },
        { key: 'commerce.checkout.verificationRequired', value: 'true', displayValue: 'Verification Required', category: 'commerce', description: 'Require email+phone verification' },
        { key: 'commerce.checkout.termsRequired', value: 'true', displayValue: 'Terms Required', category: 'commerce', description: 'Require terms acceptance' },
        { key: 'commerce.checkout.pendingOrderTtlMinutes', value: '30', displayValue: 'Pending Order TTL (min)', category: 'commerce', description: 'How long a pending order is held' },
        // Orders
        { key: 'commerce.orders.autoCancelMinutes', value: '60', displayValue: 'Auto-Cancel (min)', category: 'commerce', description: 'Auto-cancel unpaid orders after minutes' },
        { key: 'commerce.orders.cancellationReasons', value: JSON.stringify(['Ordered by mistake', 'Found a better price', 'Shipping takes too long', 'Need to change address or payment', 'Item not as described', 'Duplicate order', 'Financial reasons', 'Other']), displayValue: 'Cancellation Reasons', category: 'commerce', description: 'Predefined reasons selectable when cancelling an order' },
        { key: 'commerce.orders.numberPrefix', value: 'PT', displayValue: 'Order Number Prefix', category: 'commerce', description: 'Order number prefix' },
        { key: 'commerce.orders.numberLength', value: '6', displayValue: 'Order Number Length', category: 'commerce', description: 'Order number length after prefix' },
        // Subscriptions
        { key: 'commerce.subscriptions.annualPrice', value: '0.99', displayValue: 'Annual Subscription Price', category: 'commerce', description: 'Annual subscription price (NZD)' },
        { key: 'commerce.subscriptions.monthlyPrice', value: '1.99', displayValue: 'Monthly Subscription Price', category: 'commerce', description: 'Monthly subscription price (NZD)' },
        { key: 'commerce.subscriptions.freePeriodMonths', value: '12', displayValue: 'Free Period (months)', category: 'commerce', description: 'Free period in months' },
        { key: 'commerce.subscriptions.gracePeriodWeeks', value: '4', displayValue: 'Grace Period (weeks)', category: 'commerce', description: 'Grace period in weeks' },
        // Refunds
        { key: 'commerce.refunds.enabled', value: 'true', displayValue: 'Refunds Enabled', category: 'commerce', description: 'Allow refunds' },
        { key: 'commerce.refunds.maxDaysAfterPurchase', value: '60', displayValue: 'Refund Window (days)', category: 'commerce', description: 'Maximum days after purchase for refund' },
        { key: 'commerce.refunds.partialEnabled', value: 'true', displayValue: 'Partial Refunds', category: 'commerce', description: 'Allow partial refunds' },
        // Promotions
        { key: 'commerce.promotions.enabled', value: 'true', displayValue: 'Promotions Enabled', category: 'commerce', description: 'Enable discount codes' },
        { key: 'commerce.promotions.maxUsesPerCode', value: '1000', displayValue: 'Max Uses Per Code', category: 'commerce', description: 'Maximum uses per discount code' },
        { key: 'commerce.promotions.bundle2Items', value: '10', displayValue: 'Bundle Discount (2 items)', category: 'commerce', description: 'Bundle discount % for 2 items' },
        { key: 'commerce.promotions.bundle3PlusItems', value: '15', displayValue: 'Bundle Discount (3+ items)', category: 'commerce', description: 'Bundle discount % for 3+ items' },
        // Notifications
        { key: 'commerce.notifications.orderConfirmation', value: 'true', displayValue: 'Order Confirmation Email', category: 'commerce', description: 'Send order confirmation email' },
        { key: 'commerce.notifications.invoiceEmail', value: 'true', displayValue: 'Invoice Email', category: 'commerce', description: 'Send invoice email' },
        { key: 'commerce.notifications.adminAlert', value: 'true', displayValue: 'Admin Alert', category: 'commerce', description: 'Send admin alert for new orders' },
        { key: 'commerce.notifications.shippingUpdate', value: 'true', displayValue: 'Shipping Update', category: 'commerce', description: 'Send shipping update email' },
        // Feature Flags
        { key: 'commerce.feature.stripeSignatureVerification', value: 'true', displayValue: 'Stripe Signature Verification', category: 'commerce', description: 'Verify Stripe webhook signatures' },
        { key: 'commerce.feature.orphanPaymentDetection', value: 'true', displayValue: 'Orphan Payment Detection', category: 'commerce', description: 'Detect orphaned payments' },
        { key: 'commerce.feature.priceValidation', value: 'true', displayValue: 'Price Validation', category: 'commerce', description: 'Server-side price validation' },
        // Sync (retained for polling)
        { key: 'sync.polling.enabled', value: 'true', displayValue: 'Customer Polling Enabled', category: 'sync', description: 'Enable automatic order list polling on the customer Orders page' },
        { key: 'sync.polling.intervalSeconds', value: '30', displayValue: 'Customer Polling Interval (seconds)', category: 'sync', description: 'How often the customer Orders page polls for updates' },
      ];

      let settingsCreated = 0;
      let settingsUpdated = 0;
      for (const s of settings) {
        const existing = await Setting.findOne({ key: s.key }).session(session);
        if (!existing) {
          await Setting.create([{ ...s, updatedBy: adminId }], { session });
          settingsCreated++;
        } else if (s.displayValue && !existing.displayValue) {
          await Setting.updateOne({ key: s.key }, { $set: { displayValue: s.displayValue } }).session(session);
          settingsUpdated++;
        }
      }
      // Remove duplicate contact.* keys (use company.* instead)
      await Setting.deleteMany({ key: { $in: ['contact.email', 'contact.phone', 'contact.address'] } }).session(session);
      // Remove deprecated OTP keys (replaced by otp.skipOtp*)
      await Setting.deleteMany({ key: { $in: ['otp.noOtpForInvoice', 'otp.noOtpDuringRegistration'] } }).session(session);
      console.log(`  ${settingsCreated} new settings created, ${settingsUpdated} existing settings updated with displayValue (${settings.length} total)\n`);

      // ═══════════════════════════════════════
      // 2. NAVIGATION
      // ═══════════════════════════════════════
      console.log('--- Seeding Navigation ---');
      const existingNav = await CmsNavigation.findOne({ location: 'header', deletedAt: null }).session(session);
      if (!existingNav) {
        await CmsNavigation.create([{
          name: 'Main Navigation',
          slug: 'main-navigation',
          location: 'header',
          items: [
            { label: 'Home', url: '/', order: 0, visible: true },
            { label: 'Shop', url: '/shop', order: 1, visible: true },
            { label: 'About', url: '/about', order: 2, visible: true },
            { label: 'FAQ', url: '/faq', order: 3, visible: true },
            { label: 'Contact', url: '/contact', order: 4, visible: true },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created header navigation');
      } else {
        console.log('  Header navigation already exists');
      }

      const existingFooterNav = await CmsNavigation.findOne({ location: 'footer', deletedAt: null }).session(session);
      if (!existingFooterNav) {
        await CmsNavigation.create([{
          name: 'Footer Navigation',
          slug: 'footer-navigation',
          location: 'footer',
          items: [
            { label: 'Privacy', url: '/privacy', order: 0, visible: true },
            { label: 'Terms', url: '/terms', order: 1, visible: true },
            { label: 'FAQ', url: '/faq', order: 2, visible: true },
            { label: 'Contact', url: '/contact', order: 3, visible: true },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created footer navigation');
      } else {
        console.log('  Footer navigation already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 3. FOOTER
      // ═══════════════════════════════════════
      console.log('--- Seeding Footer ---');
      const existingFooter = await CmsFooter.findOne({ deletedAt: null }).session(session);
      if (!existingFooter) {
        await CmsFooter.create([{
          name: 'Main Footer',
          groups: [
            {
              groupId: 'quick-links',
              title: 'Quick Links',
              visible: true,
              order: 0,
              links: [
                { label: 'Shop', url: '/shop', order: 0, visible: true },
                { label: 'About', url: '/about', order: 1, visible: true },
                { label: 'FAQ', url: '/faq', order: 2, visible: true },
                { label: 'Contact', url: '/contact', order: 3, visible: true },
                { label: 'Sign In', url: '/login', order: 4, visible: true },
              ],
            },
            {
              groupId: 'support',
              title: 'Support',
              visible: true,
              order: 1,
              links: [
                { label: 'support@pawtag.co.nz', url: 'mailto:support@pawtag.co.nz', order: 0, visible: true },
                { label: '+64 21 123 4567', url: 'tel:+64211234567', order: 1, visible: true },
              ],
            },
          ],
          copyright: 'PawTag. All rights reserved.',
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created footer configuration');
      } else {
        console.log('  Footer configuration already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 4. HOMEPAGE SECTIONS
      // ═══════════════════════════════════════
      console.log('--- Seeding Homepage Sections ---');
      const existingHero = await CmsHomepageSection.findOne({ sectionType: 'hero_slide', deletedAt: null }).session(session);
      if (!existingHero) {
        await CmsHomepageSection.create([
          {
            sectionType: 'hero_slide',
            title: 'Hero Slide 1',
            content: {
              tag: 'Emotional',
              headline: "They can't tell anyone where they live.",
              sub: "Let their tag do the talking.",
              ctaText: 'Protect Your Pet',
              ctaUrl: '/shop',
              bg: 'from-primary-700 via-primary-600 to-primary-800',
              visualType: 'paw',
              duration: 5,
              stats: [],
              flowSteps: [],
              imageUrl: '',
              imageAlt: '',
            },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'hero_slide',
            title: 'Hero Slide 2',
            content: {
              tag: 'Functional',
              headline: 'Scan. Locate. Reunite.',
              sub: 'From lost to home in three simple steps.',
              ctaText: 'Shop QR Tags',
              ctaUrl: '/shop',
              bg: 'from-primary-800 via-primary-700 to-primary-600',
              visualType: 'flow',
              duration: 5,
              stats: [],
              flowSteps: [
                { icon: 'PawPrint', label: 'Finder', desc: 'Finds pet' },
                { icon: 'Scan', label: 'Scan', desc: 'Scans tag' },
                { icon: 'UserCheck', label: 'Profile', desc: 'Sees info' },
                { icon: 'Phone', label: 'Contact', desc: 'Calls owner' },
                { icon: 'MapPin', label: 'Reunited', desc: 'Pet home' },
              ],
              imageUrl: '',
              imageAlt: '',
            },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'hero_slide',
            title: 'Hero Slide 3',
            content: {
              tag: 'Trust',
              headline: 'Trusted by thousands of pet owners',
              sub: 'Join a community that never stops looking out for each other.',
              ctaText: 'See How It Works',
              ctaUrl: '/about',
              bg: 'from-primary-600 via-primary-700 to-primary-800',
              visualType: 'stats',
              duration: 5,
              stats: [
                { number: '14K+', label: 'Pets Protected' },
                { number: '42', label: 'Reunited Today' },
                { number: '98%', label: 'Success Rate' },
              ],
              flowSteps: [],
              imageUrl: '',
              imageAlt: '',
            },
            order: 2,
            isActive: true,
          },
        ], { session });
        console.log('  Created 3 hero slides');
      } else {
        console.log('  Hero slides already exist');
      }

      const existingHowItWorks = await CmsHomepageSection.findOne({ sectionType: 'how_it_works', deletedAt: null }).session(session);
      if (!existingHowItWorks) {
        await CmsHomepageSection.create([
          {
            sectionType: 'how_it_works',
            title: 'Register Your Pet',
            content: { icon: 'UserPlus', title: 'Register Your Pet', desc: "Create a secure profile with your pet's name, photo, medical needs, and your contact details.", iconBg: 'bg-primary-600' },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'how_it_works',
            title: 'Attach Your PawTag',
            content: { icon: 'Tag', title: 'Attach Your PawTag', desc: "Clip the durable QR tag onto your pet's collar. It's waterproof, scratch-resistant, and built to last.", iconBg: 'bg-amber-500' },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'how_it_works',
            title: 'A Finder Scans',
            content: { icon: 'Scan', title: 'A Finder Scans', desc: "Anyone with a smartphone can scan the QR code — no app needed. They instantly see your pet's profile.", iconBg: 'bg-sky-500' },
            order: 2,
            isActive: true,
          },
          {
            sectionType: 'how_it_works',
            title: 'Get Your Pet Home',
            content: { icon: 'Home', title: 'Get Your Pet Home', desc: 'The finder contacts you directly, and you get an instant notification with their location. Reunion in minutes.', iconBg: 'bg-rose-500' },
            order: 3,
            isActive: true,
          },
        ], { session });
        console.log('  Created 4 how-it-works steps');
      } else {
        console.log('  How-it-works already exists');
      }

      const existingTrust = await CmsHomepageSection.findOne({ sectionType: 'trust', deletedAt: null }).session(session);
      if (!existingTrust) {
        await CmsHomepageSection.create([
          {
            sectionType: 'trust',
            title: 'Secure Accounts',
            content: { icon: 'ShieldCheck', title: 'Secure Accounts', desc: 'Every account is protected with encrypted passwords and optional two-factor authentication.', color: 'bg-primary-50 text-primary-600' },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'trust',
            title: 'Data Privacy',
            content: { icon: 'Eye', title: 'Data Privacy', desc: 'Your address and personal details are only shared when you choose to. You stay in control.', color: 'bg-violet-50 text-violet-600' },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'trust',
            title: 'Encrypted Payments',
            content: { icon: 'Lock', title: 'Encrypted Payments', desc: 'All transactions are processed through Stripe with bank-level encryption. We never store card data.', color: 'bg-amber-50 text-amber-600' },
            order: 2,
            isActive: true,
          },
          {
            sectionType: 'trust',
            title: 'Reliable Recovery',
            content: { icon: 'RotateCcw', title: 'Reliable Recovery', desc: 'Our tags are waterproof, scratch-resistant, and built to last the lifetime of your pet.', color: 'bg-emerald-50 text-emerald-600' },
            order: 3,
            isActive: true,
          },
        ], { session });
        console.log('  Created 4 trust badges');
      } else {
        console.log('  Trust badges already exist');
      }

      const existingTestimonials = await CmsHomepageSection.findOne({ sectionType: 'testimonial', deletedAt: null }).session(session);
      if (!existingTestimonials) {
        await CmsHomepageSection.create([
          {
            sectionType: 'testimonial',
            title: 'Sarah M.',
            content: { name: 'Sarah M.', initials: 'SM', color: 'bg-primary-500', pet: 'Golden Retriever', quote: "My dog Max got out during a storm last month. A neighbor found him 3 blocks away and scanned his PawTag. I had him back within 20 minutes. I can't imagine what would have happened without it.", focus: 'Fast Reunion' },
            order: 0,
            isActive: true,
          },
          {
            sectionType: 'testimonial',
            title: 'James K.',
            content: { name: 'James K.', initials: 'JK', color: 'bg-sky-500', pet: 'Tabby Cat', quote: "Setting up Luna's profile took less than 5 minutes. The peace of mind knowing that anyone who finds her can instantly see her info and contact me — it's worth every penny.", focus: 'Easy Setup' },
            order: 1,
            isActive: true,
          },
          {
            sectionType: 'testimonial',
            title: 'Priya D.',
            content: { name: 'Priya D.', initials: 'PD', color: 'bg-violet-500', pet: 'Cocker Spaniel', quote: "We travel a lot with our dog, and having PawTag gives me confidence that no matter where we are, if he slips his leash, someone can scan his tag and get him home safely.", focus: 'Peace of Mind' },
            order: 2,
            isActive: true,
          },
        ], { session });
        console.log('  Created 3 testimonials');
      } else {
        console.log('  Testimonials already exist');
      }

      const existingRespScore = await CmsHomepageSection.findOne({ sectionType: 'responsibility_score', deletedAt: null }).session(session);
      if (!existingRespScore) {
        await CmsHomepageSection.create([{
          sectionType: 'responsibility_score',
          title: 'Responsibility Score',
          content: {
            score: '820',
            scoreLabel: 'Excellent',
            title: 'Earn points for being a great pet parent',
            desc: "PawTag Responsibility Score rewards you for keeping your pet's profile complete and up to date. The higher your score, the more trusted your profile appears to potential finders.",
            activities: [
              { icon: 'ClipboardCheck', points: '+10', label: 'Complete Profile', color: 'text-primary-600 bg-primary-50' },
              { icon: 'Camera', points: '+15', label: 'Upload Pet Photo', color: 'text-sky-600 bg-sky-50' },
              { icon: 'Syringe', points: '+20', label: 'Add Vaccination Record', color: 'text-emerald-600 bg-emerald-50' },
              { icon: 'Star', points: '+25', label: 'Keep Info Updated', color: 'text-amber-600 bg-amber-50' },
            ],
          },
          order: 0,
          isActive: true,
        }], { session });
        console.log('  Created responsibility score section');
      } else {
        console.log('  Responsibility score already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 5. CMS PAGES
      // ═══════════════════════════════════════
      console.log('--- Seeding CMS Pages ---');

      // About
      const existingAbout = await CmsPage.findOne({ slug: 'about', deletedAt: null }).session(session);
      if (!existingAbout) {
        await CmsPage.create([{
          slug: 'about',
          title: 'About PawTag',
          metaTitle: 'About PawTag - Our Mission & Story',
          metaDescription: 'Learn about PawTag - a New Zealand company dedicated to pet safety and reunification through QR-coded recovery tags.',
          metaKeywords: ['about pawtag', 'pet safety', 'pet recovery', 'QR code tags', 'New Zealand'],
          sections: [
            {
              sectionId: 'about-intro',
              type: 'rich_text',
              title: '',
              content: {
                html: '<p class="text-lg text-gray-600 mb-4">PawTag is a New Zealand-born pet recovery platform that helps reunite lost pets with their families — faster, simpler, and more reliably than traditional methods.</p>',
              },
              visible: true,
              order: 0,
              status: 'published',
            },
            {
              sectionId: 'about-story',
              type: 'rich_text',
              title: 'Our Story',
              content: {
                html: '<p class="text-gray-600 mb-4">Every year, thousands of pets go missing across New Zealand. Traditional methods — printed flyers, social media posts, and word of mouth — are slow and often ineffective. PawTag was created to change that.</p><p class="text-gray-600">We built a simple QR-coded tag system that connects a lost pet to their owner in seconds. When someone finds your pet, they scan the tag, see your contact details, and reach you instantly — no app download required.</p>',
              },
              visible: true,
              order: 1,
              status: 'published',
            },
            {
              sectionId: 'about-mission',
              type: 'rich_text',
              title: 'Our Mission',
              content: {
                html: '<p class="text-gray-600">To make pet recovery fast, simple, and reliable. We believe every pet deserves a safe way home, and every owner deserves peace of mind.</p>',
              },
              visible: true,
              order: 2,
              status: 'published',
            },
            {
              sectionId: 'about-how',
              type: 'rich_text',
              title: 'How It Works',
              content: {
                html: '<div class="space-y-4"><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">1</div><div><h4 class="font-semibold text-gray-800">Order Your Tag</h4><p class="text-gray-600">Choose a tag for your pet and register your details online.</p></div></div><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">2</div><div><h4 class="font-semibold text-gray-800">Attach the Tag</h4><p class="text-gray-600">Clip the QR tag onto your pet\'s collar. It\'s lightweight and durable.</p></div></div><div class="flex gap-4"><div class="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">3</div><div><h4 class="font-semibold text-gray-800">Get Reunited</h4><p class="text-gray-600">If your pet is found, the finder scans the tag and contacts you right away.</p></div></div></div>',
              },
              visible: true,
              order: 3,
              status: 'published',
            },
            {
              sectionId: 'about-values',
              type: 'rich_text',
              title: 'Why PawTag',
              content: {
                html: '<ul class="list-disc list-inside space-y-2 text-gray-600"><li><strong>No app needed</strong> — anyone with a smartphone camera can scan the QR code.</li><li><strong>Instant contact</strong> — the finder sees your contact info and can call or message you immediately.</li><li><strong>Real-time updates</strong> — mark your pet as lost or found from your dashboard.</li><li><strong>Health records</strong> — store vaccination and medical information in one place.</li><li><strong>Built for New Zealand</strong> — designed locally for Kiwi pet owners.</li></ul>',
              },
              visible: true,
              order: 4,
              status: 'published',
            },
            {
              sectionId: 'about-core-values',
              type: 'cards',
              title: 'Our Values',
              content: {
                heading: 'Our Values',
                items: [
                  { icon: '\uD83D\uDC3E', title: 'Pet Safety First', description: 'Every decision we make starts with one question: does this help get lost pets home safer and faster?', link: '' },
                  { icon: '\uD83D\uDD12', title: 'Privacy by Design', description: 'Your personal information is yours. We only share what you choose to share when your pet is found.', link: '' },
                  { icon: '\u2728', title: 'Simplicity', description: 'No apps. No accounts for finders. Just scan, tap, and call. The simpler it is, the faster pets get home.', link: '' },
                  { icon: '\uD83D\uDC65', title: 'Community Driven', description: 'We work with local shelters, vets, and pet communities across New Zealand to build a stronger safety net for every pet.', link: '' },
                ],
              },
              visible: true,
              order: 5,
              status: 'published',
            },
            {
              sectionId: 'about-stats',
              type: 'statistics',
              title: 'By the Numbers',
              content: {
                heading: 'By the Numbers',
                stats: [
                  { label: 'Tags Distributed', value: '10,000', suffix: '+' },
                  { label: 'Pets Reunited', value: '2,500', suffix: '+' },
                  { label: 'QR Scans', value: '50,000', suffix: '+' },
                  { label: 'Recovery Rate', value: '98', suffix: '%' },
                ],
              },
              visible: true,
              order: 6,
              status: 'published',
            },
            {
              sectionId: 'about-nz',
              type: 'rich_text',
              title: 'Built for New Zealand',
              content: {
                html: '<p class="text-gray-600 mb-4">PawTag was born in New Zealand, built by Kiwi pet owners who know how important it is to keep our furry mates safe.</p><ul class="list-disc list-inside space-y-2 text-gray-600"><li><strong>NZ-based support</strong> — real people in your timezone, not a call centre overseas.</li><li><strong>Designed for local conditions</strong> — durable tags built to handle NZ weather, beaches, and bush.</li><li><strong>Local partnerships</strong> — we work with shelters and vets across the country.</li><li><strong>Community first</strong> — part of the wider NZ pet safety ecosystem.</li></ul>',
              },
              visible: true,
              order: 7,
              status: 'published',
            },
            {
              sectionId: 'about-cta',
              type: 'rich_text',
              title: 'Get Involved',
              content: {
                html: '<div class="bg-primary-50 border border-primary-200 rounded-lg p-6 mt-4"><p class="text-gray-700 mb-4">Help us build a safer world for pets. Here\'s how you can get involved:</p><ul class="list-disc list-inside space-y-2 text-gray-600 mb-4"><li><strong>Spread the word</strong> — tell friends and family about PawTag.</li><li><strong>Partner with us</strong> — shelters and vets, <a href="/contact" class="text-primary-600 underline">get in touch</a> about partnerships.</li><li><strong>Share your story</strong> — reunited with your pet? We\'d love to hear about it.</li></ul><a href="/shop" class="inline-block bg-primary-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary-700">Shop Now</a></div>',
              },
              visible: true,
              order: 8,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created About page');
      } else {
        console.log('  About page already exists');
      }

      // Privacy Policy
      const existingPrivacy = await CmsPage.findOne({ slug: 'privacy-policy', deletedAt: null }).session(session);
      if (!existingPrivacy) {
        await CmsPage.create([{
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          metaTitle: 'Privacy Policy - PawTag',
          metaDescription: 'PawTag Privacy Policy - Learn how we collect, use, and protect your personal information.',
          metaKeywords: ['privacy policy', 'data protection', 'personal information', 'PawTag'],
          sections: [
            {
              sectionId: 'privacy-body',
              type: 'rich_text',
              title: '',
              content: {
                html: `<p class="text-lg text-gray-600 mb-4">Last updated: ${new Date().toLocaleDateString()}</p>
<h2 class="text-xl font-semibold mt-6">1. Information We Collect</h2>
<p>We collect information you provide directly to us, such as when you create an account, register a pet, purchase a tag, or contact us for support.</p>
<h2 class="text-xl font-semibold mt-6">2. How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services, to process transactions, and to send you technical notices and support messages.</p>
<h2 class="text-xl font-semibold mt-6">3. Information Sharing</h2>
<p>We do not sell your personal information. We may share your information only when you direct us to (such as when a finder scans your pet's tag) or as required by law.</p>
<h2 class="text-xl font-semibold mt-6">4. Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
<h2 class="text-xl font-semibold mt-6">5. Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at support@pawtag.co.nz.</p>`,
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created Privacy Policy page');
      } else {
        console.log('  Privacy Policy page already exists');
      }

      // Terms of Service
      const existingTerms = await CmsPage.findOne({ slug: 'terms-of-service', deletedAt: null }).session(session);
      if (!existingTerms) {
        await CmsPage.create([{
          slug: 'terms-of-service',
          title: 'Terms of Service',
          metaTitle: 'Terms of Service - PawTag',
          metaDescription: 'PawTag Terms of Service - Read our terms and conditions for using our pet recovery services.',
          metaKeywords: ['terms of service', 'terms and conditions', 'user agreement', 'PawTag'],
          sections: [
            {
              sectionId: 'terms-body',
              type: 'rich_text',
              title: '',
              content: {
                html: `<p class="text-lg text-gray-600 mb-4">Last updated: ${new Date().toLocaleDateString()}</p>
<h2 class="text-xl font-semibold mt-6">1. Acceptance of Terms</h2>
<p>By accessing or using PawTag's services, you agree to be bound by these Terms of Service.</p>
<h2 class="text-xl font-semibold mt-6">2. Description of Service</h2>
<p>PawTag provides QR-coded pet recovery tags and associated online profiles to help reunite lost pets with their owners.</p>
<h2 class="text-xl font-semibold mt-6">3. User Responsibilities</h2>
<p>You are responsible for maintaining the accuracy of your pet's profile information and keeping your account credentials secure.</p>
<h2 class="text-xl font-semibold mt-6">4. Purchases and Refunds</h2>
<p>All purchases are final. Refunds may be issued at our discretion for defective products within 30 days of purchase.</p>
<h2 class="text-xl font-semibold mt-6">5. Limitation of Liability</h2>
<p>PawTag is not responsible for the recovery of lost pets. Our service facilitates communication between finders and owners but does not guarantee reunification.</p>
<h2 class="text-xl font-semibold mt-6">6. Contact Us</h2>
<p>If you have questions about these Terms, please contact us at support@pawtag.co.nz.</p>`,
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created Terms of Service page');
      } else {
        console.log('  Terms of Service page already exists');
      }

      // FAQ
      const existingFaq = await CmsPage.findOne({ slug: 'faq', deletedAt: null }).session(session);
      if (!existingFaq) {
        await CmsPage.create([{
          slug: 'faq',
          title: 'Frequently Asked Questions',
          metaTitle: 'FAQ - PawTag Help Center',
          metaDescription: 'Everything you need to know about PawTag pet recovery tags.',
          metaKeywords: ['FAQ', 'help', 'support', 'questions', 'PawTag'],
          sections: [
            {
              sectionId: 'faq-body',
              type: 'faq',
              title: 'Frequently Asked Questions',
              content: {
                heading: 'Frequently Asked Questions',
                items: [
                  { question: 'How does PawTag work?', answer: "Each PawTag has a unique QR code. When someone finds your pet, they scan the tag with their phone and instantly see your pet's profile with your contact details. No app is needed." },
                  { question: 'Do finders need an app to scan the tag?', answer: 'No. The QR code works with any smartphone camera. Simply point your camera at the tag and a link will appear to view the pet\'s profile.' },
                  { question: 'What information is visible to finders?', answer: "Only what you choose to share: your pet's name, photo, medical alerts, and a contact number or email. Your home address is never shown unless you add it." },
                  { question: 'Is my personal data secure?', answer: 'Yes. All data is encrypted and stored securely. We never sell or share your personal information. You control exactly what finders can see.' },
                  { question: 'How long does the tag last?', answer: 'PawTag QR tags are waterproof, scratch-resistant, and built to last the lifetime of your pet. They do not require batteries or charging.' },
                  { question: "Can I update my pet's profile after purchasing?", answer: "Yes. You can update your pet's photo, contact details, medical information, and any other profile data at any time from your account dashboard." },
                  { question: 'What happens if my pet goes missing?', answer: "When someone scans the tag, you'll receive an instant notification with the finder's location. You can then contact them directly to arrange a reunion." },
                  { question: 'Do you ship internationally?', answer: 'Currently we ship within New Zealand. International shipping is coming soon.' },
                ],
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created FAQ page');
      } else {
        console.log('  FAQ page already exists');
      }

      // Contact
      const existingContact = await CmsPage.findOne({ slug: 'contact', deletedAt: null }).session(session);
      if (!existingContact) {
        await CmsPage.create([{
          slug: 'contact',
          title: 'Contact Us',
          metaTitle: 'Contact Us - PawTag Support',
          metaDescription: 'Get in touch with the PawTag team. We\'re here to help with any questions about our pet recovery tags.',
          metaKeywords: ['contact', 'support', 'help', 'PawTag', 'get in touch'],
          sections: [
            {
              sectionId: 'contact-form',
              type: 'contact_form',
              title: 'Contact Page',
              content: {
                heading: 'Contact Us',
                subtitle: "Have a question or need help? We'd love to hear from you.",
                businessHours: 'Mon-Fri: 9am - 5pm NZST',
                formTitle: 'Send us a message',
                formButtonText: 'Send Message',
                formSuccessMessage: "Thank you! We'll be in touch soon.",
              },
              visible: true,
              order: 0,
              status: 'published',
            },
          ],
          status: 'published',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created Contact page');
      } else {
        console.log('  Contact page already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 6. EMAIL TEMPLATES
      // ═══════════════════════════════════════
      console.log('--- Seeding Email Templates ---');
      const emailTemplates = [
        {
          name: 'Welcome',
          slug: 'welcome',
          subject: 'Welcome to PawTag!',
          title: 'Welcome to PawTag!',
          subtitle: 'Your account is ready',
          body: 'Hi {{name}},\n\nYour account has been verified and is now active! Welcome to the PawTag community.\n\nYou can now register your pets, order QR-coded recovery tags, and get notified when someone finds your pet.\n\nGo to My Account: {{accountUrl}}\n\nNeed help? Contact us at support@pawtag.co.nz',
          ctaText: 'Go to My Account',
          ctaUrl: '{{accountUrl}}',
          preheader: 'Your PawTag account is verified and active. Start protecting your pets today.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'accountUrl'],
          status: 'active' as const,
        },
        {
          name: 'Email Verification',
          slug: 'verification-email',
          subject: 'Verify your email address',
          title: 'Verify your email address',
          subtitle: 'One step closer to protecting your pet',
          body: 'Hi {{name}},\n\nWelcome to PawTag! Please verify your email address to activate your account and start protecting your pets.\n\nVerify My Email: {{verificationUrl}}\n\nThis link expires in 24 hours.\nIf you didn\'t create a PawTag account, you can safely ignore this email.',
          ctaText: 'Verify My Email',
          ctaUrl: '{{verificationUrl}}',
          preheader: 'Verify your email to activate your PawTag account. Link expires in 24 hours.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'verificationUrl'],
          status: 'active' as const,
        },
        {
          name: 'Password Reset',
          slug: 'password-reset',
          subject: 'Reset your password',
          title: 'Reset your password',
          subtitle: 'Password reset request',
          body: 'Hi {{name}},\n\nWe received a request to reset your password. Click the button below to choose a new one.\n\nReset Password: {{resetUrl}}\n\nThis link expires in 1 hour.\nIf you didn\'t request a password reset, ignore this email. Your password will not change.',
          ctaText: 'Reset Password',
          ctaUrl: '{{resetUrl}}',
          preheader: 'Reset your PawTag password. Link expires in 1 hour.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'resetUrl'],
          status: 'active' as const,
        },
        {
          name: 'Pet Found',
          slug: 'pet-found',
          subject: 'Someone found {{petName}}!',
          title: 'Someone found {{petName}}',
          subtitle: 'Lost pet alert',
          body: 'Hi {{ownerName}},\n\nSomeone found {{petName}}!\n\nSomeone scanned {{petName}}\'s tag and wants to help reunite you.\n\n{{#finderMessage}}Finder\'s message: "{{finderMessage}}"{{/finderMessage}}\n\n{{#finderContact}}Finder\'s contact: {{finderContact}}{{/finderContact}}\n\n{{#scanLocation}}Location: {{scanLocation}}{{/scanLocation}}\n\nView Details: {{viewDetailsUrl}}\n\nTime is critical. Reach out to the finder as soon as possible to arrange a reunion.',
          ctaText: 'View Details',
          ctaUrl: '{{viewDetailsUrl}}',
          preheader: 'Great news! Someone found your pet and wants to help reunite you.',
          senderEmail: 'alerts@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['ownerName', 'petName', 'finderMessage', 'finderContact', 'scanLocation', 'viewDetailsUrl'],
          status: 'active' as const,
        },
        {
          name: 'Order Confirmation',
          slug: 'order-confirmation',
          subject: 'Order Confirmed - {{orderNumber}}',
          title: 'Order Confirmed',
          subtitle: 'Order {{orderNumber}}',
          body: 'Hi {{name}},\n\nThank you for your order! We\'re processing it now and will notify you when it ships.\n\nOrder: {{orderNumber}}\nTotal: ${{total}}\n\nShipping to:\n{{shippingAddress.line1}}\n{{shippingAddress.city}}, {{shippingAddress.state}} {{shippingAddress.zip}}\n\nView Order: {{viewOrderUrl}}\n\nQuestions? Reply to this email or contact support@pawtag.co.nz',
          ctaText: 'View Order',
          ctaUrl: '{{viewOrderUrl}}',
          preheader: 'Your PawTag order has been confirmed.',
          senderEmail: 'orders@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'orderNumber', 'total', 'shippingAddress', 'viewOrderUrl'],
          status: 'active' as const,
        },
        {
          name: 'Shipping Notification',
          slug: 'shipping-notification',
          subject: 'Your Order Has Shipped - {{orderNumber}}',
          title: 'Your Order Has Shipped',
          subtitle: 'Order {{orderNumber}}',
          body: 'Hi {{name}},\n\nGreat news! Your order has been shipped and is on its way to you.\n\nTracking Number: {{trackingNumber}}\nOrder: {{orderNumber}}\n\nView Order: {{viewOrderUrl}}',
          ctaText: 'View Order',
          ctaUrl: '{{viewOrderUrl}}',
          preheader: 'Your PawTag order has been shipped.',
          senderEmail: 'shipping@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'orderNumber', 'trackingNumber', 'viewOrderUrl'],
          status: 'active' as const,
        },
        {
          name: 'Account Status Update',
          slug: 'account-status',
          subject: 'Account Status Update',
          title: 'Account Status Update',
          subtitle: 'PawTag account notification',
          body: 'Hi {{name}},\n\nYour PawTag account status has been updated to: {{status}}\n\n{{#reason}}Reason: {{reason}}{{/reason}}\n\nIf you believe this is an error, please contact support@pawtag.co.nz.',
          ctaText: '',
          ctaUrl: '',
          preheader: 'Your PawTag account status has been updated.',
          senderEmail: 'no-reply@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'status', 'reason'],
          status: 'active' as const,
        },
        {
          name: 'Invoice Ready',
          slug: 'invoice-paid',
          subject: 'Invoice {{invoiceNumber}} — {{company}}',
          title: 'Your Invoice is Ready',
          subtitle: 'Invoice {{invoiceNumber}}',
          body: 'Hi {{name}},\n\nYour invoice **{{invoiceNumber}}**{{#amount}} for **{{amount}}**{{/amount}} is ready.\n\nYou can view and download your invoice using the link below.\n\nThank you for your business!',
          ctaText: 'View Invoice',
          ctaUrl: '{{viewInvoiceUrl}}',
          preheader: 'Your PawTag invoice {{invoiceNumber}} is ready to view.',
          senderEmail: 'billing@pawtag.co.nz',
          senderName: 'PawTag',
          variables: ['name', 'invoiceNumber', 'amount', 'viewInvoiceUrl', 'company'],
          status: 'active' as const,
        },
      ];

      let emailCreated = 0;
      for (const t of emailTemplates) {
        const existing = await CmsEmailTemplate.findOne({ slug: t.slug }).session(session);
        if (!existing) {
          await CmsEmailTemplate.create([{ ...t, createdBy: adminId, updatedBy: adminId }], { session });
          emailCreated++;
        }
      }
      console.log(`  ${emailCreated} new email templates created (${emailTemplates.length} total)\n`);

      // ═══════════════════════════════════════
      // 7. SMS TEMPLATES
      // ═══════════════════════════════════════
      console.log('--- Seeding SMS Templates ---');
      const existingSms = await CmsSmsTemplate.findOne({ slug: 'phone-otp' }).session(session);
      if (!existingSms) {
        await CmsSmsTemplate.create([{
          name: 'Phone OTP',
          slug: 'phone-otp',
          message: 'Your PawTag verification code is: {{otp}}\n\nIt expires in 10 minutes. Do not share this code.',
          variables: ['otp'],
          status: 'active',
          createdBy: adminId,
          updatedBy: adminId,
        }], { session });
        console.log('  Created phone OTP SMS template');
      } else {
        console.log('  Phone OTP SMS template already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 8. PET REFERENCES
      // ═══════════════════════════════════════
      console.log('--- Seeding Pet References ---');
      const petTypes = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird'];

      const petColors: Record<string, string[]> = {
        Dog: ['Black', 'White', 'Brown', 'Cream', 'Golden', 'Red', 'Blue (Gray)', 'Fawn', 'Brindle', 'Merle', 'Sable', 'Chocolate', 'Liver', 'Tan', 'Silver'],
        Cat: ['Black', 'White', 'Gray', 'Blue', 'Orange (Ginger)', 'Cream', 'Brown', 'Chocolate', 'Lilac', 'Cinnamon', 'Fawn'],
        Rabbit: ['White', 'Black', 'Blue', 'Chocolate', 'Lilac', 'Chestnut', 'Chinchilla', 'Sable', 'Tortoise', 'Agouti'],
        Hamster: ['Golden', 'White', 'Black', 'Gray', 'Cream', 'Cinnamon', 'Sable', 'Silver'],
        'Guinea Pig': ['White', 'Black', 'Brown', 'Red', 'Cream', 'Buff', 'Chocolate', 'Lilac', 'Slate'],
        Bird: ['Green', 'Blue', 'Yellow', 'White', 'Gray', 'Black', 'Red', 'Violet', 'Turquoise', 'Lutino', 'Albino'],
      };

      const petPatterns: Record<string, string[]> = {
        Dog: ['Solid', 'Merle', 'Brindle', 'Sable', 'Tan Points', 'Tricolor', 'Piebald', 'Tuxedo', 'Harlequin', 'Spotted', 'Roan'],
        Cat: ['Solid', 'Tabby', 'Calico', 'Tortoiseshell', 'Bicolor', 'Tricolor', 'Colorpoint', 'Ticked', 'Spotted', 'Mackerel', 'Classic Tabby'],
        Rabbit: ['Solid', 'Broken', 'Dutch', 'Himalayan', 'Otter', 'Chinchilla', 'Fox', 'Steel', 'Butterfly', 'Magpie'],
        Hamster: ['Solid', 'Banded', 'Sanded', 'Ticked', 'Agouti', 'Spotted'],
        'Guinea Pig': ['Solid', 'Roan', 'Dalmatian', 'Brindle', 'Himalayan', 'Dutch', 'Orange', 'Ticked', 'Agouti'],
        Bird: ['Solid', 'Pied', 'Lutino', 'Albino', 'Opaline', 'Spangle', 'Clearwing', 'Crested', 'Dominant Pied'],
      };

      const petBreeds: Record<string, string[]> = {
        Dog: ['Mixed Breed', 'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'French Bulldog', 'Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Dachshund', 'German Shorthaired Pointer', 'Pembroke Welsh Corgi', 'Australian Shepherd', 'Yorkshire Terrier', 'Cavalier King Charles Spaniel', 'Doberman Pinscher', 'Boxer', 'Miniature Schnauzer', 'Cocker Spaniel', 'Shih Tzu', 'Border Collie', 'Belgian Malinois', 'Alaskan Malamute', 'Siberian Husky', 'Bernese Mountain Dog', 'Great Dane', 'Saint Bernard', 'Old English Sheepdog', 'Samoyed', 'Akita', 'Mastiff', 'Newfoundland', 'West Highland White Terrier', 'Scottish Terrier', 'Bull Terrier', 'Jack Russell Terrier', 'Staffordshire Bull Terrier', 'Airedale Terrier', 'Chihuahua', 'Pomeranian', 'Maltese', 'Pug', 'Papillon', 'Italian Greyhound', 'Chinese Crested', 'Basset Hound', 'Bloodhound', 'Greyhound', 'Whippet', 'Rhodesian Ridgeback', 'Afghan Hound', 'Basenji', 'Shiba Inu', 'Shar Pei', 'Chow Chow', 'Lhasa Apso', 'Sheltie', 'Collie', 'Dalmatian', 'Weimaraner', 'Vizsla', 'Brittany Spaniel', 'Setter (Irish)', 'Setter (English)', 'Pointer', 'Havanese', 'Bichon Frise', 'Maltepoo', 'Goldendoodle', 'Labradoodle', 'Cockapoo', 'Pomsky'],
        Cat: ['Mixed Breed', 'Domestic Shorthair', 'Domestic Longhair', 'Ragdoll', 'Maine Coon', 'Persian', 'British Shorthair', 'Bengal', 'Abyssinian', 'Siamese', 'Russian Blue', 'Scottish Fold', 'Sphynx', 'Birman', 'Norwegian Forest Cat', 'Ragamuffin', 'Himalayan', 'American Shorthair', 'Exotic Shorthair', 'Oriental Shorthair', 'Tonkinese', 'Burmese', 'Cornish Rex', 'Devon Rex', 'Selkirk Rex', 'Somali', 'Balinese', 'Chartreux', 'Korat', 'LaPerm', 'Manx', 'Munchkin', 'Singapura', 'Snowshoe', 'Turkish Angora', 'Turkish Van'],
        Rabbit: ['Mixed Breed', 'Holland Lop', 'Mini Lop', 'English Lop', 'French Lop', 'Netherland Dwarf', 'Mini Rex', 'Standard Rex', 'Velveteen Lop', 'Himalayan', 'Dutch', 'English Spot', 'Checkered Giant', 'Flemish Giant', 'Lionhead', 'Angora', 'Jersey Wooly', 'Californian', 'New Zealand', 'American', 'Chinchilla', 'Argente', 'Belgian Hare', 'English Angora', 'French Angora'],
        Hamster: ['Syrian (Golden)', 'Dwarf Campbell', 'Dwarf Winter White', 'Roborovski', 'Chinese', "Campbell's Dwarf"],
        'Guinea Pig': ['American', 'Peruvian', 'Silkie (Sheltie)', 'Teddy', 'Texel', 'Rex', 'American Crested', 'Peruvian Crested', 'Skinny Pig', 'Baldwin', 'Sheba', 'White Crested', 'Merino', 'Lunkarya'],
        Bird: ['Budgerigar (Budgie)', 'Cockatiel', 'Lovebird', 'African Grey', 'Amazon Parrot', 'Macaw', 'Cockatoo', 'Conure', 'Canary', 'Finch', 'Parrotlet', 'Quaker Parrot', 'Ringneck Dove', 'Pionus', 'Caique', 'Lorikeet', 'Mynah', "Bourke's Parakeet", 'Lineolated Parakeet'],
      };

      const petGenders = [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'unknown', label: 'Unknown' },
      ];

      const existingPetTypes = await CmsPetReference.countDocuments({ type: 'pet_type', deletedAt: null }).session(session);
      if (existingPetTypes === 0) {
        let refCount = 0;
        const refs: Array<Record<string, unknown>> = [];

        // Pet Types
        petTypes.forEach((t, i) => {
          refs.push({ type: 'pet_type', label: t, value: t.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
        });

        // Colors
        for (const [species, colors] of Object.entries(petColors)) {
          colors.forEach((c, i) => {
            refs.push({ type: 'color', petSpecies: species, label: c, value: c.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
          });
        }

        // Patterns
        for (const [species, patterns] of Object.entries(petPatterns)) {
          patterns.forEach((p, i) => {
            refs.push({ type: 'pattern', petSpecies: species, label: p, value: p.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
          });
        }

        // Breeds
        for (const [species, breeds] of Object.entries(petBreeds)) {
          breeds.forEach((b, i) => {
            refs.push({ type: 'breed', petSpecies: species, label: b, value: b.toLowerCase(), order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
          });
        }

        // Genders
        petGenders.forEach((g, i) => {
          refs.push({ type: 'gender', label: g.label, value: g.value, order: i, isActive: true, createdBy: adminId, updatedBy: adminId });
        });

        // Insert in batches
        const batchSize = 100;
        for (let i = 0; i < refs.length; i += batchSize) {
          const batch = refs.slice(i, i + batchSize);
          await CmsPetReference.create(batch, { session });
          refCount += batch.length;
        }
        console.log(`  Created ${refCount} pet reference records`);
      } else {
        console.log(`  Pet references already exist (${existingPetTypes} types found)`);
      }
      console.log('');

      // ═══════════════════════════════════════
      // 9. SHOP PAGE
      // ═══════════════════════════════════════
      console.log('--- Seeding Shop Page ---');
      const existingShop = await CmsShopPage.findOne({ slug: 'shop', deletedAt: null }).session(session);
      if (!existingShop) {
        await CmsShopPage.create([{
          slug: 'shop',
          title: 'Shop PawTag Products',
          subtitle: 'Browse our range of QR-coded pet recovery tags. Each tag links to your pet\'s online profile, helping them get home faster.',
          content: {
            heroTitle: 'Shop PawTag Products',
            heroDescription: 'Browse our range of QR-coded pet recovery tags. Each tag links to your pet\'s online profile, helping them get home faster.',
          },
          metaTitle: 'Shop - PawTag QR Pet Recovery Tags',
          metaDescription: 'Browse our range of QR-coded pet recovery tags. Each tag links to your pet\'s online profile, helping them get home faster.',
          isActive: true,
        }], { session });
        console.log('  Created shop page');
      } else {
        console.log('  Shop page already exists');
      }
      console.log('');

      // ═══════════════════════════════════════
      // 10. AUTH PAGES
      // ═══════════════════════════════════════
      console.log('--- Seeding Auth Pages ---');
      const authPages = [
        { pageType: 'login', title: 'Welcome back', subtitle: 'Sign in to your PawTag account', content: {} },
        { pageType: 'register', title: 'Create your account', subtitle: 'Join thousands of pet owners protecting their companions', content: {} },
        { pageType: 'forgot_password', title: 'Forgot your password?', subtitle: "Enter your email and we'll send you a reset link.", content: {} },
        { pageType: 'reset_password', title: 'Reset your password', subtitle: 'Enter your new password below.', content: {} },
      ];

      let authCreated = 0;
      for (const p of authPages) {
        const existing = await CmsAuthPage.findOne({ pageType: p.pageType }).session(session);
        if (!existing) {
          await CmsAuthPage.create([{ ...p, isActive: true }], { session });
          authCreated++;
        }
      }
      console.log(`  ${authCreated} new auth pages created (${authPages.length} total)\n`);

      // ═══════════════════════════════════════
      // 9. ONBOARDING STEPS
      // ═══════════════════════════════════════
      console.log('--- Seeding Onboarding Steps ---');
      const existingOnboarding = await CmsOnboarding.findOne().session(session);
      if (!existingOnboarding) {
        await CmsOnboarding.create([{
          steps: [
            {
              stepId: 'welcome',
              title: 'Welcome to PawTag!',
              subtitle: "You've taken the first step to keeping your pet safe. Let's make sure your profile is ready so finders can reunite you fast.",
              icon: 'Heart',
              order: 0,
              isActive: true,
              type: 'info',
              content: {
                storyHeading: 'Your journey to pet safety starts here',
                storyText: "Welcome aboard! You're now part of a community of pet owners who are serious about keeping their furry family members safe. Let's take a few minutes to make sure your profile is complete — it could make all the difference when it matters most.",
                callout: {
                  icon: 'Shield',
                  title: 'Your Privacy Is Protected',
                  text: "Everything you enter here is securely stored. Your personal details are never shared with finders — only you decide who can contact you.",
                  variant: 'info',
                },
              },
            },
            {
              stepId: 'reality',
              title: 'Imagine This...',
              subtitle: "It happens faster than you think. Here's why being prepared matters.",
              icon: 'AlertTriangle',
              order: 1,
              isActive: true,
              type: 'info',
              content: {
                stats: [
                  { number: '1 in 3', label: 'pets get lost in their lifetime' },
                  { number: 'Only 20%', label: 'are reunited without identification' },
                  { number: 'Minutes', label: 'matter — the sooner, the better' },
                ],
                storyHeading: "Your pet slips out the gate. A kind stranger finds them.",
                storyText: "They scan the PawTag and instantly see your pet's profile. You get a call within minutes. Your pet is home before dinner.\n\nBut this only works if your details are complete. The finder doesn't have your phone number memorized. They don't know where you live. The ONLY way they can reach you is through the information YOU provide.",
                whyItMatters: "Every field you complete is another lifeline for your pet. A phone number means a finder can call you right now. An address means they know how far away you are. An emergency contact means someone gets notified even if you're busy.",
              },
            },
            {
              stepId: 'how-it-works',
              title: 'How PawTag Works',
              subtitle: 'Reunited in minutes, not days.',
              icon: 'Zap',
              order: 2,
              isActive: true,
              type: 'info',
              content: {
                flowSteps: [
                  { icon: 'PawPrint', label: 'Someone Finds Your Pet', description: 'A kind stranger finds your lost pet' },
                  { icon: 'Scan', label: 'They Scan the QR Tag', description: 'No app needed — just their phone camera' },
                  { icon: 'Phone', label: 'You Get Notified', description: 'Instantly via app, SMS, and email' },
                ],
                callout: {
                  icon: 'AlertTriangle',
                  title: "Important: Finders Don't Have the App",
                  text: "When someone finds your pet, they don't need to download anything. They simply scan the QR code with their phone camera and see your pet's profile instantly. The ONLY way they can contact you is through the phone number and email you provide. No app. No account. Just your details.",
                  variant: 'warning',
                },
                whyItMatters: "The simpler it is for finders, the faster your pet gets home. That's why PawTag works with any smartphone camera — no app download required. But it also means your contact details are the ONLY bridge between you and your pet.",
              },
            },
            {
              stepId: 'contact-details',
              title: 'How Finders Will Reach You',
              subtitle: "Finders don't have the PawTag app — your phone and email are their only way to contact you.",
              icon: 'Phone',
              order: 3,
              isActive: true,
              type: 'form',
              formFields: ['phoneNumber', 'email'],
              content: {
                privacyNote: {
                  icon: 'Lock',
                  title: 'Your Details Are Private',
                  text: "Your phone number and email are NEVER shown to finders. They are only used to notify YOU when your pet is found. The finder provides THEIR details to YOU. You decide when and how to contact them.",
                },
                callout: {
                  icon: 'Info',
                  title: 'Why We Need Both',
                  text: "A phone call is fastest when time matters. An email gives finders a written way to reach you with photos and location details. Having both means no matter how a finder prefers to contact you, they can.",
                  variant: 'tip',
                },
              },
            },
            {
              stepId: 'address',
              title: 'Help Finders Know Where You Are',
              subtitle: "When someone finds your pet, they'll see your suburb and city. The closer they know you are, the faster your pet gets home.",
              icon: 'MapPin',
              order: 4,
              isActive: true,
              type: 'form',
              formFields: ['address.line1', 'address.line2', 'address.city', 'address.state', 'address.zip'],
              content: {
                privacyNote: {
                  icon: 'Lock',
                  title: 'Only Your Suburb Is Shown',
                  text: "Your full street address is NEVER shared with finders. Only your suburb and city appear on your pet's profile. You can turn this off entirely in Settings.",
                },
                whyItMatters: "When a finder sees that you're only 5 minutes away, they're more likely to wait or bring your pet to you. Location builds trust and speeds up reunions.",
              },
            },
            {
              stepId: 'emergency-contact',
              title: 'Add Your Backup Lifeline',
              subtitle: "What if you miss the alert? Your emergency contact is the person who gets notified if you can't.",
              icon: 'PhoneCall',
              order: 5,
              isActive: true,
              type: 'form',
              formFields: ['emergencyContact.name', 'emergencyContact.relationship', 'emergencyContact.phone', 'emergencyContact.email'],
              content: {
                privacyNote: {
                  icon: 'Lock',
                  title: 'Your Emergency Contact Is Also Private',
                  text: "Their details are never shared with finders. They're only contacted automatically if you can't respond within 30 minutes.",
                },
                whyItMatters: "Imagine this: Your phone is on silent. You're in a meeting. You're asleep. Hours pass. A kind finder scanned your pet's tag 30 minutes ago but hasn't heard back from you. Without an emergency contact, your pet waits. WITH an emergency contact: they get an SMS immediately, they get an email with all the details, if they use PawTag they get a push notification too, and they can act while you're unavailable. This is your safety net. Don't skip it.",
                callout: {
                  icon: 'Info',
                  title: 'Who Should You Add?',
                  text: "Choose someone who lives nearby or can reach your pet quickly, will always have their phone on, and you trust to handle this situation. Common choices: partner, neighbour, family member, or close friend.",
                  variant: 'tip',
                },
              },
            },
            {
              stepId: 'completion',
              title: "You're All Set!",
              subtitle: "Your pet now has the best chance of finding their way home.",
              icon: 'CheckCircle',
              order: 6,
              isActive: true,
              type: 'info',
              content: {
                storyText: "If your pet is ever found, here's what happens:\n1. The finder scans the tag and sees your pet's profile\n2. You get notified instantly via app, SMS, and email\n3. If you don't respond in 30 minutes, your emergency contact is automatically alerted\n4. The finder can always reach someone who can help",
                callout: {
                  icon: 'Shield',
                  title: 'Your Privacy Is Protected',
                  text: "Your phone, email, and street address are NEVER shown to finders. Only your suburb/city is visible (if enabled). Finders provide THEIR details to YOU. Your emergency contact is only notified if you're unreachable. All data is encrypted and securely stored.",
                  variant: 'info',
                },
              },
            },
          ],
          globalSettings: {
            relationshipOptions: ['Spouse', 'Partner', 'Fiancé', 'Ex-Spouse', 'Ex-Partner', 'Parent', 'Stepparent', 'Parent-in-law', 'Grandparent', 'Sibling', 'Step-Sibling', 'Sibling-in-law', 'Child', 'Stepchild', 'Child-in-law', 'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Godparent', 'Godchild', 'Friend', 'Neighbour', 'Housemate', 'Work Colleague', 'Manager', 'Client', 'Mentor', 'Teacher', 'Caregiver', 'Other'],
          },
          updatedBy: adminId,
        }], { session });
        console.log('  Created 7 onboarding steps');
      } else {
        const FULL_RELATIONSHIP_OPTIONS = ['Spouse', 'Partner', 'Fiancé', 'Ex-Spouse', 'Ex-Partner', 'Parent', 'Stepparent', 'Parent-in-law', 'Grandparent', 'Sibling', 'Step-Sibling', 'Sibling-in-law', 'Child', 'Stepchild', 'Child-in-law', 'Grandchild', 'Uncle', 'Aunt', 'Cousin', 'Godparent', 'Godchild', 'Friend', 'Neighbour', 'Housemate', 'Work Colleague', 'Manager', 'Client', 'Mentor', 'Teacher', 'Caregiver', 'Other'];
        existingOnboarding.globalSettings = existingOnboarding.globalSettings || {};
        existingOnboarding.globalSettings.relationshipOptions = FULL_RELATIONSHIP_OPTIONS;
        await existingOnboarding.save({ session });
        console.log('  Updated relationship options in existing onboarding config');
      }
      console.log('');

    });

    console.log('═══════════════════════════════════════');
    console.log('CMS Seed completed successfully!');
    console.log('═══════════════════════════════════════');
  } catch (error) {
    console.error('CMS Seed failed:', error);
    throw error;
  } finally {
    session.endSession();
    await disconnectDatabase();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
