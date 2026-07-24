import { describe, it, expect } from 'vitest';
import { renderBase, renderCtaButton, renderInfoBox, renderDivider } from '../../packages/api/src/services/email/templates/base';
import { renderVerificationEmail } from '../../packages/api/src/services/email/templates/verification-email';
import { renderWelcomeEmail } from '../../packages/api/src/services/email/templates/welcome';
import { renderPasswordResetEmail } from '../../packages/api/src/services/email/templates/password-reset';
import { renderPetFoundEmail } from '../../packages/api/src/services/email/templates/pet-found';
import { renderAccountStatusEmail } from '../../packages/api/src/services/email/templates/account-status';

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
