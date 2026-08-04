import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { RefreshToken } from '@pawtag/db';
import {
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  hashToken,
  generateSecureToken,
} from '../../packages/api/src/services/auth.service';

let mongoServer: MongoMemoryServer;

beforeEach(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Refresh Token Service', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  describe('generateRefreshToken', () => {
    it('should generate a token and its hash', () => {
      const result = generateRefreshToken();
      expect(result.token).toBeDefined();
      expect(result.tokenHash).toBeDefined();
      expect(result.token.length).toBe(64);
      expect(result.tokenHash.length).toBe(64);
    });

    it('should generate unique tokens', () => {
      const t1 = generateRefreshToken();
      const t2 = generateRefreshToken();
      expect(t1.token).not.toBe(t2.token);
    });
  });

  describe('storeRefreshToken', () => {
    it('should store a refresh token in the database', async () => {
      const { tokenHash } = generateRefreshToken();
      await storeRefreshToken(userId, tokenHash);

      const stored = await RefreshToken.findOne({ tokenHash });
      expect(stored).toBeDefined();
      expect(stored!.userId.toString()).toBe(userId);
      expect(stored!.revokedAt).toBeNull();
      expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid stored token', async () => {
      const { token, tokenHash } = generateRefreshToken();
      await storeRefreshToken(userId, tokenHash);

      const result = await verifyRefreshToken(token);
      expect(result).toBeDefined();
      expect(result!.userId).toBe(userId);
    });

    it('should reject a non-existent token', async () => {
      const result = await verifyRefreshToken('nonexistent-token');
      expect(result).toBeNull();
    });

    it('should reject a revoked token', async () => {
      const { token, tokenHash } = generateRefreshToken();
      await storeRefreshToken(userId, tokenHash);
      await revokeRefreshToken(token);

      const result = await verifyRefreshToken(token);
      expect(result).toBeNull();
    });

    it('should reject an expired token', async () => {
      const { token, tokenHash } = generateRefreshToken();
      await RefreshToken.create({
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      const result = await verifyRefreshToken(token);
      expect(result).toBeNull();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should revoke old token and issue new one', async () => {
      const { token, tokenHash } = generateRefreshToken();
      await storeRefreshToken(userId, tokenHash);

      const newTokens = await rotateRefreshToken(token);
      expect(newTokens).toBeDefined();
      expect(newTokens!.token).not.toBe(token);

      const oldResult = await verifyRefreshToken(token);
      expect(oldResult).toBeNull();

      const newResult = await verifyRefreshToken(newTokens!.token);
      expect(newResult).toBeDefined();
    });

    it('should reject rotation of already-rotated token', async () => {
      const { token, tokenHash } = generateRefreshToken();
      await storeRefreshToken(userId, tokenHash);

      await rotateRefreshToken(token);
      const secondRotation = await rotateRefreshToken(token);
      expect(secondRotation).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a token', async () => {
      const { token, tokenHash } = generateRefreshToken();
      await storeRefreshToken(userId, tokenHash);

      const revoked = await revokeRefreshToken(token);
      expect(revoked).toBe(true);

      const stored = await RefreshToken.findOne({ tokenHash });
      expect(stored!.revokedAt).not.toBeNull();
    });

    it('should return false for non-existent token', async () => {
      const revoked = await revokeRefreshToken('nonexistent');
      expect(revoked).toBe(false);
    });
  });

  describe('revokeAllUserRefreshTokens', () => {
    it('should revoke all tokens for a user', async () => {
      const { tokenHash: h1 } = generateRefreshToken();
      const { tokenHash: h2 } = generateRefreshToken();
      await storeRefreshToken(userId, h1);
      await storeRefreshToken(userId, h2);

      await revokeAllUserRefreshTokens(userId);

      const tokens = await RefreshToken.find({ userId, revokedAt: null });
      expect(tokens.length).toBe(0);
    });
  });
});

describe('Token Security', () => {
  describe('generateSecureToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateSecureToken();
      expect(token.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('hashToken', () => {
    it('should produce a consistent SHA-256 hash', () => {
      const token = 'test-token-123';
      const h1 = hashToken(token);
      const h2 = hashToken(token);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64);
    });

    it('should produce different hashes for different inputs', () => {
      const h1 = hashToken('token-a');
      const h2 = hashToken('token-b');
      expect(h1).not.toBe(h2);
    });
  });
});
