// First-party product events, stored only in our own Supabase project
// (public.app_events). No third-party analytics SDK. Events are never sent
// with photos, captions, or other free text: props are small ids and numbers.
//
// Signed-out or offline events wait in a small local queue and are flushed
// the next time a signed-in user tracks something.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type EventName =
  | 'signup' | 'terms_accepted' | 'session_start'
  | 'onboarding_photo_uploaded' | 'onboarding_photo_failed'
  | 'photo_uploaded' | 'analysis_completed' | 'analysis_failed'
  | 'first_dna_read' | 'dna_viewed' | 'twin_match_viewed'
  | 'sharpen_prompt_shown' | 'sharpen_prompt_tapped'
  | 'share_tapped' | 'story_exported' | 'onboarding_completed'
  | 'paywall_shown' | 'paywall_plan_tapped';

type Props = Record<string, string | number | boolean | null>;
interface Queued { name: EventName; props: Props; at: string }

const QUEUE_KEY = 'outft.event-queue.v1';
const MAX_QUEUE = 200;

async function readQueue(): Promise<Queued[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: Queued[]) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {}
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Fire-and-forget; never throws to the UI.
export async function track(name: EventName, props: Props = {}): Promise<void> {
  const item: Queued = { name, props, at: new Date().toISOString() };
  const queue = [...(await readQueue()), item];
  const userId = await currentUserId();
  if (!supabase || !userId) {
    await writeQueue(queue);
    return;
  }
  const rows = queue.map((q) => ({ user_id: userId, name: q.name, props: q.props, created_at: q.at }));
  try {
    const { error } = await supabase.from('app_events').insert(rows);
    await writeQueue(error ? queue : []);
  } catch {
    await writeQueue(queue);
  }
}
