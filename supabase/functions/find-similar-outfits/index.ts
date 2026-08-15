/**
 * find-similar-outfits — Edge Function (Deno).
 *
 * Given one of the caller's own `ready` outfits, ranks their other `ready`
 * outfits by style similarity and returns a short, non-evaluative "why"
 * sentence per match. Mirrors the worker's provider-call shape (analyze.ts /
 * prompt.ts / schema.ts) but is request/response instead of queued, since
 * "find similar" needs to answer inside a single screen interaction.
 *
 * Security model (SECURITY.md R-01, item 2, item 4):
 *  - ANTHROPIC_API_KEY is a Supabase Edge Function secret — never sent to,
 *    or read from, the mobile app.
 *  - The caller's JWT is verified by the platform before this code runs;
 *    Supabase client here is built with that JWT (not the service role), so
 *    every DB read is scoped by RLS to the caller's own rows. No client-
 *    supplied user id is ever trusted.
 *  - Only style_analyses fields already produced by the worker (garments,
 *    colors, traits, scores, insight) are sent to the model — never raw
 *    images, never other users' data (P1 `posts`/cross-user matching isn't
 *    built yet; see docs/DATABASE_SCHEMA.md §2 — this is scoped to the
 *    caller's own trace history, same honesty policy as TwinsScreen's
 *    "Echoes" empty state).
 *
 * Request:  POST { outfitId: string, limit?: number }
 * Response: { ok: true, matches: [{ outfitId, score, why }] }
 *        or { ok: false, error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';

const MAX_LIMIT = 6;
const SHORTLIST_SIZE = 12; // candidates sent to the model, pre-ranked locally
const MODEL = Deno.env.get('SIMILARITY_MODEL') || 'claude-sonnet-4-6';

interface AnalysisRow {
  outfit_id: string;
  garments: { category: string; label: string; confidence: number }[] | null;
  colors: { hex: string; label: string; weight: number }[] | null;
  traits: { label: string; confidence: number }[] | null;
  scores: Record<string, number> | null;
  insight: string | null;
}

// Same seven banned-language categories as worker/src/schema.ts, kept in
// sync manually (this function runs in Deno and can't import that module).
const BANNED_LANGUAGE_PATTERNS: RegExp[] = [
  /\b(hot(?![- ]?pink)|sexy|sexiest|ugly|gorgeous|beautiful person|attractive|unattractive|hottie)\b/i,
  /\b(slimming|flattering|unflattering|hides (your|her|his|their) (body|figure)|figure[- ]flattering|body[- ]?type|fat|overweight|skinny|curvy|petite frame|plus[- ]size)\b/i,
  /\b(you (look|seem) (rich|poor|wealthy)|cheap[- ]looking|expensive[- ]looking|looks? (rich|poor|cheap|expensive)|budget person|low[- ]budget)\b/i,
  /\b(masculine enough|feminine enough|appropriate for (a )?(man|woman|boy|girl)|too (masculine|feminine) for)\b/i,
  /\b(you are (a|an) \w+|clearly (male|female|non-?binary|pregnant|elderly|young)|looks? (pregnant|gay|straight|trans))\b/i,
  /\b(disab(led|ility)|medical condition|illness|diagnos(is|ed))\b/i,
  /\b(you should (not|never)?|this is (wrong|a mistake)|major mistake|fashion mistake|don'?t wear this)\b/i,
];
function containsBannedLanguage(text: string): boolean {
  return BANNED_LANGUAGE_PATTERNS.some((p) => p.test(text));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Cheap local pre-ranking so only a bounded, already-relevant shortlist goes
// to the model: cosine similarity over styleScores + Jaccard over trait
// labels. Keeps token spend and latency small and deterministic.
function localSimilarity(target: AnalysisRow, candidate: AnalysisRow): number {
  const a = target.scores ?? {};
  const b = candidate.scores ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  const cosine = magA > 0 && magB > 0 ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;

  const traitsA = new Set((target.traits ?? []).map((t) => t.label));
  const traitsB = new Set((candidate.traits ?? []).map((t) => t.label));
  const union = new Set([...traitsA, ...traitsB]);
  const inter = [...traitsA].filter((t) => traitsB.has(t)).length;
  const jaccard = union.size > 0 ? inter / union.size : 0;

  return cosine * 0.7 + jaccard * 0.3;
}

function toDescriptor(row: AnalysisRow) {
  return {
    id: row.outfit_id,
    garments: (row.garments ?? []).map((g) => `${g.category}:${g.label}`),
    colors: (row.colors ?? []).map((c) => c.label),
    traits: (row.traits ?? []).map((t) => t.label),
    scores: row.scores ?? {},
    insight: row.insight ?? '',
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { outfitId?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'INVALID_JSON_BODY' }, 400);
  }
  const outfitId = body.outfitId;
  if (!outfitId || typeof outfitId !== 'string') {
    return jsonResponse({ ok: false, error: 'outfitId required' }, 400);
  }
  const limit = Math.min(Math.max(1, body.limit ?? 3), MAX_LIMIT);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const authHeader = req.headers.get('Authorization');
  if (!supabaseUrl || !authHeader) return jsonResponse({ ok: false, error: 'AUTH_REQUIRED' }, 401);

  // Built with the caller's JWT (not service role) — every query below is
  // scoped by RLS to rows this user owns (SECURITY.md §2 "Cross-user reads").
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return jsonResponse({ ok: false, error: 'AUTH_REQUIRED' }, 401);

  // Target outfit's latest analysis.
  const { data: targetOutfit, error: targetErr } = await supabase
    .from('outfits')
    .select('id, latest_analysis_id')
    .eq('id', outfitId)
    .is('deleted_at', null)
    .maybeSingle();
  if (targetErr || !targetOutfit) return jsonResponse({ ok: false, error: 'OUTFIT_NOT_FOUND' }, 404);

  const { data: targetAnalysis, error: targetAnalysisErr } = await supabase
    .from('style_analyses')
    .select('outfit_id, garments, colors, traits, scores, insight')
    .eq('outfit_id', outfitId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<AnalysisRow>();
  if (targetAnalysisErr || !targetAnalysis) {
    return jsonResponse({ ok: false, error: 'ANALYSIS_NOT_READY' }, 409);
  }

  // Candidate pool: the caller's other ready, non-deleted outfits. Cross-user
  // matching arrives once P1 `posts` ships (docs/DATABASE_SCHEMA.md §2).
  const { data: candidateRows, error: candErr } = await supabase
    .from('outfits')
    .select('id, style_analyses (outfit_id, garments, colors, traits, scores, insight, created_at)')
    .eq('owner_id', userData.user.id)
    .eq('status', 'ready')
    .neq('id', outfitId)
    .is('deleted_at', null)
    .limit(200);
  if (candErr) return jsonResponse({ ok: false, error: 'CANDIDATE_QUERY_FAILED' }, 500);

  type CandidateOutfitRow = { id: string; style_analyses: AnalysisRow[] | AnalysisRow | null };
  const candidates: AnalysisRow[] = [];
  for (const row of (candidateRows ?? []) as unknown as CandidateOutfitRow[]) {
    const a = row.style_analyses;
    const picked = Array.isArray(a) ? a[0] : a;
    if (picked) candidates.push({ ...picked, outfit_id: row.id });
  }

  if (candidates.length === 0) {
    return jsonResponse({ ok: true, matches: [] });
  }

  // Bound the model call to a locally pre-ranked shortlist.
  const shortlist = candidates
    .map((c) => ({ row: c, score: localSimilarity(targetAnalysis, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, SHORTLIST_SIZE)
    .map((s) => s.row);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonResponse({ ok: false, error: 'ANTHROPIC_API_KEY not set' }, 500);
  const client = new Anthropic({ apiKey, timeout: 30_000 });

  const prompt = `You are OUTFT's style-similarity engine. You are given one TARGET outfit's structured style analysis and a list of CANDIDATE outfits (the same person's other traced outfits). Rank the candidates by how visually and stylistically similar they are to the target — palette, silhouette, garment types, and aesthetic mix, not identical items required.

Return ONLY a raw JSON array (no markdown, no preamble), of at most ${limit} entries, most similar first:
[{"id": "<candidate id>", "why": "<one sentence, max 100 characters, plain text>"}]

"why" must describe the OUTFIT similarity only (palette, silhouette, garments, aesthetic) — never the wearer's body, attractiveness, or worth. If fewer than ${limit} candidates are meaningfully similar, return fewer entries. If none are meaningfully similar, return [].

TARGET:
${JSON.stringify(toDescriptor(targetAnalysis))}

CANDIDATES:
${JSON.stringify(shortlist.map(toDescriptor))}`;

  let modelMatches: { id: string; why: string }[] = [];
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = message.content.find((c) => c.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        const candidateIds = new Set(shortlist.map((c) => c.outfit_id));
        modelMatches = parsed
          .filter(
            (m): m is { id: string; why: string } =>
              m && typeof m.id === 'string' && typeof m.why === 'string' && candidateIds.has(m.id),
          )
          .map((m) => ({ id: m.id, why: m.why.trim().slice(0, 100) }))
          .filter((m) => m.why.length > 0 && !containsBannedLanguage(m.why))
          .slice(0, limit);
      }
    }
  } catch (err) {
    console.error('[find-similar-outfits] provider call failed', err instanceof Error ? err.message : err);
    // Fail soft into the local ranking below rather than erroring the screen.
  }

  // Fall back to the local ranking (with a generic "why") if the model call
  // failed or returned nothing usable — the feature stays honest either way.
  const finalMatches =
    modelMatches.length > 0
      ? modelMatches.map((m) => ({
          outfitId: m.id,
          score: shortlist.find((c) => c.outfit_id === m.id) ? localSimilarity(targetAnalysis, shortlist.find((c) => c.outfit_id === m.id)!) : 0,
          why: m.why,
        }))
      : shortlist.slice(0, limit).map((c) => ({
          outfitId: c.outfit_id,
          score: localSimilarity(targetAnalysis, c),
          why: 'Close palette and silhouette match.',
        }));

  return jsonResponse({ ok: true, matches: finalMatches });
});
