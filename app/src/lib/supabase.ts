// Supabase client for the OUTFT app. Auth tokens are kept in the platform
// secure store on native (SECURITY.md: never plain AsyncStorage for
// sessions) — expo-secure-store has no real native keychain on web, so web
// falls back to localStorage, the standard/only persistent option a browser
// offers (this is a platform limitation, not a downgrade of the native rule).
// If the env vars are missing, `supabase` is null and every feature falls
// back to the existing local/demo behavior — the app never hard-crashes
// because the backend isn't configured yet.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const webStorage = {
  getItem: async (key: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: async (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const secureStorage =
  Platform.OS === 'web'
    ? webStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: secureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function backendAvailable(): boolean {
  return supabase !== null;
}
