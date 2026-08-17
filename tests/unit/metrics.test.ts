import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  incrementCounter,
  recordHistogram,
  setGauge,
  collectMetrics,
  resetMetrics,
  METRICS,
} from '../../packages/api/src/lib/metrics';

describe('Metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('incrementCounter', () => {
    it('increments a counter', () => {
      incrementCounter('test_counter');
      const metrics = collectMetrics();
      const counter = metrics.counters.find(c => c.name === 'test_counter');
      expect(counter).toBeDefined();
      expect(counter!.value).toBe(1);
    });

    it('increments a counter multiple times', () => {
      incrementCounter('test_counter');
      incrementCounter('test_counter');
      incrementCounter('test_counter');
      const metrics = collectMetrics();
      const counter = metrics.counters.find(c => c.name === 'test_counter');
      expect(counter!.value).toBe(3);
    });

    it('increments with labels', () => {
      incrementCounter('test_counter', { method: 'GET', status: '2xx' });
      incrementCounter('test_counter', { method: 'POST', status: '2xx' });
      incrementCounter('test_counter', { method: 'GET', status: '2xx' });
      const metrics = collectMetrics();
      const counter = metrics.counters.find(c => c.name === 'test_counter');
      expect(counter!.value).toBe(3);
      expect(counter!.labels['method=GET,status=2xx']).toBe(2);
      expect(counter!.labels['method=POST,status=2xx']).toBe(1);
    });

    it('increments by custom value', () => {
      incrementCounter('test_counter', {}, 5);
      const metrics = collectMetrics();
      const counter = metrics.counters.find(c => c.name === 'test_counter');
      expect(counter!.value).toBe(5);
    });
  });

  describe('recordHistogram', () => {
    it('records a histogram value', () => {
      recordHistogram('test_histogram', 100);
      const metrics = collectMetrics();
      const hist = metrics.histograms.find(h => h.name === 'test_histogram');
      expect(hist).toBeDefined();
      expect(hist!.count).toBe(1);
      expect(hist!.sum).toBe(100);
    });

    it('records multiple histogram values', () => {
      recordHistogram('test_histogram', 100);
      recordHistogram('test_histogram', 200);
      recordHistogram('test_histogram', 300);
      const metrics = collectMetrics();
      const hist = metrics.histograms.find(h => h.name === 'test_histogram');
      expect(hist!.count).toBe(3);
      expect(hist!.sum).toBe(600);
    });

    it('distributes values into buckets', () => {
      recordHistogram('test_histogram', 5, [10, 50, 100]);
      recordHistogram('test_histogram', 25, [10, 50, 100]);
      recordHistogram('test_histogram', 75, [10, 50, 100]);
      const metrics = collectMetrics();
      const hist = metrics.histograms.find(h => h.name === 'test_histogram');
      expect(hist!.buckets[10]).toBe(1);  // 5 <= 10
      expect(hist!.buckets[50]).toBe(2);  // 5, 25 <= 50
      expect(hist!.buckets[100]).toBe(3); // 5, 25, 75 <= 100
    });
  });

  describe('setGauge', () => {
    it('sets a gauge value', () => {
      setGauge('test_gauge', 42);
      const metrics = collectMetrics();
      const gauge = metrics.gauges.find(g => g.name === 'test_gauge');
      expect(gauge).toBeDefined();
      expect(gauge!.value).toBe(42);
    });

    it('overwrites gauge value', () => {
      setGauge('test_gauge', 42);
      setGauge('test_gauge', 100);
      const metrics = collectMetrics();
      const gauge = metrics.gauges.find(g => g.name === 'test_gauge');
      expect(gauge!.value).toBe(100);
    });
  });

  describe('METRICS constants', () => {
    it('defines all expected metric names', () => {
      expect(METRICS.HTTP_REQUESTS_TOTAL).toBe('pawtag_http_requests_total');
      expect(METRICS.HTTP_REQUEST_ERRORS_TOTAL).toBe('pawtag_http_request_errors_total');
      expect(METRICS.HTTP_REQUEST_DURATION_MS).toBe('pawtag_http_request_duration_ms');
      expect(METRICS.DB_OPERATIONS_TOTAL).toBe('pawtag_db_operations_total');
      expect(METRICS.INTEGRATION_CALLS_TOTAL).toBe('pawtag_integration_calls_total');
      expect(METRICS.JOB_EXECUTIONS_TOTAL).toBe('pawtag_job_executions_total');
      expect(METRICS.RATE_LIMIT_HITS_TOTAL).toBe('pawtag_rate_limit_hits_total');
    });
  });

  describe('resetMetrics', () => {
    it('clears all metrics', () => {
      incrementCounter('test_counter');
      recordHistogram('test_histogram', 100);
      setGauge('test_gauge', 42);

      resetMetrics();

      const metrics = collectMetrics();
      expect(metrics.counters).toHaveLength(0);
      expect(metrics.histograms).toHaveLength(0);
      expect(metrics.gauges).toHaveLength(0);
    });
  });
});
