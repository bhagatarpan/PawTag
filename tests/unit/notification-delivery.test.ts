import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@pawtag/db', () => ({
  Notification: { create: vi.fn().mockResolvedValue({}) },
  User: { findById: vi.fn() },
  PushToken: { find: vi.fn() },
}));

vi.mock('../../packages/api/src/services/email.service', () => ({
  sendMail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../packages/api/src/services/push-notification.service', () => ({
  sendPushToUser: vi.fn().mockResolvedValue({}),
}));

import { createAndDeliverNotification } from '../../packages/api/src/services/notification-delivery.service';
import { Notification, User } from '@pawtag/db';
import { sendPushToUser } from '../../packages/api/src/services/push-notification.service';

const mockUser = vi.mocked(User);
const mockNotification = vi.mocked(Notification);
const mockSendPush = vi.mocked(sendPushToUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notification-delivery.service', () => {
  const defaultPrefs = {
    email: true,
    push: true,
    inApp: true,
    channels: { petFound: true, orderUpdate: true, subscriptionReminder: true, referral: true, marketing: false },
  };

  describe('createAndDeliverNotification', () => {
    it('creates in-app notification when inApp is enabled', async () => {
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: defaultPrefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'pet_found',
        title: 'Pet Found',
        message: 'Your pet was found!',
      });

      expect(mockNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          type: 'pet_found',
          title: 'Pet Found',
          message: 'Your pet was found!',
        })
      );
    });

    it('sends push notification when enabled', async () => {
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: defaultPrefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'pet_found',
        title: 'Pet Found',
        message: 'Your pet was found!',
        sendPush: true,
      });

      expect(mockSendPush).toHaveBeenCalled();
    });

    it('does not create notification when channel is disabled', async () => {
      const prefs = {
        ...defaultPrefs,
        channels: { ...defaultPrefs.channels, petFound: false },
      };
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: prefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'pet_found',
        title: 'Pet Found',
        message: 'Your pet was found!',
      });

      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('does not send push when push is disabled', async () => {
      const prefs = { ...defaultPrefs, push: false };
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: prefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'pet_found',
        title: 'Pet Found',
        message: 'Your pet was found!',
        sendPush: true,
      });

      expect(mockSendPush).not.toHaveBeenCalled();
    });

    it('does not create notification when inApp is disabled', async () => {
      const prefs = { ...defaultPrefs, inApp: false };
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: prefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'pet_found',
        title: 'Pet Found',
        message: 'Your pet was found!',
      });

      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('maps subscription_expiring to subscriptionReminder channel', async () => {
      const prefs = {
        ...defaultPrefs,
        channels: { ...defaultPrefs.channels, subscriptionReminder: false },
      };
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: prefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'subscription_expiring',
        title: 'Subscription Expiring',
        message: 'Your subscription is expiring soon!',
      });

      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('maps referral_reward to referral channel', async () => {
      const prefs = {
        ...defaultPrefs,
        channels: { ...defaultPrefs.channels, referral: false },
      };
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: prefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'referral_reward',
        title: 'Referral Reward',
        message: 'You earned a reward!',
      });

      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('maps order_status to orderUpdate channel', async () => {
      const prefs = {
        ...defaultPrefs,
        channels: { ...defaultPrefs.channels, orderUpdate: false },
      };
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: prefs,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'order_status',
        title: 'Order Update',
        message: 'Your order status changed!',
      });

      expect(mockNotification.create).not.toHaveBeenCalled();
    });

    it('uses default prefs when user has no notificationPreferences', async () => {
      mockUser.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          email: 'user@test.com',
          notificationPreferences: null,
        }),
      } as any);

      await createAndDeliverNotification({
        userId: 'user1',
        type: 'pet_found',
        title: 'Pet Found',
        message: 'Your pet was found!',
      });

      expect(mockNotification.create).toHaveBeenCalled();
    });
  });
});
