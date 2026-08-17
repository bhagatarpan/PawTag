import { CmsSmsTemplate } from '@pawtag/db';
import logger from '../lib/logger';
import { logIntegration } from '../lib/timing';

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SMSProvider {
  send(to: string, message: string): Promise<SMSResult>;
}

class DemoSMSProvider implements SMSProvider {
  async send(to: string, message: string): Promise<SMSResult> {
    const otpMatch = message.match(/\b(\d{6})\b/);
    logger.debug({ to, messagePreview: message.substring(0, 50), otp: otpMatch?.[1] }, 'DEMO SMS — No SMS_PROVIDER set');
    return { success: true, messageId: `demo_sms_${Date.now()}` };
  }
}

class TwilioSMSProvider implements SMSProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';
  }

  async send(to: string, message: string): Promise<SMSResult> {
    return logIntegration('Twilio', 'sendSMS', async () => {
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const params = new URLSearchParams({
        To: to,
        From: this.fromNumber,
        Body: message,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        },
      );

      const data = await response.json() as { sid?: string; error_code?: string; error_message?: string };

      if (!response.ok) {
        logger.error({ to, errorCode: data.error_code, errorMessage: data.error_message }, 'Twilio SMS send failed');
        return { success: false, error: data.error_message || 'SMS send failed' };
      }

      return { success: true, messageId: data.sid };
    }, { to });
  }
}

function createSMSProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER || 'demo';
  switch (provider) {
    case 'twilio':
      return new TwilioSMSProvider();
    case 'demo':
    default:
      return new DemoSMSProvider();
  }
}

const smsProvider = createSMSProvider();

// ─── CMS Template Rendering ──────────────────────────────────────────

function replaceVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

function processConditionals(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, inner) => {
    return vars[key] ? inner : '';
  });
}

async function renderCmsSms(slug: string, variables: Record<string, string>): Promise<string | null> {
  try {
    const template = await CmsSmsTemplate.findOne({ slug, status: 'active', deletedAt: null });
    if (!template) return null;
    let msg = processConditionals(template.message, variables);
    msg = replaceVariables(msg, variables);
    return msg;
  } catch (err) {
    logger.error({ err, template: slug }, 'CMS SMS template fetch failed, using fallback');
    return null;
  }
}

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  return smsProvider.send(to, message);
}

export async function sendPhoneOtpSMS(phoneNumber: string, otp: string): Promise<SMSResult> {
  const cmsMsg = await renderCmsSms('phone-otp', { otp });
  const message = cmsMsg || `Your PawTag verification code is: ${otp}\n\nIt expires in 10 minutes. Do not share this code.`;
  return sendSMS(phoneNumber, message);
}
