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
