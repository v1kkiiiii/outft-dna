// Daily trace reminders — three gentle local notifications at the app's
// posting windows. Everything is fail-soft: Expo Go has limited notification
// support, so any failure degrades silently and the toggle just won't stick.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const WINDOWS = [
  { hour: 9, minute: 0, body: 'morning window is open — trace today’s fit' },
  { hour: 14, minute: 0, body: 'afternoon light. worth a trace.' },
  { hour: 19, minute: 0, body: 'your streak is alive. keep it.' },
];

// Enables the three daily reminders. Returns true when permission was granted
// and scheduling succeeded; false otherwise (denied, or unsupported here).
export async function enableReminders(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return false;

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('daily-trace', {
          name: 'daily trace reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      } catch {}
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const w of WINDOWS) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'outft.', body: w.body, sound: false },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: w.hour,
          minute: w.minute,
          ...(Platform.OS === 'android' ? { channelId: 'daily-trace' } : {}),
        },
      });
    }
    return true;
  } catch (e) {
    // Expo Go or an unsupported platform — degrade silently.
    console.warn('outft: reminders unavailable:', e);
    return false;
  }
}

export async function disableReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}
