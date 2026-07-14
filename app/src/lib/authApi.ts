// Thin auth wrappers around the shared Supabase client. Every function
// degrades gracefully: if the client is null (env not configured) or the
// network call throws, we return { ok: false, error } — never throw to UI.
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthResult {
  ok: boolean;
  error?: string;
  userId?: string;
}

const OFFLINE = 'BACKEND_UNAVAILABLE';

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: OFFLINE };
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, userId: data.user?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'NETWORK_ERROR' };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: OFFLINE };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, userId: data.user?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'NETWORK_ERROR' };
  }
}

export async function signOutSupabase(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: OFFLINE };
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'NETWORK_ERROR' };
  }
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function upsertProfile(username: string, displayName: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: OFFLINE };
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (userErr || !userId) return { ok: false, error: 'AUTH_REQUIRED' };
    const { error } = await supabase.from('profiles').upsert(
      {
        user_id: userId,
        username: username.trim().toLowerCase(),
        display_name: displayName,
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      // 23505 = Postgres unique violation (username already taken)
      if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
        return { ok: false, error: 'USERNAME_TAKEN' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, userId };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'NETWORK_ERROR' };
  }
}
