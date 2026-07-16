// Server pipeline for outfit capture: upload to Supabase storage, enqueue
// analysis, and poll until the worker writes a style_analyses row.
// Every function resolves to a result object — never throws.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { AnalysisResult } from '../data';

export interface UploadInput {
  uri: string;
  base64?: string | null;
  mediaType?: string;
  category: string;
}

export type UploadResult =
  | { ok: true; outfitId: string }
  | { ok: false; error: string };

export type PollResult =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: string; retryable?: boolean };

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Decode base64 → ArrayBuffer. Prefers global atob (Hermes has it); manual
// fallback keeps this dependency-free.
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const clean = b64.replace(/[\r\n=]+/g, '');
  if (typeof atob === 'function') {
    const bin = atob(clean.length % 4 === 0 ? clean : clean + '='.repeat(4 - (clean.length % 4)));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64_CHARS.indexOf(clean[i]);
    const b = B64_CHARS.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64_CHARS.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64_CHARS.indexOf(clean[i + 3]) : -1;
    bytes[p++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.buffer.slice(0, p) as ArrayBuffer;
}

function newUuid(): string {
  // crypto.randomUUID exists in Hermes (RN 0.81) and expo-crypto polyfills it.
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC4122 v4 from getRandomValues; last resort inside a catch-all module.
  const buf = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(buf);
  else throw new Error('no secure RNG available');
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const h = Array.from(buf, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function uploadAndAnalyze(input: UploadInput): Promise<UploadResult> {
  try {
    if (!supabase) return { ok: false, error: 'BACKEND_UNAVAILABLE' };

    // Get the image bytes. Prefer the camera's base64; if it's missing
    // (expo-camera sometimes omits it), read the file from disk instead.
    let b64 = input.base64;
    if (!b64) {
      try {
        b64 = await FileSystem.readAsStringAsync(input.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (e) {
        return { ok: false, error: 'NO_IMAGE_DATA: ' + (e instanceof Error ? e.message : String(e)) };
      }
    }
    if (!b64) return { ok: false, error: 'NO_IMAGE_DATA' };

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (sessionError || !session?.user?.id) return { ok: false, error: 'AUTH_REQUIRED' };
    const userId = session.user.id;

    const idempotencyKey = newUuid();
    const objectPath = `${userId}/${idempotencyKey}.jpg`;

    const bytes = base64ToArrayBuffer(b64);
    const { error: uploadError } = await supabase.storage
      .from('outfits')
      .upload(objectPath, bytes, { contentType: input.mediaType ?? 'image/jpeg', upsert: false });
    if (uploadError) return { ok: false, error: `UPLOAD_FAILED: ${uploadError.message}` };

    const nowIso = new Date().toISOString();
    const { data: outfit, error: outfitError } = await supabase
      .from('outfits')
      .insert({
        owner_id: userId,
        client_idempotency_key: idempotencyKey,
        category: input.category,
        captured_at: nowIso,
        status: 'analysis_queued',
        original_object_path: objectPath,
      })
      .select('id')
      .single();
    if (outfitError || !outfit?.id) {
      return { ok: false, error: `OUTFIT_INSERT_FAILED: ${outfitError?.message ?? 'no id returned'}` };
    }

    const { error: jobError } = await supabase.from('analysis_jobs').insert({
      outfit_id: outfit.id,
      owner_id: userId,
      status: 'queued',
      queued_at: nowIso,
    });
    if (jobError) return { ok: false, error: `JOB_INSERT_FAILED: ${jobError.message}` };

    return { ok: true, outfitId: outfit.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function mapAnalysisRow(row: { insight?: string | null; scores?: unknown; traits?: unknown }): AnalysisResult {
  const scores = row.scores && typeof row.scores === 'object' && !Array.isArray(row.scores)
    ? (row.scores as Record<string, unknown>)
    : {};
  const aesthetics = Object.entries(scores)
    .map(([label, pct]) => ({ label, pct: typeof pct === 'number' ? Math.round(pct) : Number(pct) || 0 }))
    .sort((a, b) => b.pct - a.pct);
  const tags = Array.isArray(row.traits) ? (row.traits as unknown[]).map((t) => String(t)) : [];
  return {
    insight: typeof row.insight === 'string' && row.insight ? row.insight : 'Style analysis complete.',
    aesthetics,
    tags,
  };
}

export async function pollAnalysis(
  outfitId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<PollResult> {
  const { timeoutMs = 90000, intervalMs = 2500 } = opts;
  try {
    if (!supabase) return { ok: false, error: 'BACKEND_UNAVAILABLE', retryable: false };
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const { data: outfit, error } = await supabase
        .from('outfits')
        .select('status')
        .eq('id', outfitId)
        .single();
      if (error) return { ok: false, error: `POLL_FAILED: ${error.message}`, retryable: true };

      if (outfit?.status === 'ready') {
        const { data: analysis, error: aError } = await supabase
          .from('style_analyses')
          .select('insight, scores, traits')
          .eq('outfit_id', outfitId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (aError || !analysis) {
          return { ok: false, error: `ANALYSIS_FETCH_FAILED: ${aError?.message ?? 'no row'}`, retryable: true };
        }
        return { ok: true, result: mapAnalysisRow(analysis) };
      }
      if (typeof outfit?.status === 'string' && outfit.status.includes('failed')) {
        return {
          ok: false,
          error: `ANALYSIS_${outfit.status.toUpperCase()}`,
          retryable: !outfit.status.includes('terminal'),
        };
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return { ok: false, error: 'ANALYSIS_TIMEOUT', retryable: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), retryable: true };
  }
}
