import dotenv from 'dotenv';
import { validateEnv } from './config/validateEnv';

dotenv.config();
validateEnv();

const parseAllowedOrigins = (): string[] => {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ALLOWED_ORIGINS environment variable is required in production');
  }

  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3003',
  ];
};

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  dbUrl: process.env.DB_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m',
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '30', 10),
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  emailTokenExpiryHours: parseInt(process.env.EMAIL_TOKEN_EXPIRY_HOURS || '24', 10),
  maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '5', 10),
  maxResendCount: parseInt(process.env.MAX_RESEND_COUNT || '3', 10),
  resendCooldownSeconds: parseInt(process.env.RESEND_COOLDOWN_SECONDS || '60', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  smsProvider: process.env.SMS_PROVIDER || 'demo',
  allowedOrigins: parseAllowedOrigins(),
};
