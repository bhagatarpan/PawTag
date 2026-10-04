/**
 * System audit context without hardcoded app name/version literals.
 * Source: env override → packages/api/package.json version.
 */
import fs from 'fs';
import path from 'path';
import type { AuditContext } from '../services/audit/audit.service';

export type SystemActorType = 'SERVICE' | 'SYSTEM';

let cachedMeta: { applicationName: string; applicationVersion: string; apiVersion: string } | null = null;

export function getApplicationMeta(): {
  applicationName: string;
  applicationVersion: string;
  apiVersion: string;
} {
  if (cachedMeta) return cachedMeta;

  let applicationVersion = process.env.SERVICE_VERSION?.trim();
  if (!applicationVersion) {
    try {
      const pkgPath = path.join(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
      applicationVersion = pkg.version || '0.0.0';
    } catch {
      applicationVersion = '0.0.0';
    }
  }

  cachedMeta = {
    applicationName: process.env.SERVICE_NAME?.trim() || 'pawtag-api',
    applicationVersion,
    apiVersion: process.env.API_VERSION?.trim() || 'v1',
  };
  return cachedMeta;
}

/** Audit context for background/system actors (Stripe webhooks, jobs, services). */
export function systemAuditContext(
  actorType: SystemActorType,
  extras: Partial<AuditContext> = {},
): AuditContext {
  return {
    actorType,
    actorId: 'system',
    actorUsername: actorType === 'SYSTEM' ? 'system' : 'pawtag-service',
    sourceIp: 'system',
    userAgent: 'pawtag-system',
    ...getApplicationMeta(),
    environment: process.env.NODE_ENV || 'development',
    ...extras,
  };
}

/** Audit context for Stripe webhook system actor. */
export function stripeWebhookAuditContext(extras: Partial<AuditContext> = {}): AuditContext {
  return systemAuditContext('SYSTEM', {
    actorId: 'stripe-webhook',
    actorUsername: 'stripe-webhook',
    sourceIp: 'stripe',
    userAgent: 'stripe-webhook',
    ...extras,
  });
}
