/**
 * @module Tag Active Period Expiring Email Templates
 * @description Email templates for HYBRID 2 Active Period expiration warnings.
 *
 * These templates are sent when a tag's Active Period is approaching expiration:
 * - 30 days before: Warning email
 * - 7 days before: Urgent warning email
 * - Last day: Final warning email
 *
 * The goal is to incentivize customers to purchase membership to maintain
 * full finder functionality for their pets.
 */

import { renderBase, renderCtaButton, renderInfoBox, renderDataTable } from './base';

export interface TagActivePeriodExpiringData {
  customerName: string;
  tagId: string;
  petName: string;
  activePeriodEndsAt: string;
  daysRemaining: number;
  dashboardUrl: string;
  membershipUrl: string;
}

/**
 * Render 30-day warning email (theme: default/teal)
 */
export function renderTagActivePeriodExpiring30DayEmail(data: TagActivePeriodExpiringData): string {
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${data.customerName},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your PawTag <strong>${data.tagId}</strong> for <strong>${data.petName}</strong> has <strong>${data.daysRemaining} days</strong> remaining in its Active Period.
    </p>
    
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Pet', value: data.petName },
      { label: 'Expires', value: data.activePeriodEndsAt },
      { label: 'Days Remaining', value: `${data.daysRemaining} days` },
    ])}
    
    ${renderInfoBox(`
      <p style="font-weight:600;font-size:14px;margin:0 0 8px;color:#374151;">What happens after the Active Period?</p>
      <p style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">
        After the Active Period expires, your tag will still work for NFC/QR scanning, but <strong>finder notifications will stop</strong>. This means if your pet is found, the finder won't be able to notify you.
      </p>
      <p style="margin: 0; color: #374151; font-size: 14px;">
        To maintain full finder functionality, purchase a <strong>Guardian Membership</strong> (Gold, Platinum, or Black) which extends your tag for 12 months.
      </p>
    `, 'info')}
    
    <div style="text-align: center; margin: 32px 0;">
      ${renderCtaButton(data.membershipUrl, 'View Membership Options')}
    </div>
    
    <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
      You can also manage your tags in your <a href="${data.dashboardUrl}" style="color: #0d9488;">account dashboard</a>.
    </p>
  `;

  return renderBase({
    title: 'Your PawTag Active Period is Expiring',
    bodyHtml,
    theme: 'default',
  });
}

/**
 * Render 7-day warning email (theme: warning/amber)
 */
export function renderTagActivePeriodExpiring7DayEmail(data: TagActivePeriodExpiringData): string {
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${data.customerName},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      <strong>Important:</strong> Your PawTag <strong>${data.tagId}</strong> for <strong>${data.petName}</strong> has only <strong>${data.daysRemaining} days</strong> remaining in its Active Period.
    </p>
    
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Pet', value: data.petName },
      { label: 'Expires', value: data.activePeriodEndsAt },
      { label: 'Days Remaining', value: `${data.daysRemaining} days` },
    ])}
    
    <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: 600;">
        ⚠️ Action Required
      </p>
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        After the Active Period expires, finder notifications will stop working. If your pet is lost, finders won't be able to alert you.
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      ${renderCtaButton(data.membershipUrl, 'Purchase Membership Now')}
    </div>
    
    <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
      Gold membership starts at $89/year and covers up to 3 tags.
    </p>
  `;

  return renderBase({
    title: 'Urgent: PawTag Active Period Expiring Soon',
    bodyHtml,
    theme: 'warning',
  });
}

/**
 * Render last-day warning email (theme: danger/red)
 */
export function renderTagActivePeriodExpiringLastDayEmail(data: TagActivePeriodExpiringData): string {
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${data.customerName},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      <strong>Final Notice:</strong> Your PawTag <strong>${data.tagId}</strong> for <strong>${data.petName}</strong> expires <strong>TODAY</strong>.
    </p>
    
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Pet', value: data.petName },
      { label: 'Expires', value: 'Today' },
    ])}
    
    <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 16px; font-weight: 600;">
        🚨 Finder Notifications Will Stop Working
      </p>
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        After today, if your pet is lost, finders will see your pet's information but <strong>cannot notify you</strong>. Purchase a membership now to restore full functionality.
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      ${renderCtaButton(data.membershipUrl, 'Purchase Membership Immediately')}
    </div>
    
    <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
      Membership extends your tag for 12 months and restores full finder notifications.
    </p>
  `;

  return renderBase({
    title: '🚨 PawTag Active Period Expires Today',
    bodyHtml,
    theme: 'danger',
  });
}

/**
 * Render expired notification email (theme: danger/red)
 * Sent after Active Period has expired
 */
export function renderTagActivePeriodExpiredEmail(data: TagActivePeriodExpiringData): string {
  const bodyHtml = `
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Hi ${data.customerName},
    </p>
    
    <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
      Your PawTag <strong>${data.tagId}</strong> for <strong>${data.petName}</strong> has expired.
    </p>
    
    ${renderDataTable([
      { label: 'Tag ID', value: data.tagId },
      { label: 'Pet', value: data.petName },
      { label: 'Expired On', value: data.activePeriodEndsAt },
    ])}
    
    <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: 600;">
        What this means:
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 14px;">
        <li>Your tag will still work for NFC/QR scanning</li>
        <li><strong>Finder notifications are disabled</strong></li>
        <li>If your pet is found, the finder cannot alert you</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      ${renderCtaButton(data.membershipUrl, 'Restore Finder Notifications')}
    </div>
    
    <p style="margin: 16px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
      Purchase a Guardian Membership to restore full finder functionality for 12 months.
    </p>
  `;

  return renderBase({
    title: 'PawTag Active Period Has Expired',
    bodyHtml,
    theme: 'danger',
  });
}
