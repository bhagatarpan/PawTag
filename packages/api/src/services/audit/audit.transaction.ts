import { AuditEvent, type IAuditEventDocument, type ActorType } from '@pawtag/db';
import mongoose from 'mongoose';
import { auditService, type AuditContext, type AuditEventInput } from './audit.service';
import { getAuditContext, type AuditRequest } from '../../middleware/audit';

export interface TransactionalAuditOptions {
  session?: mongoose.ClientSession;
  context: Partial<AuditContext>;
  event: AuditEventInput;
}

export class AuditTransaction {
  private session: mongoose.ClientSession | null;
  private events: Array<{ event: AuditEventInput; context: Partial<AuditContext> }> = [];
  private committed = false;

  constructor(session?: mongoose.ClientSession) {
    this.session = session || null;
  }

  add(event: AuditEventInput, context: Partial<AuditContext> = {}): this {
    this.events.push({ event, context });
    return this;
  }

  async commit(baseContext: AuditContext): Promise<IAuditEventDocument[]> {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    this.committed = true;

    const results: IAuditEventDocument[] = [];

    for (let i = 0; i < this.events.length; i++) {
      const { event, context } = this.events[i];
      const mergedContext: AuditContext = {
        ...baseContext,
        ...context,
        transactionId: context.transactionId ?? baseContext.transactionId,
        correlationId: context.correlationId ?? baseContext.correlationId,
        requestId: context.requestId ?? baseContext.requestId,
        traceId: context.traceId ?? baseContext.traceId,
        parentEventId: i === 0 ? baseContext.parentEventId : results[i - 1].auditEventId,
        eventSequenceNumber: i,
      };

      const auditEvent = await auditService.log(mergedContext, event);
      if (auditEvent) results.push(auditEvent);
    }

    return results;
  }

  async rollback(): Promise<void> {
    this.events = [];
    this.committed = true;
  }
}

export function createAuditTransaction(session?: mongoose.ClientSession): AuditTransaction {
  return new AuditTransaction(session);
}

export async function withAuditTransaction<T>(
  callback: (tx: AuditTransaction) => Promise<T>,
  baseContext: AuditContext,
  session?: mongoose.ClientSession,
): Promise<{ result: T; auditEvents: IAuditEventDocument[] }> {
  const tx = new AuditTransaction(session);
  try {
    const result = await callback(tx);
    const auditEvents = await tx.commit(baseContext);
    return { result, auditEvents };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export function createAuditContextFromRequest(req: AuditRequest, overrides: Partial<AuditContext> = {}): AuditContext {
  const reqContext = req.auditContext as AuditContext;
  if (!reqContext) {
    throw new Error('Audit middleware not applied - request has no audit context');
  }
  const actorType = (overrides.actorType || reqContext.actorType) as ActorType;
  return {
    ...reqContext,
    ...overrides,
    actorType,
  };
}

export function extractAuditContext(req: AuditRequest): AuditContext | null {
  const context = req.auditContext;
  if (!context) return null;
  return {
    ...context,
    actorType: context.actorType as ActorType,
  };
}
