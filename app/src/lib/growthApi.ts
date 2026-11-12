// Opt-in notification preferences and referral codes, stored in our own
// Supabase project. Fail-soft like the rest of lib/: { ok: false } on any
// problem, never a throw to the UI.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export interface NotifyPrefs {
  daily_reminder: boolean;
  wrapped_ready: boolean;
  twin_match: boolean;
}

async function userId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// Best-effort Expo push token. Returns null in Expo Go builds or when
// permission is not granted; email still works without it.
async function pushToken(): Promise<string | null> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return t.data ?? null;
  } catch {
    return null;
  }
}

export async function saveNotifyPrefs(prefs: NotifyPrefs, email: string): Promise<{ ok: boolean }> {
  const id = await userId();
  if (!supabase || !id) return { ok: false };
  try {
    const anyOn = prefs.daily_reminder || prefs.wrapped_ready || prefs.twin_match;
    const { error } = await supabase.from('notification_prefs').upsert({
      user_id: id,
      email: email || null,
      push_token: anyOn ? await pushToken() : null,
      ...prefs,
      // Turning anything back on clears an earlier unsubscribe.
      unsubscribed_at: anyOn ? null : undefined,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function myReferralCode(): Promise<string | null> {
  if (!supabase || !(await userId())) return null;
  try {
    const { data, error } = await supabase.rpc('my_referral_code');
    return error ? null : (data as string);
  } catch {
    return null;
  }
}

export async function redeemReferral(code: string): Promise<boolean> {
  if (!supabase || !(await userId())) return false;
  try {
    const { data, error } = await supabase.rpc('redeem_referral', { p_code: code });
    return !error && data === true;
  } catch {
    return false;
  }
}
