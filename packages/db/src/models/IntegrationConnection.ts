/**
 * @module IntegrationConnection Model
 * @description Stores third-party integration credentials and OAuth tokens.
 *
 * Used for external services that require persistent authentication, such as:
 * - Xero (accounting)
 * - MYOB (accounting) — planned
 * - QuickBooks (accounting) — planned
 * - Other future OAuth-based integrations
 *
 * Tokens are encrypted at rest using a reversible encryption scheme.
 * The encryption key is derived from `process.env.JWT_SECRET`.
 *
 * Each row represents a connection to a single organisation/tenant for a
 * single provider. Multiple organisations can be connected by adding rows.
 *
 * @example
 * ```typescript
 * await IntegrationConnection.create({
 *   provider: 'xero',
 *   tenantId: 'xero-tenant-uuid',
 *   tenantName: 'PawTag NZ Ltd',
 *   accessToken: encrypted,
 *   refreshToken: encrypted,
 *   expiresAt: new Date(Date.now() + 1800_000),
 *   scopes: ['accounting.transactions', 'offline_access'],
 *   connectedBy: user._id,
 * });
 * ```
 */

import mongoose, { Schema, Document } from 'mongoose';

export type IntegrationProvider = 'xero' | 'myob' | 'quickbooks' | 'other';

export interface IIntegrationConnectionDocument extends Document {
  provider: IntegrationProvider;
  /** External tenant/organisation identifier (e.g. Xero tenantId) */
  tenantId: string;
  /** Human-readable tenant name (e.g. "PawTag NZ Ltd") */
  tenantName?: string;
  /** Encrypted OAuth access token */
  accessToken: string;
  /** Encrypted OAuth refresh token */
  refreshToken: string;
  /** When the access token expires */
  expiresAt: Date;
  /** Granted OAuth scopes */
  scopes: string[];
  /** Provider-specific metadata (region, currency, orgId, etc.) */
  metadata?: Record<string, unknown>;
  /** User who connected the integration */
  connectedBy: mongoose.Types.ObjectId;
  connectedAt: Date;
  /** Last successful API call using this connection */
  lastSyncedAt?: Date;
  /** If connection is broken (e.g. token revoked) */
  status: 'active' | 'expired' | 'revoked' | 'error';
  /** Last error message if status is 'error' or 'expired' */
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationConnectionSchema = new Schema<IIntegrationConnectionDocument>(
  {
    provider: {
      type: String,
      enum: ['xero', 'myob', 'quickbooks', 'other'],
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    tenantName: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scopes: [{ type: String }],
    metadata: { type: Schema.Types.Mixed },
    connectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    connectedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked', 'error'],
      default: 'active',
      index: true,
    },
    lastError: { type: String },
  },
  { timestamps: true },
);

IntegrationConnectionSchema.index({ provider: 1, tenantId: 1 }, { unique: true });
IntegrationConnectionSchema.index({ status: 1, expiresAt: 1 });

export const IntegrationConnection = mongoose.model<IIntegrationConnectionDocument>(
  'IntegrationConnection',
  IntegrationConnectionSchema,
);
