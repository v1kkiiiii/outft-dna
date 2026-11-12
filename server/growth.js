// Growth and measurement endpoints for the outft. server: AI cost logging,
// onboarding metrics, opt-in re-engagement, brand code attribution, and
// referral credit. All data stays in our own Supabase project; nothing here
// calls a third-party analytics service.
//
// Every feature is fail-soft: without SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// the cost log falls back to a stdout line and the admin endpoints answer 503.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const db = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

const flag = (name) => /^(1|true|on|yes)$/i.test(process.env[name] ?? '');

// ---------------------------------------------------------------------------
// AI cost
// ---------------------------------------------------------------------------

// Standard first-party API rates in USD per million tokens. Cache writes are
// billed at 1.25x input and cache reads at 0.1x input. Override with
// AI_PRICE_INPUT_PER_MTOK / AI_PRICE_OUTPUT_PER_MTOK if the model changes.
const PRICES = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export function estimateUsd(model, usage = {}) {
  const base = PRICES[model] ?? { input: 2, output: 10 };
  const input = Number(process.env.AI_PRICE_INPUT_PER_MTOK) || base.input;
  const output = Number(process.env.AI_PRICE_OUTPUT_PER_MTOK) || base.output;
  const usd =
    ((usage.input_tokens ?? 0) * input +
      (usage.output_tokens ?? 0) * output +
      (usage.cache_creation_input_tokens ?? 0) * input * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * input * 0.1) / 1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}

// Records one model call. Never receives or stores image data, prompts, or keys.
export async function logAiCost({ userId, model, usage, ok, purpose = 'analysis' }) {
  const row = {
    user_id: userId ?? null,
    purpose,
    model,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_tokens: usage?.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage?.cache_creation_input_tokens ?? 0,
    estimated_usd: estimateUsd(model, usage),
    ok,
  };
  console.log(JSON.stringify({ evt: 'ai_cost', ...row, user_id: row.user_id ? 'set' : null }));
  if (!db) return;
  const { error } = await db.from('ai_cost_log').insert(row);
  if (error) console.warn('outft: ai_cost_log insert failed:', error.message);
}

// Resolves the Supabase user from an `Authorization: Bearer <access token>`
// header. Returns null for guests or when the backend is not configured.
export async function userFromRequest(req) {
  const auth = req.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!db || !token) return null;
  try {
    const { data, error } = await db.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Free tier (behind FEATURE_PRICING, off by default)
// ---------------------------------------------------------------------------

export const FREE_INTRO_ANALYSES = 5;
export const FREE_MONTHLY_ANALYSES = 2;

// Returns { allowed, plan, introUsed, monthUsed }. Always allowed when the
// pricing flag is off, the user is unknown, or the backend is unconfigured.
export async function analysisAllowance(userId) {
  const open = { allowed: true, plan: 'free', introUsed: 0, monthUsed: 0 };
  if (!flag('FEATURE_PRICING') || !db || !userId) return open;
  const { data: ent } = await db.from('entitlements').select('plan').eq('user_id', userId).maybeSingle();
  if (ent?.plan === 'premium') return { ...open, plan: 'premium' };
  const { data: rows, error } = await db
    .from('ai_cost_log').select('created_at')
    .eq('user_id', userId).eq('purpose', 'analysis').eq('ok', true)
    .order('created_at', { ascending: true });
  if (error) return open;
  const all = rows ?? [];
  // The first five successful analyses are the intro allowance; after that,
  // two per calendar month (UTC).
  const afterIntro = all.slice(FREE_INTRO_ANALYSES);
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const monthUsed = afterIntro.filter((r) => new Date(r.created_at) >= monthStart).length;
  const introUsed = Math.min(all.length, FREE_INTRO_ANALYSES);
  const allowed = introUsed < FREE_INTRO_ANALYSES || monthUsed < FREE_MONTHLY_ANALYSES;
  return { allowed, plan: 'free', introUsed, monthUsed };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const HOUR = 3600 * 1000;
const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function computeMetrics() {
  if (!db) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set');
  const events = await fetchAll('app_events', 'user_id,name,created_at');
  const costs = await fetchAll('ai_cost_log', 'user_id,purpose,estimated_usd,input_tokens,output_tokens,ok,created_at');

  const byUser = new Map();
  for (const e of events) {
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
    byUser.get(e.user_id).push({ ...e, t: new Date(e.created_at).getTime() });
  }

  const users = [];
  for (const [userId, evs] of byUser) {
    evs.sort((a, b) => a.t - b.t);
    const first = (n) => evs.find((e) => e.name === n);
    const signup = first('signup') ?? evs[0];
    const firstRead = first('first_dna_read');
    const uploads = evs.filter((e) => e.name === 'photo_uploaded' || e.name === 'onboarding_photo_uploaded');
    const twin = first('twin_match_viewed');
    const sessions = evs.filter((e) => e.name === 'session_start');
    const returnedBetween = (startH, endH) =>
      sessions.some((s) => s.t - signup.t >= startH * HOUR && s.t - signup.t < endH * HOUR);
    const tapped = first('sharpen_prompt_tapped');
    users.push({
      user_id: userId,
      signed_up_at: new Date(signup.t).toISOString(),
      photos_uploaded: uploads.length,
      seconds_to_first_dna: firstRead ? Math.round((firstRead.t - signup.t) / 1000) : null,
      photos_before_first_dna: firstRead ? uploads.filter((u) => u.t <= firstRead.t).length : null,
      uploaded_after_twin_match: twin ? uploads.some((u) => u.t > twin.t) : null,
      sessions: sessions.length,
      // Day-1 return: a session 24 to 48 hours after signup. Day-7: 7 to 8 days.
      day1_return: Date.now() - signup.t >= 48 * HOUR ? returnedBetween(24, 48) : null,
      day7_return: Date.now() - signup.t >= 8 * 24 * HOUR ? returnedBetween(7 * 24, 8 * 24) : null,
      sharpen_prompt_shown: !!first('sharpen_prompt_shown'),
      sharpen_prompt_tapped: !!tapped,
      uploaded_after_sharpen_tap: tapped ? uploads.some((u) => u.t > tapped.t) : null,
    });
  }

  const analyses = costs.filter((c) => c.purpose === 'analysis' && c.ok);
  const costPerAnalysis = avg(analyses.map((c) => Number(c.estimated_usd)));
  const photosToValue = median(users.map((u) => u.photos_before_first_dna).filter((x) => x != null));
  const rate = (xs) => {
    const known = xs.filter((x) => x != null);
    return known.length ? known.filter(Boolean).length / known.length : null;
  };

  return {
    generated_at: new Date().toISOString(),
    summary: {
      users: users.length,
      median_seconds_to_first_dna: median(users.map((u) => u.seconds_to_first_dna).filter((x) => x != null)),
      median_photos_before_first_dna: photosToValue,
      avg_photos_uploaded: avg(users.map((u) => u.photos_uploaded)),
      upload_after_twin_match_rate: rate(users.map((u) => u.uploaded_after_twin_match)),
      avg_sessions: avg(users.map((u) => u.sessions)),
      day1_return_rate: rate(users.map((u) => u.day1_return)),
      day7_return_rate: rate(users.map((u) => u.day7_return)),
      analyses_logged: analyses.length,
      avg_cost_per_analysis_usd: costPerAnalysis,
      avg_tokens_per_analysis: avg(analyses.map((c) => c.input_tokens + c.output_tokens)),
      total_ai_cost_usd: costs.reduce((s, c) => s + Number(c.estimated_usd), 0),
      // Onboarding cost = cost per analysis x photos to value.
      onboarding_cost_usd: costPerAnalysis != null && photosToValue != null ? costPerAnalysis * photosToValue : null,
      sharpen_experiment: {
        shown: users.filter((u) => u.sharpen_prompt_shown).length,
        tapped: users.filter((u) => u.sharpen_prompt_tapped).length,
        uploaded_after_tap: users.filter((u) => u.uploaded_after_sharpen_tap).length,
      },
    },
    users,
  };
}

// ---------------------------------------------------------------------------
// Re-engagement notifications (opt-in, stub provider by default)
// ---------------------------------------------------------------------------

const KINDS = {
  daily_reminder: { pref: 'daily_reminder', subject: 'Your daily outft. log', body: 'Your log is open for today. Add today\'s outfit to keep your record going.' },
  wrapped_ready: { pref: 'wrapped_ready', subject: 'Your outft. Wrapped is ready', body: 'Your Wrapped card is ready to view in the app.' },
  twin_match: { pref: 'twin_match', subject: 'You have a new style twin on outft.', body: 'Someone new dresses a lot like you. Open the app to see your match.' },
};

function publicUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

async function sendEmail({ to, subject, text }) {
  const provider = process.env.EMAIL_PROVIDER || 'stub';
  if (provider === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    });
    return { provider, status: r.ok ? 'sent' : `error_${r.status}` };
  }
  // Stub: record that we would have sent it. The address is not printed.
  console.log(JSON.stringify({ evt: 'email_stub', subject }));
  return { provider: 'stub', status: 'stubbed' };
}

async function sendPush({ token, title, body }) {
  if (process.env.PUSH_PROVIDER === 'expo' && token) {
    const r = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: token, title, body }),
    });
    return { provider: 'expo', status: r.ok ? 'sent' : `error_${r.status}` };
  }
  console.log(JSON.stringify({ evt: 'push_stub', title }));
  return { provider: 'stub', status: 'stubbed' };
}

// Sends one kind of notification to opted-in users. For daily_reminder the
// audience is everyone opted in who has not logged a photo today; for the
// other kinds the caller passes the user ids the event applies to.
export async function triggerNotifications(req, kind, userIds) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`unknown kind ${kind}`);
  let q = db.from('notification_prefs')
    .select('user_id,email,push_token,unsubscribe_token')
    .eq(spec.pref, true).is('unsubscribed_at', null);
  if (Array.isArray(userIds) && userIds.length) q = q.in('user_id', userIds);
  const { data: prefs, error } = await q;
  if (error) throw new Error(error.message);

  let audience = prefs ?? [];
  if (kind === 'daily_reminder') {
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const { data: today } = await db.from('app_events').select('user_id')
      .in('name', ['photo_uploaded', 'onboarding_photo_uploaded']).gte('created_at', start.toISOString());
    const done = new Set((today ?? []).map((r) => r.user_id));
    audience = audience.filter((p) => !done.has(p.user_id));
  }

  const results = [];
  for (const p of audience) {
    const unsub = `${publicUrl(req)}/unsubscribe?token=${p.unsubscribe_token}`;
    if (p.email) {
      const r = await sendEmail({ to: p.email, subject: spec.subject, text: `${spec.body}\n\nUnsubscribe: ${unsub}` });
      results.push({ user_id: p.user_id, kind, channel: 'email', ...r });
    }
    if (p.push_token) {
      const r = await sendPush({ token: p.push_token, title: 'outft.', body: spec.body });
      results.push({ user_id: p.user_id, kind, channel: 'push', ...r });
    }
  }
  if (results.length) await db.from('notification_log').insert(results);
  return { kind, audience: audience.length, sent: results.length };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const given = req.get('x-admin-token') ?? '';
  if (!expected) return res.status(503).json({ error: 'ADMIN_TOKEN is not set' });
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'unauthorized' });
  if (!db) return res.status(503).json({ error: 'database not configured' });
  next();
}

export function registerGrowthRoutes(app) {
  app.get('/api/admin/metrics', requireAdmin, async (_req, res) => {
    try { res.json(await computeMetrics()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/admin/notify/daily_reminder   body: { userIds?: string[] }
  app.post('/api/admin/notify/:kind', requireAdmin, async (req, res) => {
    if (!flag('FEATURE_REENGAGEMENT')) return res.status(409).json({ error: 'FEATURE_REENGAGEMENT is off' });
    try { res.json(await triggerNotifications(req, req.params.kind, req.body?.userIds)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get('/unsubscribe', async (req, res) => {
    const token = String(req.query.token ?? '');
    if (!db || !/^[0-9a-f-]{36}$/i.test(token)) return res.status(400).send('This unsubscribe link is not valid.');
    const { data, error } = await db.from('notification_prefs')
      .update({ daily_reminder: false, wrapped_ready: false, twin_match: false, unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token).select('user_id');
    if (error || !data?.length) return res.status(404).send('We could not find that subscription.');
    res.send('<!doctype html><meta name="viewport" content="width=device-width"><title>Unsubscribed</title>'
      + '<body style="font-family:Georgia,serif;max-width:32rem;margin:4rem auto;padding:0 1rem">'
      + '<h1 style="font-style:italic">outft.</h1><p>You are unsubscribed from outft. emails and reminders. '
      + 'You can turn them back on in the app under Settings.</p></body>');
  });

  // Brand attribution. Records an impression, click, or code redemption for a
  // campaign code; the signed-in user is attached when a token is sent.
  app.post('/api/campaigns/:code/events', async (req, res) => {
    if (!db) return res.status(503).json({ error: 'database not configured' });
    const kind = req.body?.kind;
    if (!['impression', 'click', 'redemption'].includes(kind)) return res.status(400).json({ error: 'kind must be impression, click, or redemption' });
    const { data: c } = await db.from('brand_campaigns').select('id').eq('code', req.params.code).eq('active', true).maybeSingle();
    if (!c) return res.status(404).json({ error: 'unknown campaign code' });
    const userId = await userFromRequest(req);
    const outfitId = typeof req.body?.outfitId === 'string' ? req.body.outfitId : null;
    const { error } = await db.from('campaign_events').insert({ campaign_id: c.id, kind, user_id: userId, outfit_id: outfitId });
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ ok: true });
  });

  app.post('/api/admin/campaigns', requireAdmin, async (req, res) => {
    const { brandName, code, styleCluster } = req.body ?? {};
    if (!brandName || !code || !styleCluster) return res.status(400).json({ error: 'brandName, code, and styleCluster are required' });
    const { data, error } = await db.from('brand_campaigns')
      .insert({ brand_name: brandName, code, style_cluster: styleCluster }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  });

  app.get('/api/admin/campaigns', requireAdmin, async (_req, res) => {
    const { data, error } = await db.from('campaign_stats').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Referral credit: call when a referred user becomes a paid subscriber.
  // Record only; there are no payouts.
  app.post('/api/admin/referrals/credit', requireAdmin, async (req, res) => {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const now = new Date().toISOString();
    const { data, error } = await db.from('referrals')
      .update({ became_paid_at: now, credited_at: now })
      .eq('referred_user_id', userId).is('credited_at', null).select('referrer_id');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ credited: data?.length ?? 0, referrerId: data?.[0]?.referrer_id ?? null });
  });

  app.get('/api/admin/referrals', requireAdmin, async (_req, res) => {
    const { data, error } = await db.from('referrals').select('referrer_id,became_paid_at,credited_at');
    if (error) return res.status(500).json({ error: error.message });
    const board = {};
    for (const r of data) {
      board[r.referrer_id] ??= { referrer_id: r.referrer_id, referred: 0, paid_credited: 0 };
      board[r.referrer_id].referred += 1;
      if (r.credited_at) board[r.referrer_id].paid_credited += 1;
    }
    res.json(Object.values(board).sort((a, b) => b.paid_credited - a.paid_credited));
  });
}
