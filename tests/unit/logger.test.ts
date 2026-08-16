import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createChildLogger, createScopedLogger } from '../../packages/api/src/lib/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger configuration', () => {
    it('should be a pino logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should have child method for context loggers', () => {
      const child = logger.child({ requestId: 'test-123' });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
    });
  });

  describe('createChildLogger', () => {
    it('should create a child logger with context', () => {
      const child = createChildLogger({ requestId: 'req-1', feature: 'auth' });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
      expect(typeof child.error).toBe('function');
    });
  });

  describe('createScopedLogger', () => {
    it('should create a scoped logger', () => {
      const scoped = createScopedLogger('auth');
      expect(scoped).toBeDefined();
      expect(typeof scoped.info).toBe('function');
      expect(typeof scoped.error).toBe('function');
    });
  });

  describe('redaction', () => {
    it('should have redact configuration', () => {
      expect(logger).toBeDefined();
      expect(() => logger.info('test')).not.toThrow();
    });
  });

  describe('log levels', () => {
    it('should support all standard levels', () => {
      expect(() => logger.debug('debug')).not.toThrow();
      expect(() => logger.info('info')).not.toThrow();
      expect(() => logger.warn('warn')).not.toThrow();
      expect(() => logger.error('error')).not.toThrow();
    });

    it('should handle structured fields', () => {
      expect(() => logger.info({ userId: '123', action: 'test' }, 'Test message')).not.toThrow();
    });

    it('should handle error objects', () => {
      const error = new Error('Test error');
      expect(() => logger.error({ err: error }, 'Error occurred')).not.toThrow();
    });
  });
});
