import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from './setup';
import app from '../../packages/api/src/index';
import { RefreshToken, VerificationToken } from '@pawtag/db';
import { hashToken, generateToken } from '../../packages/api/src/services/auth.service';

async function createVerifiedUser(overrides: Partial<{ email: string; password: string; fullName: string; phoneNumber: string }> = {}) {
  const email = overrides.email || 'session-test@example.com';
  const password = overrides.password || 'Password123!';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await mongoose.connection.collections.users.insertOne({
    email,
    passwordHash,
    fullName: overrides.fullName || 'Session Test User',
    phoneNumber: overrides.phoneNumber || '+64210000001',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userId = user.insertedId.toString();
  const token = generateToken({ id: userId, email, role: 'customer' });

  return { userId, token, email };
}

async function loginAs(email: string, password: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .set('x-client-platform', 'ios') // Non-browser: get refresh token in body
    .send({ email, password });
  return {
    status: res.status,
    token: res.body.data?.token,
    refreshToken: res.body.data?.refreshToken,
  };
}

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
}, 10000);

beforeEach(async () => {
  await clearDb();
});

describe('Integration: Session Invalidation Matrix', () => {
  describe('POST /api/auth/change-password — invalidates other sessions', () => {
    it('revokes all refresh tokens after password change', async () => {
      const email = 'change-pw-inv@example.com';
      const oldPassword = 'OldPassword1!';
      const newPassword = 'NewPassword1!';

      await createVerifiedUser({ email, password: oldPassword });

      // Simulate two login sessions (two refresh tokens)
      const login1 = await loginAs(email, oldPassword);
      const login2 = await loginAs(email, oldPassword);
      expect(login1.refreshToken).toBeDefined();
      expect(login2.refreshToken).toBeDefined();

      // At least 2 unrevoked tokens exist before the change
      const allUnrevoked = await RefreshToken.countDocuments({ revokedAt: null });
      expect(allUnrevoked).toBeGreaterThanOrEqual(2);

      // Change password using the first session's access token
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${login1.token}`)
        .send({ currentPassword: oldPassword, newPassword });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // ALL refresh tokens should now be revoked
      const postChangeUnrevoked = await RefreshToken.countDocuments({ revokedAt: null });
      expect(postChangeUnrevoked).toBe(0);

      // Attempting to refresh with either old token should fail
      const refresh1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login1.refreshToken });
      expect(refresh1.status).toBe(401);

      const refresh2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login2.refreshToken });
      expect(refresh2.status).toBe(401);

      // Login with old password should fail
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: oldPassword });
      expect(oldLogin.status).toBe(401);

      // Login with new password should succeed
      const newLogin = await request(app)
        .post('/api/auth/login')
        .set('x-client-platform', 'ios') // Non-browser: get refresh token in body
        .send({ email, password: newPassword });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.token).toBeDefined();
      expect(newLogin.body.data.refreshToken).toBeDefined();
    });

    it('does not revoke tokens for other users', async () => {
      const user1 = await createVerifiedUser({
        email: 'user1-session@example.com',
        password: 'User1Pass1!',
      });
      const user2 = await createVerifiedUser({
        email: 'user2-session@example.com',
        password: 'User2Pass1!',
      });

      // Both users log in
      const login1 = await loginAs(user1.email, 'User1Pass1!');
      const login2 = await loginAs(user2.email, 'User2Pass1!');

      // User1 changes password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${login1.token}`)
        .send({ currentPassword: 'User1Pass1!', newPassword: 'User1NewPass1!' });

      // User2's refresh token should still work
      const refresh2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login2.refreshToken });
      expect(refresh2.status).toBe(200);
      expect(refresh2.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/auth/reset-password — invalidates all sessions', () => {
    it('revokes all refresh tokens after password reset', async () => {
      const email = 'reset-pw-inv@example.com';
      const oldPassword = 'OldPassword1!';

      await createVerifiedUser({ email, password: oldPassword });

      // Simulate two login sessions
      const login1 = await loginAs(email, oldPassword);
      const login2 = await loginAs(email, oldPassword);
      expect(login1.refreshToken).toBeDefined();
      expect(login2.refreshToken).toBeDefined();

      // Request a password reset (to follow the real flow)
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email });

      // We can't recover the original token from its hash, so insert a known one
      const knownResetToken = crypto.randomBytes(32).toString('hex');
      const knownResetTokenHash = hashToken(knownResetToken);

      const user = await mongoose.connection.collections.users.findOne({ email });
      await VerificationToken.deleteMany({ userId: user?._id, type: 'password_reset' });
      await VerificationToken.create({
        userId: user?._id,
        type: 'password_reset',
        tokenHash: knownResetTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      });

      // Verify tokens are unrevoked before reset
      const preResetUnrevoked = await RefreshToken.countDocuments({ revokedAt: null });
      expect(preResetUnrevoked).toBeGreaterThanOrEqual(2);

      // Reset password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: knownResetToken, newPassword: 'ResetPassword1!' });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // ALL refresh tokens should be revoked
      const postResetUnrevoked = await RefreshToken.countDocuments({ revokedAt: null });
      expect(postResetUnrevoked).toBe(0);

      // Both old refresh tokens should fail
      const refresh1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login1.refreshToken });
      expect(refresh1.status).toBe(401);

      const refresh2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login2.refreshToken });
      expect(refresh2.status).toBe(401);

      // Login with old password should fail
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: oldPassword });
      expect(oldLogin.status).toBe(401);

      // Login with new reset password should succeed
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'ResetPassword1!' });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.data.token).toBeDefined();
    });

    it('does not revoke tokens for other users during reset', async () => {
      const user1 = await createVerifiedUser({
        email: 'reset-user1@example.com',
        password: 'ResetUser1Pass!',
      });
      const user2 = await createVerifiedUser({
        email: 'reset-user2@example.com',
        password: 'ResetUser2Pass!',
      });

      // Both users log in
      const login1 = await loginAs(user1.email, 'ResetUser1Pass!');
      const login2 = await loginAs(user2.email, 'ResetUser2Pass!');

      // User1 requests password reset
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user1.email });

      // Create a known reset token for user1
      const knownResetToken = crypto.randomBytes(32).toString('hex');
      const knownResetTokenHash = hashToken(knownResetToken);
      await VerificationToken.deleteMany({ userId: new mongoose.Types.ObjectId(user1.userId), type: 'password_reset' });
      await VerificationToken.create({
        userId: new mongoose.Types.ObjectId(user1.userId),
        type: 'password_reset',
        tokenHash: knownResetTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      });

      // User1 resets password
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: knownResetToken, newPassword: 'ResetUser1NewPass!' });

      // User2's refresh token should still work
      const refresh2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: login2.refreshToken });
      expect(refresh2.status).toBe(200);
    });
  });
});
