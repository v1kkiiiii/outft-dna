// Remote sponsored placements for OUTFT (sponsored_placements table).
// fetchPlacements(surface) returns active, in-window placements ordered by
// weight, mapped into the app's Post shape. Results are cached in memory for
// 5 minutes per surface. On ANY failure (backend unconfigured, offline,
// bad rows) we return the hardcoded fallback so an ad slot is never empty
// and the app never crashes without a network.
import { supabase } from './supabase';
import { BRAND_PICKS, Post, postIdxFromId } from '../data';

export type AdSurface = 'twins' | 'home';

interface PlacementRow {
  id: string;
  brand: string;
  caption: string;
  dna_copy: string;
  tags: string[] | null;
  tone: string;
  shop_url: string;
  surface: AdSurface;
  weight: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

// Mirrors the current hardcoded Home spotlight card.
export const HOME_FALLBACK: Post[] = [
  {
    idx: 410,
    handle: 'Featured brand',
    ava: 'FB',
    color: '#D8CFC4',
    date: 'sponsored',
    caption: 'Shop the pieces closest to your trace.',
    tags: ['quiet luxury'],
    likes: 0,
    dna: 'Quiet luxury lane',
    tone: '#DCD3C6',
    sponsor: { brand: 'Featured brand', shopUrl: 'https://outft.app', affiliateId: 'outft-featured' },
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache: Partial<Record<AdSurface, { at: number; posts: Post[] }>> = {};

function fallbackFor(surface: AdSurface): Post[] {
  return surface === 'twins' ? BRAND_PICKS : HOME_FALLBACK;
}

function inWindow(row: PlacementRow, now: number): boolean {
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.ends_at && Date.parse(row.ends_at) < now) return false;
  return true;
}

function toPost(row: PlacementRow): Post {
  return {
    idx: postIdxFromId(row.id),
    handle: row.brand,
    ava: row.brand.slice(0, 2).toUpperCase(),
    color: row.tone,
    date: 'sponsored',
    caption: row.caption,
    tags: row.tags ?? [],
    likes: 0,
    dna: row.dna_copy,
    tone: row.tone,
    sponsor: {
      brand: row.brand,
      shopUrl: row.shop_url,
      affiliateId: `outft-${row.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    },
  };
}

export async function fetchPlacements(surface: AdSurface): Promise<Post[]> {
  const now = Date.now();
  const hit = cache[surface];
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.posts;

  try {
    if (!supabase) return fallbackFor(surface);
    const { data, error } = await supabase
      .from('sponsored_placements')
      .select('*')
      .eq('surface', surface)
      .eq('active', true)
      .order('weight', { ascending: false });
    if (error || !data) return fallbackFor(surface);

    const posts = (data as PlacementRow[]).filter((r) => inWindow(r, now)).map(toPost);
    if (posts.length === 0) return fallbackFor(surface);

    cache[surface] = { at: now, posts };
    return posts;
  } catch {
    // Offline, DNS failure, unexpected row shape — never surface an empty slot.
    return fallbackFor(surface);
  }
}
