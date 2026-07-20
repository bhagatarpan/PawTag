import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  dbUrl: process.env.DB_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  emailTokenExpiryHours: parseInt(process.env.EMAIL_TOKEN_EXPIRY_HOURS || '24', 10),
  maxOtpAttempts: parseInt(process.env.MAX_OTP_ATTEMPTS || '5', 10),
  maxResendCount: parseInt(process.env.MAX_RESEND_COUNT || '3', 10),
  resendCooldownSeconds: parseInt(process.env.RESEND_COOLDOWN_SECONDS || '60', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  smsProvider: process.env.SMS_PROVIDER || 'demo',
};
