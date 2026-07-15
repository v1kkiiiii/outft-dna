// Account lifecycle wrappers (PRD Wave E / AC-P0-010): data export request
// and account deletion. Same contract as authApi: null-guarded against a
// missing backend, and never throws to the UI — always { ok, error? }.
import { supabase } from './supabase';

export interface AccountResult {
  ok: boolean;
  error?: string;
  requestId?: string;
}

const OFFLINE = 'BACKEND_UNAVAILABLE';

// Inserts a data_requests row (type 'export') for the signed-in user.
// A server job builds the export bundle and emails the user.
export async function requestExport(): Promise<AccountResult> {
  if (!supabase) return { ok: false, error: OFFLINE };
  try {
    const { data, error } = await supabase.rpc('request_account_export');
    if (error) return { ok: false, error: error.message };
    return { ok: true, requestId: typeof data === 'string' ? data : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'NETWORK_ERROR' };
  }
}

// Tombstones the user's outfits and records a deletion request; the final
// profile + auth-user purge runs in a resumable server job. The caller is
// responsible for signing out afterwards.
export async function deleteAccount(): Promise<AccountResult> {
  if (!supabase) return { ok: false, error: OFFLINE };
  try {
    const { data, error } = await supabase.rpc('delete_my_account');
    if (error) return { ok: false, error: error.message };
    return { ok: data === true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'NETWORK_ERROR' };
  }
}
