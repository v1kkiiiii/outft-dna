// Find Similar: calls the find-similar-outfits Edge Function, which holds
// ANTHROPIC_API_KEY server-side and ranks the signed-in user's other traced
// outfits by style similarity (SECURITY.md R-01 — the key never ships to
// the app). Best-effort: any failure returns an empty result, never throws.
import { supabase } from './supabase';

export interface SimilarMatch {
  outfitId: string;
  score: number;
  why: string;
}

export interface SimilarResult {
  ok: boolean;
  matches: SimilarMatch[];
}

export async function findSimilarOutfits(outfitId: string, limit = 3): Promise<SimilarResult> {
  try {
    if (!supabase) return { ok: false, matches: [] };
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return { ok: false, matches: [] };

    const { data, error } = await supabase.functions.invoke('find-similar-outfits', {
      body: { outfitId, limit },
    });
    if (error || !data?.ok || !Array.isArray(data.matches)) return { ok: false, matches: [] };

    return {
      ok: true,
      matches: data.matches.filter(
        (m: unknown): m is SimilarMatch =>
          !!m && typeof (m as SimilarMatch).outfitId === 'string' && typeof (m as SimilarMatch).why === 'string',
      ),
    };
  } catch {
    return { ok: false, matches: [] };
  }
}
