import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config';

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
  let normalized = phone.replace(/[\s\-()]/g, '');
  if (normalized.startsWith('00')) normalized = '+' + normalized.slice(2);
  if (normalized.startsWith('0') && !normalized.startsWith('+')) {
    normalized = '+64' + normalized.slice(1);
  }
  if (!normalized.startsWith('+')) normalized = '+' + normalized;
  return normalized;
}
