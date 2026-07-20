// Fail-soft haptic helpers — haptics can throw on some devices/simulators,
// so every call is wrapped and errors are swallowed.
import * as Haptics from 'expo-haptics';

export function hapticTap() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch {}
}

export function hapticSelect() {
  try { Haptics.selectionAsync().catch(() => {}); } catch {}
}

export function hapticSuccess() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } catch {}
}
