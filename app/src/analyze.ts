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
import { supabase } from './lib/supabase';

// The original Supabase project no longer resolves, so analysis goes to the
// Railway server's /api/analyze (same request/response shape). Override with
// EXPO_PUBLIC_ANALYZE_URL if the deployment moves.
const ANALYZE_URL =
  process.env.EXPO_PUBLIC_ANALYZE_URL ?? 'https://outft-dna-production.up.railway.app/api/analyze';

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

export type AnalyzeErrorCode = 'offline' | 'failed' | 'limit' | 'no_image';

export class AnalyzeError extends Error {
  constructor(public code: AnalyzeErrorCode, message: string) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Analyzes an outfit photo and throws an AnalyzeError instead of falling back
 * to the demo pool. Used by onboarding, which must show a real error and a
 * retry button rather than a fake read. Never logs the image.
 */
export async function analyzeOutfitStrict(input: AnalyzeInput): Promise<AnalysisResult> {
  if (!input.base64) throw new AnalyzeError('no_image', 'That photo could not be read. Try another one.');
  let res: Response;
  // A stuck request should become a retry button, not an endless spinner.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    res = await fetch(ANALYZE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ imageBase64: input.base64, mediaType: input.mediaType ?? 'image/jpeg' }),
      signal: ctrl.signal,
    });
  } catch {
    clearTimeout(timer);
    if (ctrl.signal.aborted) throw new AnalyzeError('failed', 'That took too long. Try again.');
    throw new AnalyzeError('offline', 'You look offline. Check your connection and try again.');
  }
  clearTimeout(timer);
  let payload: any = null;
  try { payload = await res.json(); } catch {}
  if (res.status === 402 || payload?.code === 'LIMIT_REACHED') {
    throw new AnalyzeError('limit', 'You have used your free analyses for now.');
  }
  if (!res.ok || !payload || !Array.isArray(payload.aesthetics) || !Array.isArray(payload.tags) || typeof payload.insight !== 'string') {
    throw new AnalyzeError('failed', 'We could not read this outfit. Try again.');
  }
  return payload as AnalysisResult;
}

/**
 * Analyzes an outfit photo. Falls back to the labelled local mock only if the
 * backend is unreachable or unconfigured, so the capture flow always
 * completes rather than dead-ending. A free-tier limit is rethrown so the
 * caller can show the paywall.
 */
export async function analyzeOutfitReal(input: AnalyzeInput): Promise<AnalyzeOutcome> {
  try {
    return { result: await analyzeOutfitStrict(input), isMock: false };
  } catch (e) {
    if (e instanceof AnalyzeError && e.code === 'limit') throw e;
    console.warn('outft: analysis failed, using demo read:', e instanceof AnalyzeError ? e.code : 'error');
    return { result: await mockAnalyze(input.uri), isMock: true };
  }
}
