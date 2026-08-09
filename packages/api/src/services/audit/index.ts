export { auditService, isSensitiveField, deepRedact, computeHash, redactValue } from './audit.service';
export { verifyHashChain } from './audit.service';
export { createAuditTransaction, withAuditTransaction, createAuditContextFromRequest, extractAuditContext } from './audit.transaction';
export { enforceRetention, getRetentionStats, placeLegalHold, removeLegalHold, calculateRetentionDates, DEFAULT_RETENTION_POLICIES } from './audit.retention';
export type { AuditContext, AuditEventInput } from './audit.service';
export type { RetentionPolicy } from './audit.retention';