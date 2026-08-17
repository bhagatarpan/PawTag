/**
 * Lightweight metrics collector for PawTag.
 *
 * OpenTelemetry-compatible metrics foundation using in-process counters.
 * Tracks request counts, durations, errors, and dependency health.
 *
 * Designed to be vendor-neutral and exportable to any metrics backend.
 */

import { getRequestContext } from './request-context';

// ─── Types ─────────────────────────────────────────────────────────

export interface MetricLabels {
  [key: string]: string;
}

export interface CounterMetric {
  name: string;
  help: string;
  value: number;
  labels: Record<string, number>;
}

export interface HistogramMetric {
  name: string;
  help: string;
  count: number;
  sum: number;
  buckets: Record<number, number>;
}

export interface GaugeMetric {
  name: string;
  help: string;
  value: number;
}

export type Metric = CounterMetric | HistogramMetric | GaugeMetric;

// ─── Counters ──────────────────────────────────────────────────────

const counters = new Map<string, { value: number; labels: Map<string, number> }>();

export function incrementCounter(name: string, labels: MetricLabels = {}, value = 1): void {
  const key = name;
  if (!counters.has(key)) {
    counters.set(key, { value: 0, labels: new Map() });
  }
  const counter = counters.get(key)!;
  counter.value += value;

  const labelKey = serializeLabels(labels);
  if (labelKey) {
    counter.labels.set(labelKey, (counter.labels.get(labelKey) || 0) + value);
  }
}

// ─── Histograms ────────────────────────────────────────────────────

const histograms = new Map<string, { count: number; sum: number; buckets: Map<number, number> }>();

const DEFAULT_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export function recordHistogram(name: string, value: number, buckets = DEFAULT_BUCKETS): void {
  if (!histograms.has(name)) {
    histograms.set(name, { count: 0, sum: 0, buckets: new Map() });
  }
  const hist = histograms.get(name)!;
  hist.count++;
  hist.sum += value;

  for (const bucket of buckets) {
    if (value <= bucket) {
      hist.buckets.set(bucket, (hist.buckets.get(bucket) || 0) + 1);
    }
  }
}

// ─── Gauges ────────────────────────────────────────────────────────

const gauges = new Map<string, number>();

export function setGauge(name: string, value: number): void {
  gauges.set(name, value);
}

// ─── Metric Names ──────────────────────────────────────────────────

export const METRICS = {
  // HTTP
  HTTP_REQUESTS_TOTAL: 'pawtag_http_requests_total',
  HTTP_REQUEST_ERRORS_TOTAL: 'pawtag_http_request_errors_total',
  HTTP_REQUEST_DURATION_MS: 'pawtag_http_request_duration_ms',
  HTTP_STATUS_DISTRIBUTION: 'pawtag_http_status_distribution',

  // Auth
  AUTH_FAILURES_TOTAL: 'pawtag_auth_failures_total',
  AUTH_SUCCESS_TOTAL: 'pawtag_auth_success_total',

  // Database
  DB_OPERATIONS_TOTAL: 'pawtag_db_operations_total',
  DB_ERRORS_TOTAL: 'pawtag_db_errors_total',
  DB_DURATION_MS: 'pawtag_db_duration_ms',
  DB_SLOW_QUERIES_TOTAL: 'pawtag_db_slow_queries_total',

  // External integrations
  INTEGRATION_CALLS_TOTAL: 'pawtag_integration_calls_total',
  INTEGRATION_ERRORS_TOTAL: 'pawtag_integration_errors_total',
  INTEGRATION_DURATION_MS: 'pawtag_integration_duration_ms',

  // Background jobs
  JOB_EXECUTIONS_TOTAL: 'pawtag_job_executions_total',
  JOB_ERRORS_TOTAL: 'pawtag_job_errors_total',
  JOB_DURATION_MS: 'pawtag_job_duration_ms',

  // Rate limiting
  RATE_LIMIT_HITS_TOTAL: 'pawtag_rate_limit_hits_total',

  // Notifications
  NOTIFICATIONS_SENT_TOTAL: 'pawtag_notifications_sent_total',
  NOTIFICATIONS_FAILED_TOTAL: 'pawtag_notifications_failed_total',

  // System
  ACTIVE_CONNECTIONS: 'pawtag_active_connections',
  UPTIME_SECONDS: 'pawtag_uptime_seconds',
} as const;

// ─── Helpers ───────────────────────────────────────────────────────

function serializeLabels(labels: MetricLabels): string {
  const keys = Object.keys(labels).sort();
  if (keys.length === 0) return '';
  return keys.map(k => `${k}=${labels[k]}`).join(',');
}

// ─── Collection ────────────────────────────────────────────────────

export function collectMetrics(): {
  counters: CounterMetric[];
  histograms: HistogramMetric[];
  gauges: GaugeMetric[];
} {
  const result = {
    counters: [] as CounterMetric[],
    histograms: [] as HistogramMetric[],
    gauges: [] as GaugeMetric[],
  };

  for (const [name, data] of counters) {
    result.counters.push({
      name,
      help: '',
      value: data.value,
      labels: Object.fromEntries(data.labels),
    });
  }

  for (const [name, data] of histograms) {
    result.histograms.push({
      name,
      help: '',
      count: data.count,
      sum: data.sum,
      buckets: Object.fromEntries(data.buckets),
    });
  }

  for (const [name, value] of gauges) {
    result.gauges.push({ name, help: '', value });
  }

  return result;
}

/**
 * Reset all metrics (for testing).
 */
export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
  gauges.clear();
}
