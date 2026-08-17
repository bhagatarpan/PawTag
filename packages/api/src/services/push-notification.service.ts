import { PushToken } from '@pawtag/db';
import logger from '../lib/logger';
import { logIntegration } from '../lib/timing';

// Firebase Admin SDK — loaded dynamically when configured
let firebaseInitialized = false;
let firebaseMessaging: any = null;

async function getFirebaseMessaging() {
  if (firebaseInitialized) return firebaseMessaging;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    logger.info('[PushService] Firebase not configured — running in demo mode');
    firebaseInitialized = true;
    return null;
  }

  try {
    const admin = await import('firebase-admin' as string);
    if (!(admin as any).apps.length) {
      (admin as any).initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    }
    firebaseMessaging = (admin as any).messaging();
    firebaseInitialized = true;
    logger.info('[PushService] Firebase initialized successfully');
    return firebaseMessaging;
  } catch (error) {
    logger.error({ err: error }, '[PushService] Failed to initialize Firebase');
    firebaseInitialized = true;
    return null;
  }
}

export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'web' | 'ios' | 'android',
): Promise<void> {
  await PushToken.findOneAndUpdate(
    { token },
    { userId, token, platform, isActive: true, lastUsedAt: new Date() },
    { upsert: true, new: true },
  );
}

export async function removePushToken(token: string): Promise<void> {
  await PushToken.findOneAndUpdate({ token }, { isActive: false });
}

export async function getUserPushTokens(userId: string): Promise<Array<{ token: string; platform: string }>> {
  const tokens = await PushToken.find({ userId, isActive: true }).lean();
  return tokens.map(t => ({ token: t.token, platform: t.platform }));
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ sent: number; failed: number }> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    // Demo mode — log to console
    logger.info({ userId, title, tokenCount: tokens.length }, '[PushService] DEMO PUSH');
    return { sent: tokens.length, failed: 0 };
  }

  return logIntegration('Firebase', 'sendPush', async () => {
    let sent = 0;
    let failed = 0;

    for (const { token } of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: data || {},
        });
        sent++;
      } catch (error: any) {
        logger.error({ err: error, token: token.substring(0, 20) }, '[PushService] Failed to send to token');
        // Remove invalid tokens
        if (error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token') {
          await PushToken.findOneAndUpdate({ token }, { isActive: false });
        }
        failed++;
      }
    }

    return { sent, failed };
  }, { userId, title, tokenCount: tokens.length });
}

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, title, body, data);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}
