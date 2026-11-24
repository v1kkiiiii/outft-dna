// Cloud history and account deletion for the outft. server.
//
// saveAnalysis: when a signed-in user analyses a photo, store the photo in the
// private "outfits" bucket and write the outfit, job and analysis rows, so the
// user's history survives a new phone. style_analyses is server-write-only by
// design (clients cannot forge their own reads), which is why this lives here.
//
// processDeletions: finishes account deletions requested in the app. The app's
// delete_my_account() blocks the account and records a request; this removes
// the user's stored photos and then the auth user, which cascades through
// every table that references them.
//
// Both need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and do nothing without
// them. Neither ever logs image data or keys.
import crypto from 'node:crypto';
import { db } from './growth.js';

const BUCKETS = ['outfits', 'avatars'];
const PROMPT_VERSION = 'taxonomy-v1';
const DB_CATEGORY = { night: 'night_out' };
const CATEGORIES = new Set(['daily', 'night_out', 'work', 'gym', 'travel', 'event']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// outfitId is chosen by the app so it can match this cloud copy to its local
// one without waiting for the save to finish.
export async function saveAnalysis({ userId, outfitId, imageBase64, mediaType, result, model, category }) {
  if (!db || !userId || !UUID_RE.test(outfitId ?? '')) return null;
  try {
    // outfits.owner_id references profiles, which the app creates at signup.
    const { data: profile } = await db.from('profiles').select('user_id').eq('user_id', userId).maybeSingle();
    if (!profile) return null;

    const key = crypto.randomUUID();
    const path = `${userId}/${key}.jpg`;
    const bytes = Buffer.from(imageBase64, 'base64');
    const up = await db.storage.from('outfits').upload(path, bytes, {
      contentType: mediaType || 'image/jpeg',
      upsert: false,
    });
    if (up.error) throw new Error(`upload: ${up.error.message}`);

    const now = new Date().toISOString();
    const cat = DB_CATEGORY[category] ?? category;
    const { data: outfit, error: oErr } = await db.from('outfits').insert({
      id: outfitId,
      owner_id: userId,
      client_idempotency_key: key,
      category: CATEGORIES.has(cat) ? cat : 'daily',
      captured_at: now,
      status: 'ready',
      original_object_path: path,
    }).select('id').single();
    if (oErr) throw new Error(`outfit: ${oErr.message}`);

    const { data: job, error: jErr } = await db.from('analysis_jobs').insert({
      outfit_id: outfit.id,
      owner_id: userId,
      status: 'succeeded',
      attempt_count: 1,
      provider: 'anthropic',
      model_version: model,
      prompt_version: PROMPT_VERSION,
      queued_at: now,
      started_at: now,
      completed_at: now,
    }).select('id').single();
    if (jErr) throw new Error(`job: ${jErr.message}`);

    const scores = Object.fromEntries(
      (result.aesthetics ?? []).map((a) => [String(a.label), Number(a.pct) || 0]),
    );
    const { data: analysis, error: aErr } = await db.from('style_analyses').insert({
      outfit_id: outfit.id,
      job_id: job.id,
      schema_version: '1',
      model_version: model,
      prompt_version: PROMPT_VERSION,
      traits: (result.tags ?? []).map(String),
      scores,
      // The model does not report a confidence; 1 marks a completed read.
      confidence: 1,
      insight: typeof result.insight === 'string' ? result.insight.slice(0, 140) : null,
    }).select('id').single();
    if (aErr) throw new Error(`analysis: ${aErr.message}`);

    await db.from('outfits').update({ latest_analysis_id: analysis.id }).eq('id', outfit.id);
    return outfit.id;
  } catch (e) {
    console.error('outft: save analysis failed:', e?.message ?? e);
    return null;
  }
}

async function removeStoredFiles(userId) {
  for (const bucket of BUCKETS) {
    // Objects live under "<userId>/..."; list in pages until empty.
    for (;;) {
      const { data, error } = await db.storage.from(bucket).list(userId, { limit: 100 });
      if (error) throw new Error(`list ${bucket}: ${error.message}`);
      if (!data?.length) break;
      const { error: rmErr } = await db.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
      if (rmErr) throw new Error(`remove ${bucket}: ${rmErr.message}`);
      if (data.length < 100) break;
    }
  }
}

export async function processDeletions() {
  if (!db) return { ok: false, reason: 'not_configured' };
  const { data: reqs, error } = await db
    .from('data_requests')
    .select('id, user_id')
    .eq('type', 'deletion')
    .in('status', ['requested', 'failed'])
    .limit(50);
  if (error) return { ok: false, reason: error.message };

  let deleted = 0;
  let failed = 0;
  for (const r of reqs ?? []) {
    try {
      await db.from('data_requests').update({ status: 'in_progress' }).eq('id', r.id);
      await removeStoredFiles(r.user_id);
      // Deleting the auth user cascades to profiles and every owned row,
      // including this request. Event and cost logs keep only a null user.
      const { error: delErr } = await db.auth.admin.deleteUser(r.user_id);
      if (delErr) throw new Error(`auth: ${delErr.message}`);
      deleted++;
    } catch (e) {
      failed++;
      await db.from('data_requests')
        .update({ status: 'failed', error_code: String(e?.message ?? e).slice(0, 120) })
        .eq('id', r.id);
    }
  }
  console.log(JSON.stringify({ evt: 'account_deletions', deleted, failed }));
  return { ok: true, deleted, failed };
}

// Runs the deletion job shortly after start and then every hour, well inside
// the 30 days the Privacy Policy promises.
export function startDeletionJob() {
  if (!db) return;
  const run = () => processDeletions().catch((e) => console.error('outft: deletion job:', e?.message ?? e));
  setTimeout(run, 30_000);
  setInterval(run, 60 * 60 * 1000);
}
