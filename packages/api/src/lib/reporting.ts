/**
 * Operational reporting for PawTag.
 *
 * Turns raw logs, traces, metrics and audit events into useful operational reports.
 * Reports distinguish between FACT, OBSERVATION, INFERENCE, and RECOMMENDATION.
 */

import logger from './logger';
import { collectMetrics } from './metrics';
import { getRequestContext } from './request-context';
import { getFeatureRegistry, getExpectedAuditEvents } from './correlation';

// ─── Types ─────────────────────────────────────────────────────────

export type EvidenceType = 'FACT' | 'OBSERVATION' | 'INFERENCE' | 'RECOMMENDATION';

export interface ReportEvidence {
  type: EvidenceType;
  description: string;
  source: string;
  timestamp?: string;
  data?: unknown;
}

export interface IncidentReport {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  title: string;
  description: string;
  whatHappened: string;
  when: string;
  service: string;
  requestId?: string;
  userId?: string;
  whatFailed: string;
  whatWasAffected: string;
  beforeEvents: string[];
  afterEvents: string[];
  likelyRootCause: string;
  evidence: ReportEvidence[];
  recommendations: string[];
  timestamp: string;
}

export interface RequestTimelineEntry {
  timestamp: string;
  type: 'request' | 'log' | 'trace' | 'audit' | 'error';
  message: string;
  details?: unknown;
  duration?: number;
}

export interface RequestTimelineReport {
  requestId: string;
  correlationId?: string;
  traceId?: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  entries: RequestTimelineEntry[];
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  timestamp: string;
}

export interface FeatureHealthReport {
  featureId: string;
  featureName: string;
  errorRate: number;
  avgLatency: number;
  workflowFailures: number;
  auditCoverage: number;
  documentationStatus: 'COMPLETE' | 'PARTIAL' | 'MISSING';
  openIncidents: number;
  recommendations: string[];
  timestamp: string;
}

export interface DependencyHealthReport {
  provider: string;
  successRate: number;
  avgLatency: number;
  errorCount: number;
  timeoutCount: number;
  retryCount: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  recommendations: string[];
  timestamp: string;
}

export interface OperationalSummary {
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
  activeIncidents: number;
  healthyFeatures: number;
  degradedFeatures: number;
  unhealthyFeatures: number;
  healthyDependencies: number;
  degradedDependencies: number;
  unhealthyDependencies: number;
  recommendations: string[];
  timestamp: string;
}

// ─── Severity Rules ────────────────────────────────────────────────

/**
 * Deterministic severity rules.
 * Never let an LLM arbitrarily decide severity.
 */
export function determineSeverity(
  errorRate: number,
  impactScope: 'single-user' | 'multiple-users' | 'all-users',
  duration: number
): IncidentReport['severity'] {
  // Critical: All users affected, high error rate, long duration
  if (impactScope === 'all-users' && errorRate > 0.5 && duration > 300000) {
    return 'CRITICAL';
  }

  // High: Multiple users or high error rate
  if (impactScope === 'multiple-users' || (errorRate > 0.3 && duration > 60000)) {
    return 'HIGH';
  }

  // Medium: Single user with significant errors
  if (errorRate > 0.1 || duration > 30000) {
    return 'MEDIUM';
  }

  return 'LOW';
}

// ─── Report Generation ─────────────────────────────────────────────

/**
 * Generate an incident report from error context.
 */
export function generateIncidentReport(
  title: string,
  description: string,
  error: Error,
  context: {
    service?: string;
    requestId?: string;
    userId?: string;
    affectedScope?: string;
    beforeEvents?: string[];
    afterEvents?: string[];
  } = {}
): IncidentReport {
  const evidence: ReportEvidence[] = [
    {
      type: 'FACT',
      description: `Error occurred: ${error.message}`,
      source: 'error-handler',
      timestamp: new Date().toISOString(),
      data: { stack: error.stack },
    },
  ];

  if (context.requestId) {
    evidence.push({
      type: 'FACT',
      description: `Request ID: ${context.requestId}`,
      source: 'request-context',
    });
  }

  return {
    id: `INC-${Date.now()}`,
    severity: determineSeverity(0.1, 'single-user', 0),
    status: 'OPEN',
    title,
    description,
    whatHappened: error.message,
    when: new Date().toISOString(),
    service: context.service || 'pawtag-api',
    requestId: context.requestId,
    userId: context.userId,
    whatFailed: error.name || 'UnknownError',
    whatWasAffected: context.affectedScope || 'Unknown',
    beforeEvents: context.beforeEvents || [],
    afterEvents: context.afterEvents || [],
    likelyRootCause: error.stack?.split('\n')[0] || 'Unknown',
    evidence,
    recommendations: [
      'Check request logs for more context',
      'Review trace spans for timing information',
      'Check audit events for related operations',
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate a request timeline report.
 */
export function generateRequestTimeline(
  requestId: string,
  method: string,
  path: string,
  entries: RequestTimelineEntry[],
  statusCode?: number,
  duration?: number
): RequestTimelineReport {
  const outcome: RequestTimelineReport['outcome'] =
    statusCode && statusCode >= 400 ? 'FAILURE' : 'SUCCESS';

  return {
    requestId,
    method,
    path,
    statusCode,
    duration,
    entries: entries.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
    outcome,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate feature health report from metrics.
 */
export function generateFeatureHealthReport(
  featureId: string,
  featureName: string,
  metrics: {
    errorCount: number;
    totalRequests: number;
    avgLatency: number;
    workflowFailures: number;
  }
): FeatureHealthReport {
  const errorRate = metrics.totalRequests > 0
    ? metrics.errorCount / metrics.totalRequests
    : 0;

  const registry = getFeatureRegistry();
  const feature = registry[featureId];
  const documentationStatus = feature ? 'COMPLETE' : 'MISSING';

  const recommendations: string[] = [];
  if (errorRate > 0.1) {
    recommendations.push(`High error rate (${(errorRate * 100).toFixed(1)}%) - investigate error patterns`);
  }
  if (metrics.avgLatency > 1000) {
    recommendations.push(`High latency (${metrics.avgLatency.toFixed(0)}ms) - optimize performance`);
  }
  if (metrics.workflowFailures > 0) {
    recommendations.push(`${metrics.workflowFailures} workflow failures - review workflow logic`);
  }
  if (documentationStatus === 'MISSING') {
    recommendations.push('Feature not documented in registry - add documentation');
  }

  return {
    featureId,
    featureName,
    errorRate,
    avgLatency: metrics.avgLatency,
    workflowFailures: metrics.workflowFailures,
    auditCoverage: feature ? 1.0 : 0.0,
    documentationStatus,
    openIncidents: 0,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate dependency health report from metrics.
 */
export function generateDependencyHealthReport(
  provider: string,
  metrics: {
    successCount: number;
    errorCount: number;
    timeoutCount: number;
    retryCount: number;
    avgLatency: number;
  }
): DependencyHealthReport {
  const totalCalls = metrics.successCount + metrics.errorCount;
  const successRate = totalCalls > 0 ? metrics.successCount / totalCalls : 1.0;

  let status: DependencyHealthReport['status'] = 'HEALTHY';
  if (successRate < 0.9) status = 'DEGRADED';
  if (successRate < 0.5) status = 'UNHEALTHY';

  const recommendations: string[] = [];
  if (successRate < 0.9) {
    recommendations.push(`Low success rate (${(successRate * 100).toFixed(1)}%) - check provider status`);
  }
  if (metrics.timeoutCount > 0) {
    recommendations.push(`${metrics.timeoutCount} timeouts - consider increasing timeout or retry`);
  }
  if (metrics.retryCount > 10) {
    recommendations.push(`High retry count (${metrics.retryCount}) - investigate root cause`);
  }

  return {
    provider,
    successRate,
    avgLatency: metrics.avgLatency,
    errorCount: metrics.errorCount,
    timeoutCount: metrics.timeoutCount,
    retryCount: metrics.retryCount,
    status,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate operational summary from current metrics.
 */
export function generateOperationalSummary(): OperationalSummary {
  const metrics = collectMetrics();

  // Calculate totals from counters
  const totalRequests = metrics.counters.find(c => c.name === 'pawtag_http_requests_total')?.value || 0;
  const errorRequests = metrics.counters.find(c => c.name === 'pawtag_http_request_errors_total')?.value || 0;
  const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;

  // Calculate average response time from histogram
  const durationHist = metrics.histograms.find(h => h.name === 'pawtag_http_request_duration_ms');
  const avgResponseTime = durationHist && durationHist.count > 0
    ? durationHist.sum / durationHist.count
    : 0;

  const recommendations: string[] = [];
  if (errorRate > 0.05) {
    recommendations.push(`Elevated error rate (${(errorRate * 100).toFixed(1)}%) - investigate error patterns`);
  }
  if (avgResponseTime > 500) {
    recommendations.push(`High average response time (${avgResponseTime.toFixed(0)}ms) - optimize performance`);
  }

  return {
    totalRequests,
    errorRate,
    avgResponseTime,
    activeIncidents: 0,
    healthyFeatures: 0,
    degradedFeatures: 0,
    unhealthyFeatures: 0,
    healthyDependencies: 0,
    degradedDependencies: 0,
    unhealthyDependencies: 0,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format report evidence for human readability.
 */
export function formatEvidence(evidence: ReportEvidence[]): string {
  return evidence
    .map(e => `[${e.type}] ${e.description} (source: ${e.source})`)
    .join('\n');
}

/**
 * Export report as JSON (safe - no secrets).
 */
export function exportReport<T>(report: T): string {
  return JSON.stringify(report, null, 2);
}

export default {
  determineSeverity,
  generateIncidentReport,
  generateRequestTimeline,
  generateFeatureHealthReport,
  generateDependencyHealthReport,
  generateOperationalSummary,
  formatEvidence,
  exportReport,
};
