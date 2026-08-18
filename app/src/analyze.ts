// Direct, synchronous Style DNA analysis — the same shape the marketing
// site's /api/analyze route uses: POST an image, get the reading straight
// back. No sign-in, no storage upload, no job queue, no polling.
//
// This replaces an older implementation that called api.anthropic.com from
// the device using EXPO_PUBLIC_ANTHROPIC_API_KEY. That key is deliberately
// never set (shipping a provider key in a mobile bundle is SECURITY.md
// blocker R-01), so that path always fell through to the canned mock in
// data.ts — which is why captures kept returning the same handful of
// generic labels. The prompt and the 478-label taxonomy now live server-side
// in supabase/functions/analyze-image, so the key stays server-only and the
// app no longer carries a duplicate copy of the prompt.
//
// The queued pipeline in lib/outfitApi.ts is still the path of record for
// signed-in users (it persists an immutable style_analyses row and feeds
// Style DNA). This is what shows the user their result immediately, and what
// makes guest/demo captures real instead of canned.
import { AnalysisResult, analyzeOutfit as mockAnalyze } from './data';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface AnalyzeInput {
  uri: string;
  base64?: string | null;
  mediaType?: string;
}

export interface AnalyzeOutcome {
  result: AnalysisResult;
  /** True when this is the canned local pool, not a real model reading. The
   *  UI must label it as demo — PRD §5: never present fake AI silently. */
  isMock: boolean;
}

/**
 * Analyzes an outfit photo. Falls back to the labelled local mock only if the
 * backend is unreachable or unconfigured, so the capture flow always
 * completes rather than dead-ending.
 */
export async function analyzeOutfitReal(input: AnalyzeInput): Promise<AnalyzeOutcome> {
  if (!SUPABASE_URL || !input.base64) {
    return { result: await mockAnalyze(input.uri), isMock: true };
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-image`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // analyze-image runs with verify_jwt disabled so guest captures work;
        // the anon/publishable key is still sent for normal project routing.
        ...(SUPABASE_KEY ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      },
      body: JSON.stringify({
        imageBase64: input.base64,
        mediaType: input.mediaType ?? 'image/jpeg',
      }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error ?? `analyze-image ${res.status}`);
    if (!Array.isArray(payload.aesthetics) || !Array.isArray(payload.tags) || typeof payload.insight !== 'string') {
      throw new Error('incomplete result');
    }
    return { result: payload as AnalysisResult, isMock: false };
  } catch (e) {
    console.warn('outft: analyze-image failed, using mock:', e);
    return { result: await mockAnalyze(input.uri), isMock: true };
  }
}
