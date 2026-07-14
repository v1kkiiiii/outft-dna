// Server history for OUTFT: fetch the signed-in user's outfits (with their
// style analyses) mapped into the app's local capture shape, soft-delete an
// outfit, and compute the Style DNA baseline (PRD §9.7).
// Every function is best-effort: if the backend is unconfigured or any call
// fails, we return an "empty" result and the app keeps its local behavior.
import { supabase } from './supabase';
import { AnalysisResult } from '../data';
import { LatestOutfit } from '../state';

const BUCKET = 'outfits';
const SIGNED_URL_TTL_SECONDS = 300;

export interface HistoryResult {
  ok: boolean;
  items: LatestOutfit[];
}

interface AnalysisRow {
  id?: string;
  scores?: unknown;
  traits?: unknown;
  insight?: string | null;
  created_at?: string;
}

interface OutfitRow {
  id: string;
  category: string | null;
  caption: string | null;
  captured_at: string;
  original_object_path: string | null;
  processed_object_path: string | null;
  latest_analysis_id: string | null;
  style_analyses: AnalysisRow[] | AnalysisRow | null;
}

// scores jsonb may be a {label: pct} map or an array of {label, pct}.
function toAesthetics(scores: unknown): { label: string; pct: number }[] {
  if (Array.isArray(scores)) {
    return scores
      .filter((s): s is { label: string; pct: number } =>
        !!s && typeof s === 'object' && typeof (s as any).label === 'string' && typeof (s as any).pct === 'number')
      .map((s) => ({ label: s.label, pct: s.pct }));
  }
  if (scores && typeof scores === 'object') {
    return Object.entries(scores as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'number')
      .map(([label, v]) => ({ label, pct: v as number }));
  }
  return [];
}

function toTags(traits: unknown): string[] {
  if (!Array.isArray(traits)) return [];
  return traits
    .map((t) => (typeof t === 'string' ? t : t && typeof t === 'object' && typeof (t as any).label === 'string' ? (t as any).label : null))
    .filter((t): t is string => !!t);
}

function pickAnalysis(row: OutfitRow): AnalysisRow | null {
  const a = row.style_analyses;
  if (!a) return null;
  if (!Array.isArray(a)) return a;
  if (a.length === 0) return null;
  const latest = row.latest_analysis_id && a.find((x) => x.id === row.latest_analysis_id);
  if (latest) return latest;
  return [...a].sort((x, y) => (y.created_at ?? '').localeCompare(x.created_at ?? ''))[0];
}

export async function fetchMyOutfits(limit = 60): Promise<HistoryResult> {
  try {
    if (!supabase) return { ok: false, items: [] };
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) return { ok: false, items: [] };

    const { data, error } = await supabase
      .from('outfits')
      .select('id, category, caption, captured_at, original_object_path, processed_object_path, latest_analysis_id, style_analyses (id, scores, traits, insight, created_at)')
      .eq('owner_id', session.user.id)
      .is('deleted_at', null)
      .eq('status', 'ready')
      .order('captured_at', { ascending: false })
      .limit(limit);
    if (error || !data) return { ok: false, items: [] };

    const items: LatestOutfit[] = [];
    for (const row of data as unknown as OutfitRow[]) {
      const path = row.processed_object_path ?? row.original_object_path;
      let photoUri = '';
      if (path) {
        try {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          photoUri = signed?.signedUrl ?? '';
        } catch {
          // leave placeholder tone; item still renders
        }
      }
      const analysis = pickAnalysis(row);
      const result: AnalysisResult = {
        insight: analysis?.insight ?? '',
        aesthetics: toAesthetics(analysis?.scores),
        tags: toTags(analysis?.traits),
      };
      items.push({
        id: row.id,
        photoUri,
        capturedAt: row.captured_at,
        category: row.category ?? 'daily',
        caption: row.caption ?? undefined,
        result,
      });
    }
    return { ok: true, items };
  } catch {
    return { ok: false, items: [] };
  }
}

export async function deleteOutfit(outfitId: string): Promise<{ ok: boolean }> {
  try {
    if (!supabase) return { ok: false };
    const { data: row, error: readError } = await supabase
      .from('outfits')
      .select('id, original_object_path, processed_object_path')
      .eq('id', outfitId)
      .maybeSingle();
    if (readError) return { ok: false };

    const { error } = await supabase
      .from('outfits')
      .update({ deleted_at: new Date().toISOString(), status: 'deleting' })
      .eq('id', outfitId);
    if (error) return { ok: false };

    // Best-effort storage cleanup; the tombstone is what matters.
    try {
      const paths = [row?.original_object_path, row?.processed_object_path].filter(
        (p): p is string => !!p,
      );
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    } catch {}
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// PRD §9.7 baseline Style DNA: normalize each analysis's aesthetics to 100,
// equal weight per analysis, arithmetic mean by label, keep top 4, renormalize.
export function computeDna(items: LatestOutfit[]): { label: string; pct: number }[] {
  const analyses = items
    .map((i) => i.result.aesthetics.filter((a) => a.pct > 0))
    .filter((a) => a.length > 0);
  if (analyses.length === 0) return [];

  const sums = new Map<string, number>();
  for (const aesthetics of analyses) {
    const total = aesthetics.reduce((s, a) => s + a.pct, 0);
    for (const a of aesthetics) {
      sums.set(a.label, (sums.get(a.label) ?? 0) + (a.pct / total) * 100);
    }
  }
  // Arithmetic mean over all analyses (labels absent from an analysis count as 0).
  const means = [...sums.entries()].map(([label, sum]) => ({ label, pct: sum / analyses.length }));
  const top = means.sort((a, b) => b.pct - a.pct).slice(0, 4);
  const topTotal = top.reduce((s, a) => s + a.pct, 0);
  if (topTotal <= 0) return [];
  return top.map((a) => ({ label: a.label, pct: Math.round((a.pct / topTotal) * 100) }));
}
