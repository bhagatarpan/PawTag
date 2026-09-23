import { renderBase, renderCtaButton, renderDataTable, renderInfoBox, renderStatusCard, type EmailTheme } from './base';

// ─── Subscription Welcome ──────────────────────────────────────────

interface SubscriptionWelcomeData {
  name: string;
  tagId: string;
  planName: string;
  freePeriodEndsAt: string;
  subscriptionsUrl: string;
}

export function renderSubscriptionWelcomeEmail(data: SubscriptionWelcomeData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Your PawTag subscription is now active! Here are your details:</p>
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Plan', value: data.planName },
      { label: 'Free Period Ends', value: data.freePeriodEndsAt },
    ])}
    ${renderCtaButton(data.subscriptionsUrl, 'View Subscription')}
  `;

  return renderBase({
    title: 'Your Subscription is Active',
    subtitle: 'Welcome to PawTag',
    bodyHtml,
  });
}

// ─── Subscription Expiry Reminder ──────────────────────────────────

interface SubscriptionReminderData {
  name: string;
  tagId: string;
  daysLeft: number;
  type: '30-day' | '7-day' | '1-day';
  renewUrl: string;
}

export function renderSubscriptionReminderEmail(data: SubscriptionReminderData): string {
  const urgencyLabel = data.type === '1-day' ? 'URGENT: ' : data.type === '7-day' ? 'Important: ' : '';
  const theme: EmailTheme = data.type === '1-day' ? 'danger' : data.type === '7-day' ? 'warning' : 'default';

  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your PawTag subscription for tag <strong>${data.tagId}</strong> expires in <strong>${data.daysLeft} day${data.daysLeft !== 1 ? 's' : ''}</strong>.
    </p>
    ${renderStatusCard(theme === 'danger' ? 'danger' : 'warning', `${data.daysLeft} Day${data.daysLeft !== 1 ? 's' : ''} Remaining`, 'Renew now to keep your pet protected and maintain your Guardian benefits.')}
    ${renderCtaButton(data.renewUrl, 'Renew Now')}
  `;

  return renderBase({
    title: `${urgencyLabel}Your Subscription Expires in ${data.daysLeft} Day${data.daysLeft !== 1 ? 's' : ''}`,
    subtitle: 'Subscription Renewal',
    bodyHtml,
    theme,
  });
}

// ─── Grace Period Reminder ─────────────────────────────────────────

interface GracePeriodReminderData {
  name: string;
  tagId: string;
  daysLeft: number;
  renewUrl: string;
}

export function renderGracePeriodReminderEmail(data: GracePeriodReminderData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your PawTag subscription for tag <strong>${data.tagId}</strong> is in grace period.
      You have <strong>${data.daysLeft} day${data.daysLeft !== 1 ? 's' : ''}</strong> left to renew before your pet's tag becomes inactive.
    </p>
    ${renderStatusCard('warning', 'Grace Period Active', 'Renew now to avoid losing access to pet tracking and Guardian benefits.')}
    ${renderCtaButton(data.renewUrl, 'Renew Now')}
  `;

  return renderBase({
    title: `Grace Period: ${data.daysLeft} Day${data.daysLeft !== 1 ? 's' : ''} Left`,
    subtitle: 'Subscription Renewal',
    bodyHtml,
    theme: 'warning',
  });
}

// ─── Payment Failure ───────────────────────────────────────────────

interface PaymentFailureData {
  name: string;
  tagId: string;
  retryCount: number;
  retriesLeft: number;
  updatePaymentUrl: string;
}

export function renderPaymentFailureEmail(data: PaymentFailureData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      We were unable to process payment for your PawTag subscription (tag: <strong>${data.tagId}</strong>).
    </p>
    ${renderStatusCard('danger', 'Payment Failed', `Attempt ${data.retryCount} failed. ${data.retriesLeft} retry${data.retriesLeft !== 1 ? 'ies' : 'y'} remaining.`)}
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Please update your payment method to avoid interruption of service.
    </p>
    ${renderCtaButton(data.updatePaymentUrl, 'Update Payment Method')}
  `;

  return renderBase({
    title: 'Payment Failed',
    subtitle: 'Action Required',
    bodyHtml,
    theme: 'danger',
  });
}

// ─── Grace Period Started ──────────────────────────────────────────

interface GracePeriodStartedData {
  name: string;
  tagId: string;
  gracePeriodWeeks: number;
  renewUrl: string;
}

export function renderGracePeriodStartedEmail(data: GracePeriodStartedData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your PawTag subscription for tag <strong>${data.tagId}</strong> has entered grace period.
    </p>
    ${renderStatusCard('warning', 'Grace Period Started', `You have ${data.gracePeriodWeeks} week${data.gracePeriodWeeks !== 1 ? 's' : ''} to renew before your tag becomes inactive.`)}
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      During grace period, your pet's tag will still work for finders, but some Guardian features may be limited.
    </p>
    ${renderCtaButton(data.renewUrl, 'Renew Now')}
  `;

  return renderBase({
    title: 'Grace Period Started',
    subtitle: 'Subscription Notice',
    bodyHtml,
    theme: 'warning',
  });
}

// ─── Payment Retry Success ─────────────────────────────────────────

interface PaymentRetrySuccessData {
  name: string;
  tagId: string;
}

export function renderPaymentRetrySuccessEmail(data: PaymentRetrySuccessData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Great news! Payment for your PawTag subscription (tag: <strong>${data.tagId}</strong>) has been successfully processed.
    </p>
    ${renderStatusCard('success', 'Payment Successful', 'Your subscription is now active and your pet remains protected.')}
  `;

  return renderBase({
    title: 'Payment Successful',
    subtitle: 'Subscription Active',
    bodyHtml,
    theme: 'success',
  });
}

// ─── Free Period Reminder — 2 Weeks ────────────────────────────────

interface FreePeriodReminder2WeekData {
  name: string;
  tagId: string;
  productName: string;
  freePeriodEndsAt: string;
  monthlyPrice: number;
  autoRenew: boolean;
  subscriptionsUrl: string;
}

export function renderFreePeriodReminder2WeekEmail(data: FreePeriodReminder2WeekData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your PawTag <strong>${data.productName}</strong> free subscription period is ending soon.
    </p>
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Free Period Ends', value: data.freePeriodEndsAt },
      { label: 'Monthly Price After', value: `$${data.monthlyPrice.toFixed(2)}/month` },
      { label: 'Auto-Renew', value: data.autoRenew ? 'ON' : 'OFF' },
    ])}
    ${data.autoRenew
      ? renderStatusCard('info', 'Auto-Renew is ON', 'Your subscription will automatically continue at $' + data.monthlyPrice.toFixed(2) + '/month after the free period ends. No action needed.')
      : renderStatusCard('warning', 'Auto-Renew is OFF', 'Your subscription will NOT automatically renew. Renew before ' + data.freePeriodEndsAt + ' to keep your pet protected.')
    }
    ${renderCtaButton(data.subscriptionsUrl, 'Manage Subscription')}
  `;

  return renderBase({
    title: 'Your Free Subscription Period is Ending',
    subtitle: '2 Weeks Remaining',
    bodyHtml,
    theme: 'warning',
  });
}

// ─── Free Period Reminder — 3 Days ─────────────────────────────────

interface FreePeriodReminder3DayData {
  name: string;
  tagId: string;
  productName: string;
  freePeriodEndsAt: string;
  monthlyPrice: number;
  autoRenew: boolean;
  subscriptionsUrl: string;
}

export function renderFreePeriodReminder3DayEmail(data: FreePeriodReminder3DayData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      <strong>Only 3 days left!</strong> Your PawTag <strong>${data.productName}</strong> free subscription period ends on <strong>${data.freePeriodEndsAt}</strong>.
    </p>
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Free Period Ends', value: data.freePeriodEndsAt },
      { label: 'Monthly Price After', value: `$${data.monthlyPrice.toFixed(2)}/month` },
      { label: 'Auto-Renew', value: data.autoRenew ? 'ON' : 'OFF' },
    ])}
    ${data.autoRenew
      ? renderStatusCard('success', 'Auto-Renew is ON', 'Your subscription will automatically continue. Your card will be charged $' + data.monthlyPrice.toFixed(2) + '/month after the free period.')
      : renderStatusCard('danger', 'Action Required', 'Auto-renew is OFF. Renew now to keep your pet protected without interruption.')
    }
    ${renderCtaButton(data.subscriptionsUrl, 'Manage Subscription')}
  `;

  return renderBase({
    title: 'URGENT: Free Subscription Ends in 3 Days',
    subtitle: 'Action May Be Required',
    bodyHtml,
    theme: 'danger',
  });
}

// ─── Grace Period Reminder — 3 Days ────────────────────────────────

interface GracePeriodReminder3DayData {
  name: string;
  tagId: string;
  gracePeriodEndsAt: string;
  renewUrl: string;
}

export function renderGracePeriodReminder3DayEmail(data: GracePeriodReminder3DayData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      <strong>URGENT:</strong> Your PawTag subscription for tag <strong>${data.tagId}</strong> grace period ends in <strong>3 days</strong>.
    </p>
    ${renderStatusCard('danger', 'Grace Period Ending', 'After ' + data.gracePeriodEndsAt + ', your tag will become EXPIRED and cannot be renewed. You will need to purchase a new tag.')}
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Renew now to keep your pet protected and maintain access to Guardian benefits.
    </p>
    ${renderCtaButton(data.renewUrl, 'Renew Now — Avoid Expiration')}
  `;

  return renderBase({
    title: 'URGENT: Grace Period Ends in 3 Days',
    subtitle: 'Renew Now to Avoid Tag Expiration',
    bodyHtml,
    theme: 'danger',
  });
}

// ─── Tag Expired ───────────────────────────────────────────────────

interface TagExpiredData {
  name: string;
  tagId: string;
  productName: string;
  shopUrl: string;
}

export function renderTagExpiredEmail(data: TagExpiredData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your PawTag <strong>${data.productName}</strong> subscription for tag <strong>${data.tagId}</strong> has expired.
    </p>
    ${renderStatusCard('danger', 'Tag Expired', 'This tag is no longer active. When someone scans this tag, they will NOT see your pet\'s information.')}
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      To restore pet recovery protection for your pet, you will need to purchase a new PawTag.
    </p>
    ${renderCtaButton(data.shopUrl, 'Buy a New PawTag')}
  `;

  return renderBase({
    title: 'Your PawTag Has Expired',
    subtitle: 'Subscription Notice',
    bodyHtml,
    theme: 'danger',
  });
}

// ─── Subscription Renewed ─────────────────────────────────────────

interface SubscriptionRenewalData {
  name: string;
  tagId: string;
  planName: string;
  amount: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  subscriptionsUrl: string;
}

export function renderSubscriptionRenewalEmail(data: SubscriptionRenewalData): string {
  const bodyHtml = `
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi ${data.name},</p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Your PawTag <strong>${data.planName}</strong> subscription for tag <strong>${data.tagId}</strong> has been successfully renewed.
    </p>
    ${renderStatusCard('success', 'Renewal Confirmed', 'Your subscription is active and your pet remains protected.')}

    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Plan', value: data.planName },
      { label: 'Amount Charged', value: `$${data.amount.toFixed(2)}` },
      { label: 'Billing Period', value: `${data.billingPeriodStart} — ${data.billingPeriodEnd}` },
    ])}

    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Your next renewal will be processed on <strong>${data.billingPeriodEnd}</strong>. You can manage your subscription at any time from your account.
    </p>

    ${renderCtaButton(data.subscriptionsUrl, 'Manage Subscription')}
  `;

  return renderBase({
    title: 'Subscription Renewed',
    subtitle: `${data.planName} — Payment Confirmed`,
    bodyHtml,
    theme: 'success',
  });
}
