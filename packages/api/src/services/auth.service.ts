import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config';
import { RefreshToken } from '@pawtag/db';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: string; email: string; role: string }): string {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as any };
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, options);
}

export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

export async function storeRefreshToken(userId: string, tokenHash: string, deviceInfo?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
    deviceInfo,
  });
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = hashToken(token);
  const stored = await RefreshToken.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!stored) return null;

  return { userId: stored.userId.toString(), tokenId: stored._id.toString() };
}

export async function rotateRefreshToken(oldToken: string, deviceInfo?: string): Promise<{ token: string; tokenHash: string } | null> {
  const tokenHash = hashToken(oldToken);
  const stored = await RefreshToken.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!stored) return null;

  stored.revokedAt = new Date();
  await stored.save();

  const newTokens = generateRefreshToken();
  await storeRefreshToken(stored.userId.toString(), newTokens.tokenHash, deviceInfo);

  return newTokens;
}

export async function revokeRefreshToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { revokedAt: new Date() }
  );
  return result.modifiedCount > 0;
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getOtpExpiryMinutes(): number {
  return config.otpExpiryMinutes;
}

export function getEmailTokenExpiryHours(): number {
  return config.emailTokenExpiryHours;
}

export function getMaxOtpAttempts(): number {
  return config.maxOtpAttempts;
}

export function getMaxResendCount(): number {
  return config.maxResendCount;
}

export function getResendCooldownSeconds(): number {
  return config.resendCooldownSeconds;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-().]/g, '');

  if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2);

  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = '+64' + normalized.slice(1);
    } else {
      normalized = '+' + normalized;
    }
  }

  return normalized;
}
