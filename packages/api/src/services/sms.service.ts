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
    console.log('\n========================================');
    console.log('📱 [DEMO SMS]');
    console.log('========================================');
    console.log(`To:      ${to}`);
    console.log(`Message: ${message}`);
    console.log('========================================\n');
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
    try {
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
        console.error('SMS send failed:', data.error_message);
        return { success: false, error: data.error_message || 'SMS send failed' };
      }

      return { success: true, messageId: data.sid };
    } catch (error: any) {
      console.error('SMS send failed:', error.message);
      return { success: false, error: error.message };
    }
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

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  return smsProvider.send(to, message);
}

export async function sendPhoneOtpSMS(phoneNumber: string, otp: string): Promise<SMSResult> {
  const message = `Your PawTag verification code is: ${otp}\n\nIt expires in 10 minutes. Do not share this code.`;
  return sendSMS(phoneNumber, message);
}
