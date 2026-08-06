import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';
import api from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Notifications Disabled',
        'Push notifications are disabled. You won\'t receive alerts when your pet is found. Enable them in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const expoPushToken = tokenData.data;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    await api.post('/customer/push-tokens', {
      token: expoPushToken,
      platform,
    });

    return expoPushToken;
  } catch (error) {
    console.error('[PushNotifications] Failed to register:', error);
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const tokens = await api.get('/customer/push-tokens');
    for (const t of tokens.data.data) {
      await api.delete(`/customer/push-tokens/${encodeURIComponent(t.token)}`);
    }
  } catch (error) {
    console.error('[PushNotifications] Failed to unregister:', error);
  }
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
