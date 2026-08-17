/**
 * Log-Audit-Documentation correlation for PawTag.
 *
 * Connects three evidence systems:
 * 1. Application logs = technical evidence
 * 2. Audit trail = business/security evidence
 * 3. Documentation = intended behaviour
 *
 * Provides traceability between them using stable identifiers.
 */

import logger from './logger';
import { getRequestContext } from './request-context';
import { getCurrentTraceContext } from './tracing';
import { auditService } from '../services/audit';

// ─── Types ─────────────────────────────────────────────────────────

export interface FeatureContext {
  featureId?: string;
  featureName?: string;
  workflowId?: string;
  workflowName?: string;
  businessOperation?: string;
  auditEventType?: string;
}

export interface CorrelationContext extends FeatureContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  otelTraceId?: string;
  otelSpanId?: string;
}

export interface CorrelationEvidence {
  feature?: string;
  workflow?: string;
  businessOperation?: string;
  auditEvent?: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  logs?: string[];
  outcome?: string;
  timestamp?: string;
}

// ─── Feature Registry ──────────────────────────────────────────────

/**
 * Registry of known features and their expected audit events.
 * Used to identify gaps between documentation and implementation.
 */
const FEATURE_REGISTRY: Record<string, {
  name: string;
  workflows: Record<string, {
    name: string;
    operations: string[];
    expectedAuditEvents: string[];
  }>;
}> = {
  'auth': {
    name: 'Authentication',
    workflows: {
      'login': {
        name: 'User Login',
        operations: ['login', 'verify-mfa', 'refresh-token'],
        expectedAuditEvents: ['auth.login.success', 'auth.login.failure', 'auth.mfa.verify'],
      },
      'register': {
        name: 'User Registration',
        operations: ['register', 'verify-email'],
        expectedAuditEvents: ['auth.register.success', 'auth.email.verify'],
      },
      'password': {
        name: 'Password Management',
        operations: ['forgot-password', 'reset-password', 'change-password'],
        expectedAuditEvents: ['auth.password.reset', 'auth.password.change'],
      },
    },
  },
  'pets': {
    name: 'Pet Management',
    workflows: {
      'pet-crud': {
        name: 'Pet CRUD Operations',
        operations: ['create-pet', 'update-pet', 'delete-pet'],
        expectedAuditEvents: ['pet.create', 'pet.update', 'pet.delete'],
      },
      'tag-management': {
        name: 'Tag Management',
        operations: ['assign-tag', 'activate-tag', 'deactivate-tag'],
        expectedAuditEvents: ['tag.assign', 'tag.activate', 'tag.deactivate'],
      },
    },
  },
  'finder': {
    name: 'Finder Portal',
    workflows: {
      'pet-lookup': {
        name: 'Pet Lookup',
        operations: ['scan-tag', 'view-pet-info'],
        expectedAuditEvents: ['finder.scan', 'finder.view'],
      },
      'notify-owner': {
        name: 'Owner Notification',
        operations: ['notify-owner', 'share-location'],
        expectedAuditEvents: ['finder.notify', 'finder.location.share'],
      },
    },
  },
  'orders': {
    name: 'Order Management',
    workflows: {
      'checkout': {
        name: 'Checkout Flow',
        operations: ['create-order', 'process-payment', 'complete-order'],
        expectedAuditEvents: ['order.create', 'payment.process', 'order.complete'],
      },
    },
  },
  'notifications': {
    name: 'Notifications',
    workflows: {
      'email': {
        name: 'Email Notifications',
        operations: ['send-email', 'send-verification', 'send-otp'],
        expectedAuditEvents: ['notification.email.send'],
      },
      'sms': {
        name: 'SMS Notifications',
        operations: ['send-sms', 'send-otp'],
        expectedAuditEvents: ['notification.sms.send'],
      },
    },
  },
};

// ─── Correlation Functions ─────────────────────────────────────────

/**
 * Create a correlation context from current request and feature context.
 */
export function createCorrelationContext(feature?: FeatureContext): CorrelationContext {
  const reqCtx = getRequestContext();
  const traceCtx = getCurrentTraceContext();

  return {
    ...feature,
    requestId: reqCtx?.requestId,
    correlationId: reqCtx?.correlationId,
    traceId: reqCtx?.traceId,
    otelTraceId: traceCtx?.traceId,
    otelSpanId: traceCtx?.spanId,
  };
}

/**
 * Log with feature/workflow context for correlation.
 */
export function logWithCorrelation(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  feature?: FeatureContext,
  extra?: Record<string, unknown>
): void {
  const correlation = createCorrelationContext(feature);

  logger[level](
    {
      ...correlation,
      ...extra,
      correlationType: 'feature-operation',
    },
    message
  );
}

/**
 * Emit an audit event with correlation context.
 */
export async function auditWithCorrelation(
  feature: FeatureContext,
  action: string,
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'PENDING',
  details?: Record<string, unknown>
): Promise<void> {
  const correlation = createCorrelationContext(feature);

  try {
    await auditService.log(
      {
        requestId: correlation.requestId || 'unknown',
        correlationId: correlation.correlationId || 'unknown',
        traceId: correlation.traceId || 'unknown',
        transactionId: correlation.requestId || 'unknown',
        actorType: 'SYSTEM',
        sourceIp: 'internal',
        userAgent: 'pawtag-api',
        applicationName: 'pawtag-api',
        applicationVersion: process.env.SERVICE_VERSION || '0.1.0',
        apiVersion: 'v1',
        environment: process.env.NODE_ENV || 'development',
      },
      {
        action,
        eventType: feature.auditEventType || `${feature.featureName || 'unknown'}.${action}`,
        eventCategory: 'SYSTEM',
        operationType: action,
        resourceType: feature.featureName || 'SYSTEM',
        resourceId: feature.workflowId || feature.featureId || 'unknown',
        outcome,
        severity: outcome === 'FAILURE' ? 'HIGH' : 'INFO',
        metadata: {
          featureId: feature.featureId,
          featureName: feature.featureName,
          workflowId: feature.workflowId,
          workflowName: feature.workflowName,
          businessOperation: feature.businessOperation,
          ...details,
        },
      }
    );
  } catch (error) {
    // Audit failure must not affect business operations
    logger.warn(
      { err: error, feature: feature.featureName, action },
      'Failed to emit correlation audit event'
    );
  }
}

/**
 * Get feature registry for documentation correlation.
 */
export function getFeatureRegistry(): typeof FEATURE_REGISTRY {
  return FEATURE_REGISTRY;
}

/**
 * Check if an operation has expected audit events defined.
 */
export function hasExpectedAuditEvents(feature: string, workflow: string): boolean {
  const featureDef = FEATURE_REGISTRY[feature];
  if (!featureDef) return false;

  const workflowDef = featureDef.workflows[workflow];
  if (!workflowDef) return false;

  return workflowDef.expectedAuditEvents.length > 0;
}

/**
 * Get expected audit events for a feature/workflow.
 */
export function getExpectedAuditEvents(feature: string, workflow: string): string[] {
  const featureDef = FEATURE_REGISTRY[feature];
  if (!featureDef) return [];

  const workflowDef = featureDef.workflows[workflow];
  if (!workflowDef) return [];

  return workflowDef.expectedAuditEvents;
}

/**
 * Build a human-readable correlation evidence summary.
 */
export function buildCorrelationEvidence(
  feature: FeatureContext,
  outcome: string,
  additionalLogs?: string[]
): CorrelationEvidence {
  const correlation = createCorrelationContext(feature);

  return {
    feature: feature.featureName,
    workflow: feature.workflowName,
    businessOperation: feature.businessOperation,
    auditEvent: feature.auditEventType,
    requestId: correlation.requestId,
    correlationId: correlation.correlationId,
    traceId: correlation.otelTraceId || correlation.traceId,
    spanId: correlation.otelSpanId,
    logs: additionalLogs,
    outcome,
    timestamp: new Date().toISOString(),
  };
}

export default {
  createCorrelationContext,
  logWithCorrelation,
  auditWithCorrelation,
  getFeatureRegistry,
  hasExpectedAuditEvents,
  getExpectedAuditEvents,
  buildCorrelationEvidence,
};
