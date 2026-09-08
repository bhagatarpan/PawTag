import { describe, it, expect } from 'vitest';
import { renderBase, renderCtaButton, renderInfoBox, renderDivider } from '../../packages/api/src/services/email/templates/base';
import { renderVerificationEmail } from '../../packages/api/src/services/email/templates/verification-email';
import { renderWelcomeEmail } from '../../packages/api/src/services/email/templates/welcome';
import { renderPasswordResetEmail } from '../../packages/api/src/services/email/templates/password-reset';
import { renderPasswordChangedEmail } from '../../packages/api/src/services/email/templates/password-changed';
import { renderPetFoundEmail } from '../../packages/api/src/services/email/templates/pet-found';
import { renderAccountStatusEmail } from '../../packages/api/src/services/email/templates/account-status';
import { renderGuardianWelcomeEmail } from '../../packages/api/src/services/email/templates/guardian-welcome';
import { renderTierUpgradeEmail } from '../../packages/api/src/services/email/templates/guardian-tier-upgrade';
import { renderGuardianBirthdayEmail } from '../../packages/api/src/services/email/templates/guardian-birthday';
import { renderMonthlySummaryEmail } from '../../packages/api/src/services/email/templates/guardian-monthly-summary';
import { renderPawRewardsReminderEmail } from '../../packages/api/src/services/email/templates/guardian-pawrewards-reminder';
import { renderGuardianAnniversaryEmail } from '../../packages/api/src/services/email/templates/guardian-anniversary';
import { renderGuardianRenewalReminderEmail } from '../../packages/api/src/services/email/templates/guardian-renewal-reminder';

describe('Base Email Template', () => {
  it('returns valid HTML with title', () => {
    const html = renderBase({ title: 'Test Title', bodyHtml: '<p>Hello</p>' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Title');
    expect(html).toContain('<p>Hello</p>');
  });

  it('includes preheader when provided', () => {
    const html = renderBase({ title: 'T', bodyHtml: '', preheader: 'Preview text' });
    expect(html).toContain('Preview text');
  });

  it('includes empty preheader element when not provided', () => {
    const html = renderBase({ title: 'T', bodyHtml: '' });
    expect(html).toContain('visibility:hidden');
    // The preheader span exists but is empty
    const match = html.match(/visibility:hidden[^>]*>([^<]*)</);
    expect(match?.[1]?.trim()).toBe('');
  });

  it('includes subtitle when provided', () => {
    const html = renderBase({ title: 'T', bodyHtml: '', subtitle: 'My subtitle' });
    expect(html).toContain('My subtitle');
  });

  it('includes PawTag branding', () => {
    const html = renderBase({ title: 'T', bodyHtml: '' });
    expect(html).toContain('PawTag');
  });
});

describe('Email Helpers', () => {
  it('renderCtaButton returns HTML with URL and label', () => {
    const html = renderCtaButton('https://example.com', 'Click Me');
    expect(html).toContain('https://example.com');
    expect(html).toContain('Click Me');
  });

  it('renderInfoBox wraps content', () => {
    const html = renderInfoBox('<p>info</p>');
    expect(html).toContain('background-color:#f0fdfa');
    expect(html).toContain('<p>info</p>');
  });

  it('renderDivider returns hr', () => {
    const html = renderDivider();
    expect(html).toContain('<hr');
  });
});

describe('Verification Email', () => {
  it('includes verification URL', () => {
    const html = renderVerificationEmail({ name: 'John', verificationUrl: 'https://app.com/verify?token=abc123' });
    expect(html).toContain('https://app.com/verify?token=abc123');
  });

  it('includes user name', () => {
    const html = renderVerificationEmail({ name: 'John', verificationUrl: 'https://app.com/v' });
    expect(html).toContain('John');
  });

  it('mentions 24-hour expiry', () => {
    const html = renderVerificationEmail({ name: 'John', verificationUrl: 'https://app.com/v' });
    expect(html).toContain('24');
  });
});

describe('Welcome Email', () => {
  it('includes user name and account URL', () => {
    const html = renderWelcomeEmail({ name: 'Jane', accountUrl: 'https://app.com/account' });
    expect(html).toContain('Jane');
    expect(html).toContain('https://app.com/account');
  });
});

describe('Password Reset Email', () => {
  it('includes reset URL', () => {
    const html = renderPasswordResetEmail({ name: 'Jane', resetUrl: 'https://app.com/reset?token=xyz' });
    expect(html).toContain('https://app.com/reset?token=xyz');
  });

  it('includes user name', () => {
    const html = renderPasswordResetEmail({ name: 'Jane', resetUrl: 'https://app.com/r' });
    expect(html).toContain('Jane');
  });
});

describe('Pet Found Email', () => {
  it('includes pet and owner names', () => {
    const html = renderPetFoundEmail({ ownerName: 'Bob', petName: 'Buddy', viewDetailsUrl: 'https://app.com' });
    expect(html).toContain('Bob');
    expect(html).toContain('Buddy');
  });

  it('includes finder message when provided', () => {
    const html = renderPetFoundEmail({ ownerName: 'Bob', petName: 'Buddy', finderMessage: 'Found near park', viewDetailsUrl: 'https://app.com' });
    expect(html).toContain('Found near park');
  });
});

describe('Account Status Email', () => {
  it('includes status', () => {
    const html = renderAccountStatusEmail({ name: 'Alice', status: 'suspended', viewDetailsUrl: 'https://app.com' });
    expect(html).toContain('Suspended');
    expect(html).toContain('Alice');
  });

  it('includes reason when provided', () => {
    const html = renderAccountStatusEmail({ name: 'Alice', status: 'active', reason: 'Reviewed by admin', viewDetailsUrl: 'https://app.com' });
    expect(html).toContain('Reviewed by admin');
  });
});

describe('Password Changed Email', () => {
  it('includes user name', () => {
    const html = renderPasswordChangedEmail({ name: 'Bob', changedBy: 'self' });
    expect(html).toContain('Bob');
  });

  it('includes "You" when changed by self', () => {
    const html = renderPasswordChangedEmail({ name: 'Bob', changedBy: 'self' });
    expect(html).toContain('You');
  });

  it('includes admin ID when changed by admin', () => {
    const html = renderPasswordChangedEmail({ name: 'Bob', changedBy: 'admin-user-id-123' });
    expect(html).toContain('admin-user-id-123');
    expect(html).toContain('administrator');
  });

  it('includes IP address when provided', () => {
    const html = renderPasswordChangedEmail({ name: 'Bob', changedBy: 'self', ipAddress: '192.168.1.1' });
    expect(html).toContain('192.168.1.1');
  });

  it('includes support email for security concerns', () => {
    const html = renderPasswordChangedEmail({ name: 'Bob', changedBy: 'self' });
    expect(html).toContain('support@pawtag.co.nz');
  });

  it('is valid HTML', () => {
    const html = renderPasswordChangedEmail({ name: 'Bob', changedBy: 'self' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('PawTag');
  });
});

describe('Guardian Welcome Email', () => {
  it('includes customer name and tier', () => {
    const html = renderGuardianWelcomeEmail({ customerName: 'Alice', tier: 'Nurture', points: 100, dashboardUrl: 'https://app.com/guardian' });
    expect(html).toContain('Alice');
    expect(html).toContain('Nurture');
  });

  it('includes starting points', () => {
    const html = renderGuardianWelcomeEmail({ customerName: 'Alice', tier: 'Care', points: 50, dashboardUrl: 'https://app.com/guardian' });
    expect(html).toContain('50');
  });

  it('includes dashboard URL', () => {
    const html = renderGuardianWelcomeEmail({ customerName: 'Alice', tier: 'Care', points: 0, dashboardUrl: 'https://app.com/guardian' });
    expect(html).toContain('https://app.com/guardian');
  });
});

describe('Tier Upgrade Email', () => {
  it('includes previous and new tier', () => {
    const html = renderTierUpgradeEmail({
      customerName: 'Bob', previousTier: 'Care', newTier: 'Nurture', points: 150,
      benefits: ['Monthly PawRewards: $3.00'], dashboardUrl: 'https://app.com/guardian',
    });
    expect(html).toContain('Care');
    expect(html).toContain('Nurture');
  });

  it('includes benefits list', () => {
    const html = renderTierUpgradeEmail({
      customerName: 'Bob', previousTier: 'Nurture', newTier: 'Protector', points: 250,
      benefits: ['Early access', 'Priority support'], dashboardUrl: 'https://app.com/guardian',
    });
    expect(html).toContain('Early access');
    expect(html).toContain('Priority support');
  });
});

describe('Guardian Birthday Email', () => {
  it('includes pet name and points', () => {
    const html = renderGuardianBirthdayEmail({ customerName: 'Carol', petName: 'Buddy', pointsEarned: 10, dashboardUrl: 'https://app.com/guardian' });
    expect(html).toContain('Buddy');
    expect(html).toContain('10');
  });
});

describe('Monthly Summary Email', () => {
  it('includes tier and points data', () => {
    const html = renderMonthlySummaryEmail({
      customerName: 'Dave', tier: 'Protector', pointsEarned: 25, totalPoints: 300,
      pawRewardsBalance: 12.50, pawRewardsAllocated: 5.00, topActivity: 'Purchase', dashboardUrl: 'https://app.com/guardian',
    });
    expect(html).toContain('Protector');
    expect(html).toContain('25');
    expect(html).toContain('300');
  });

  it('includes top activity when provided', () => {
    const html = renderMonthlySummaryEmail({
      customerName: 'Dave', tier: 'Care', pointsEarned: 10, totalPoints: 50,
      pawRewardsBalance: 2.00, pawRewardsAllocated: 2.00, topActivity: 'Review', dashboardUrl: 'https://app.com/guardian',
    });
    expect(html).toContain('Review');
  });
});

describe('PawRewards Reminder Email', () => {
  it('includes balance and expiration info', () => {
    const html = renderPawRewardsReminderEmail({
      customerName: 'Eve', balance: 8.50, expirationDate: '2026-03-01', expirationAmount: 3.00, redeemUrl: 'https://app.com/rewards',
    });
    expect(html).toContain('Eve');
    expect(html).toContain('8.50');
    expect(html).toContain('3');
  });
});

describe('Guardian Anniversary Email', () => {
  it('includes pet name and years', () => {
    const html = renderGuardianAnniversaryEmail({
      customerName: 'Frank', petName: 'Luna', yearsOwned: 2, pointsEarned: 10, dashboardUrl: 'https://app.com/guardian',
    });
    expect(html).toContain('Luna');
    expect(html).toContain('2');
    expect(html).toContain('10');
  });
});

describe('Guardian Renewal Reminder Email', () => {
  it('includes tier and renewal date', () => {
    const html = renderGuardianRenewalReminderEmail({
      customerName: 'Grace', tier: 'Safeguard', renewalDate: '2026-06-01',
      currentBenefits: ['Monthly PawRewards: $8.00', 'Free shipping'], dashboardUrl: 'https://app.com/subscriptions',
    });
    expect(html).toContain('Safeguard');
    expect(html).toContain('2026-06-01');
  });

  it('includes benefits list', () => {
    const html = renderGuardianRenewalReminderEmail({
      customerName: 'Grace', tier: 'Care', renewalDate: '2026-06-01',
      currentBenefits: ['Monthly PawRewards: $2.00'], dashboardUrl: 'https://app.com/subscriptions',
    });
    expect(html).toContain('Monthly PawRewards: $2.00');
  });
});
