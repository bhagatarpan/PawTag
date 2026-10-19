import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * SystemLogs persistence — the stored `error` field must survive BOTH
 * logging styles used across the codebase:
 *
 * - pino-serialized Error objects (name/message/stack)
 * - plain strings (integration adapters log provider error messages this
 *   way — e.g. the NZ Post shipping provider's "Client Credentials grant
 *   not enabled" message, which was silently dropped from SystemLogs and
 *   made every shipment failure undiagnosable from the admin UI)
 *
 * Note: flushSystemLogs() is the shutdown path — it permanently stops new
 * writes (isShuttingDown), so each test imports a fresh module instance.
 */

const insertManyMock = vi.fn();

vi.mock('@pawtag/db', () => ({
  SystemLog: { insertMany: (...args: any[]) => insertManyMock(...args) },
}));

vi.mock('../../packages/api/src/lib/system-log-settings', () => ({
  shouldStoreLog: vi.fn(async () => true),
  getRetentionDays: vi.fn(async () => 90),
}));

vi.mock('../../packages/api/src/lib/request-context', () => ({
  getRequestContext: vi.fn(() => null),
}));

async function freshLogWriter() {
  vi.resetModules();
  return import('../../packages/api/src/lib/log-writer');
}

describe('log-writer error persistence', () => {
  beforeEach(() => {
    insertManyMock.mockReset().mockResolvedValue([]);
  });

  it('keeps a plain-string err as the stored error message (integration adapter style)', async () => {
    const { writeLog, flushSystemLogs } = await freshLogWriter();

    writeLog({
      level: 50,
      time: Date.now(),
      msg: 'NZ Post ParcelLabel API failed — not falling back to demo tracking',
      provider: 'nz-shipping',
      err: 'NZ Post API failed: NZ Post OAuth error: Client Credentials grant type is not enabled on this API client.',
      orderNumber: 'WO-000511',
    });
    await flushSystemLogs();

    expect(insertManyMock).toHaveBeenCalledTimes(1);
    const doc = insertManyMock.mock.calls[0][0][0];
    expect(doc.error).toEqual({
      message: 'NZ Post API failed: NZ Post OAuth error: Client Credentials grant type is not enabled on this API client.',
    });
    // Provider-tagged entries classify as INTEGRATION for System Logs filtering
    expect(doc.category).toBe('INTEGRATION');
    // Non-error context still lands in metadata
    expect(doc.metadata).toEqual({ provider: 'nz-shipping', orderNumber: 'WO-000511' });
  });

  it('keeps the object form (name/message/stack) unchanged', async () => {
    const { writeLog, flushSystemLogs } = await freshLogWriter();

    writeLog({
      level: 50,
      time: Date.now(),
      msg: 'Boom',
      err: {
        name: 'TypeError',
        message: 'cannot read properties of undefined',
        stack: 'at somewhere',
        code: 'E_FAIL',
      },
    });
    await flushSystemLogs();

    const doc = insertManyMock.mock.calls[0][0][0];
    expect(doc.error).toEqual({
      name: 'TypeError',
      message: 'cannot read properties of undefined',
      code: 'E_FAIL',
      stack: 'at somewhere',
    });
  });

  it('stores no error field when err is absent', async () => {
    const { writeLog, flushSystemLogs } = await freshLogWriter();

    writeLog({ level: 30, time: Date.now(), msg: 'plain info' });
    await flushSystemLogs();

    const doc = insertManyMock.mock.calls[0][0][0];
    expect(doc.error).toBeUndefined();
    expect(doc.metadata).toBeUndefined();
  });
});
