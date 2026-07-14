// Supabase client for the OUTFT app. Auth tokens are kept in the platform
// secure store (SECURITY.md: never plain AsyncStorage for sessions).
// If the env vars are missing, `supabase` is null and every feature falls
// back to the existing local/demo behavior — the app never hard-crashes
// because the backend isn't configured yet.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const secureStorage = {
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
