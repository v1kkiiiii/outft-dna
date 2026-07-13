// Mock data mirrored from the OUTFT website demo (public/index.html).
// All photos are tone placeholders (no real images in the demo either).
import { photoTones, avatarColors } from './theme';

export interface AnalysisResult {
  insight: string;
  aesthetics: { label: string; pct: number }[];
  tags: string[];
}

export interface Post {
  idx: number;
  handle: string;
  ava: string;
  color: string;
  date: string;
  caption: string;
  tags: string[];
  likes: number;
  dna: string;
  tone: string;
  photoUri?: string;
}

export interface Person {
  key: string;
  name: string;
  ava: string;
  color: string;
  since: string;
  fits: number;
  echoes: number;
  streak: number;
  tags: string[];
  colors: string[];
  caption: string;
  postTags: string[];
}

export const DNA_DEFAULT = [
  { label: 'Quiet luxury', pct: 41 },
  { label: 'Old money', pct: 23 },
  { label: 'Scandi', pct: 18 },
  { label: 'Coastal', pct: 11 },
  { label: 'Eclectic', pct: 7 },
];

export const SIGNATURE_COLORS = ['#FFFFFF', '#F0EBE3', '#1A1916', '#3A3830', '#8A7A68', '#C4B098', '#E8D8C4'];

const CAPTION_POOL: { caption: string; tags: string[]; dna: string }[] = [
  { caption: 'Quiet layers for a loud day.', tags: ['minimal', 'daily'], dna: 'Structured neutrals holding a calm line.' },
  { caption: 'Night out. Leather, cargo, no hesitation.', tags: ['party', 'solo'], dna: 'Dark palette leaning utility.' },
  { caption: 'Soft structure for a late dinner.', tags: ['date', 'uni'], dna: 'Draped silhouette, warm tones.' },
  { caption: 'Office fit, softened at the edges.', tags: ['work', 'minimal'], dna: 'Tailored base with quiet texture.' },
  { caption: 'Linen jacket day.', tags: ['daily', 'linen'], dna: 'Light layers tracing coastal ease.' },
  { caption: 'Monochrome until further notice.', tags: ['minimal', 'mono'], dna: 'Single-tone discipline.' },
  { caption: 'Blazer trace, evening version.', tags: ['event', 'blazer'], dna: 'Sharp shoulder, long line.' },
  { caption: 'Gym, but make it intentional.', tags: ['gym', 'active'], dna: 'Function tuned to palette.' },
  { caption: 'Charcoal brown, again.', tags: ['daily', 'tonal'], dna: 'A new neutral settling in.' },
  { caption: 'Old money weekend.', tags: ['weekend', 'classic'], dna: 'Heritage textures, low contrast.' },
  { caption: 'Travel uniform no. 4.', tags: ['travel', 'layers'], dna: 'Packable structure.' },
  { caption: 'Silk under wool.', tags: ['date', 'texture'], dna: 'Contrast in touch, not colour.' },
];

export function buildPosts(count: number): Post[] {
  const posts: Post[] = [];
  for (let i = 0; i < count; i++) {
    const c = CAPTION_POOL[i % CAPTION_POOL.length];
    const day = 22 - Math.floor(i * 0.9);
    const month = day > 0 ? 'Jun' : 'May';
    const d = day > 0 ? day : 31 + day;
    posts.push({
      idx: i,
      handle: '@you',
      ava: 'EV',
      color: avatarColors.you,
      date: `${i % 3 === 0 ? 'morning' : i % 3 === 1 ? 'afternoon' : 'evening'} · ${d} ${month} 2026`,
      caption: c.caption,
      tags: c.tags,
      likes: 8 + ((i * 7) % 40),
      dna: c.dna,
      tone: photoTones[i % photoTones.length],
    });
  }
  return posts;
}

export const POSTS = buildPosts(87);

export const ECHO_POSTS: Post[] = [
  { idx: 100, handle: '@lenav', ava: 'LV', color: avatarColors.lenav, date: 'Apr 14 · 2026', caption: 'a quiet resonance', tags: ['quiet luxury', 'tonal'], likes: 31, dna: '94% echo · palette, silhouette, and mood align with your trace.', tone: photoTones[1] },
  { idx: 101, handle: '@maren', ava: 'MA', color: avatarColors.maren, date: 'Jun 18 · 2026', caption: 'structure first', tags: ['minimal', 'work'], likes: 24, dna: '87% echo · shared structured silhouette.', tone: photoTones[3] },
  { idx: 102, handle: '@noor', ava: 'NO', color: avatarColors.noor, date: 'Jun 15 · 2026', caption: 'soft neutrals', tags: ['scandi', 'daily'], likes: 19, dna: '81% echo · your palettes overlap almost exactly.', tone: photoTones[0] },
  { idx: 103, handle: '@ari', ava: 'AR', color: avatarColors.ari, date: 'Jun 11 · 2026', caption: 'long lines', tags: ['old money', 'classic'], likes: 22, dna: '79% echo · matching layering logic.', tone: photoTones[4] },
];

export const FEED_POSTS: Post[] = [
  { idx: 200, handle: '@maya', ava: 'MY', color: avatarColors.maya, date: '22 June', caption: 'Night out. Leather, cargo, no hesitation.', tags: ['party', 'solo'], likes: 24, dna: 'Dark utility with a sharp line.', tone: photoTones[2] },
  { idx: 201, handle: '@lila', ava: 'LI', color: avatarColors.lila, date: '20 June', caption: 'Soft structure for a late dinner.', tags: ['date', 'uni'], likes: 18, dna: 'Draped neutrals, warm underlight.', tone: photoTones[4] },
  { idx: 202, handle: '@jade', ava: 'JD', color: avatarColors.jade, date: '19 June', caption: 'Work fit, softened.', tags: ['work', 'minimal'], likes: 15, dna: 'Tailoring with quiet texture.', tone: photoTones[0] },
];

export const PEOPLE: Person[] = [
  { key: 'maya', name: 'Maya Chen', ava: 'MY', color: avatarColors.maya, since: '02.01.25', fits: 64, echoes: 12, streak: 9, tags: ['UTILITY', 'DARK', 'PARTY'], colors: ['#1A1916', '#3A3830', '#5A5549', '#8A7A68', '#C4B098'], caption: 'Night out. Leather, cargo, no hesitation.', postTags: ['party', 'solo'] },
  { key: 'lila', name: 'Lila Moreau', ava: 'LI', color: avatarColors.lila, since: '14.02.25', fits: 51, echoes: 8, streak: 6, tags: ['SOFT', 'DRAPE', 'DATE'], colors: ['#F0EBE3', '#E8D8C4', '#C4B098', '#B4A898', '#8A7A68'], caption: 'Soft structure for a late dinner.', postTags: ['date', 'uni'] },
  { key: 'jade', name: 'Jade Okafor', ava: 'JD', color: avatarColors.jade, since: '20.03.25', fits: 47, echoes: 6, streak: 11, tags: ['WORK', 'MINIMAL', 'SHARP'], colors: ['#1A1916', '#F0EBE3', '#8A8278', '#B5ADA3', '#D8CFC4'], caption: 'Work fit, softened.', postTags: ['work', 'minimal'] },
  { key: 'lenav', name: 'Lena Vogel', ava: 'LV', color: avatarColors.lenav, since: '12.12.24', fits: 92, echoes: 31, streak: 21, tags: ['QUIET LUXURY', 'TONAL', 'LONG LINE'], colors: ['#F0EBE3', '#D8CFC4', '#C4B098', '#8A7A68', '#2A2820'], caption: 'a quiet resonance', postTags: ['quiet luxury', 'tonal'] },
  { key: 'maren', name: 'Maren Solberg', ava: 'MA', color: avatarColors.maren, since: '03.04.25', fits: 58, echoes: 8, streak: 13, tags: ['STRUCTURE', 'MINIMAL', 'WORK'], colors: ['#1A1916', '#3A3830', '#B5ADA3', '#E8E8E8', '#FFFFFF'], caption: 'structure first', postTags: ['minimal', 'work'] },
  { key: 'noor', name: 'Noor Haddad', ava: 'NO', color: avatarColors.noor, since: '28.01.25', fits: 61, echoes: 3, streak: 8, tags: ['SCANDI', 'SOFT', 'DAILY'], colors: ['#F0EBE3', '#E8D8C4', '#D8CFC4', '#B4A898', '#8AA898'], caption: 'soft neutrals', postTags: ['scandi', 'daily'] },
  { key: 'ari', name: 'Ari Tanaka', ava: 'AR', color: avatarColors.ari, since: '09.05.25', fits: 39, echoes: 5, streak: 4, tags: ['OLD MONEY', 'CLASSIC', 'LAYERS'], colors: ['#2A2820', '#8A7A68', '#C4B098', '#E8D8C4', '#F0EBE3'], caption: 'long lines', postTags: ['old money', 'classic'] },
  { key: 'theo', name: 'Theo Marsh', ava: 'TH', color: avatarColors.theo, since: '17.02.25', fits: 44, echoes: 7, streak: 5, tags: ['DAILY', 'TONAL', 'EASY'], colors: ['#C4B098', '#B4A898', '#8A7A68', '#5A5549', '#3A3830'], caption: 'charcoal brown, again', postTags: ['daily', 'tonal'] },
  { key: 'jude', name: 'Jude Farrell', ava: 'JU', color: avatarColors.jude, since: '30.04.25', fits: 28, echoes: 2, streak: 3, tags: ['VINTAGE', 'TEXTURE', 'WEEKEND'], colors: ['#8A7A68', '#C4B098', '#D8CFC4', '#E8D8C4', '#F0EBE3'], caption: 'silk under wool', postTags: ['weekend', 'classic'] },
];

export interface ChatMessage { from: 'me' | 'them'; text: string; time: string }

export const CHATS: Record<string, ChatMessage[]> = {
  lenav: [
    { from: 'them', text: 'love that trace from today', time: '2m' },
    { from: 'me', text: 'thank you!! the blazer is doing all the work', time: '1m' },
  ],
  maren: [
    { from: 'them', text: "where's that coat from?", time: '1h' },
  ],
  noor: [
    { from: 'them', text: 'we dress exactly the same lol', time: '3h' },
    { from: 'me', text: '94% echo says you might be right', time: '2h' },
  ],
};

export interface Comment { ava: string; color: string; name: string; text: string; time: string; liked?: boolean }

const COMMENT_PEOPLE = [
  { ava: 'LI', color: avatarColors.lila, name: '@lila' },
  { ava: 'NO', color: avatarColors.noor, name: '@noor' },
  { ava: 'MA', color: avatarColors.maren, name: '@maren' },
  { ava: 'AR', color: avatarColors.ari, name: '@ari' },
];
const COMMENT_TEXTS = [
  'this palette is so you', 'obsessed with the layering here', 'okay the silhouette??',
  'quiet luxury won today', 'need this exact coat', 'the trace continues',
  'tonal perfection', 'saving this immediately', 'echoing this tomorrow',
  'structure looks so good on you', 'that hemline is doing things', 'effortless as always',
  'the texture mix is elite', 'this is a whole mood', 'teach me', 'no notes',
];

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function commentsFor(key: string): Comment[] {
  const h = simpleHash(key);
  const n = 1 + (h % 4);
  const out: Comment[] = [];
  for (let i = 0; i < n; i++) {
    const p = COMMENT_PEOPLE[(h + i) % COMMENT_PEOPLE.length];
    out.push({
      ...p,
      text: COMMENT_TEXTS[(h + i * 7) % COMMENT_TEXTS.length],
      time: ['just now', '12m', '1h', '3h', '1d'][(h + i) % 5],
    });
  }
  return out;
}

export const BADGES = [
  { name: 'Early Bird', desc: 'Trace 5 morning fits between 7 and 11am.', unlocked: true },
  { name: 'Gym Warrior', desc: 'Trace 10 gym fits.', unlocked: true },
  { name: 'Minimalist Master', desc: 'Trace 15 minimal fits.', unlocked: true },
  { name: 'Fashion Explorer', desc: 'Trace fits across 5 aesthetic categories.', unlocked: true },
  { name: 'Vintage Collector', desc: 'Use 8 vintage tags.', unlocked: true },
  { name: 'Trend Setter', desc: 'Get 3 echoes within 24 hours. Premium only.', unlocked: false },
];

export const CATEGORIES = [
  { key: 'daily', label: 'Daily', sub: 'everyday ft.' },
  { key: 'night', label: 'Night out', sub: 'evening trace' },
  { key: 'work', label: 'Work', sub: 'office fit' },
  { key: 'gym', label: 'Gym', sub: 'active trace' },
  { key: 'travel', label: 'Travel', sub: 'on the go' },
  { key: 'event', label: 'Event', sub: 'occasion ft.' },
];

const ANALYSIS_POOL: AnalysisResult[] = [
  {
    insight: 'Your trace leans quiet confidence — structured neutrals holding a calm, deliberate line.',
    aesthetics: [
      { label: 'Quiet luxury', pct: 44 }, { label: 'Old money', pct: 22 },
      { label: 'Scandi', pct: 17 }, { label: 'Coastal', pct: 10 }, { label: 'Eclectic', pct: 7 },
    ],
    tags: ['structured', 'tonal', 'modern'],
  },
  {
    insight: 'Dark utility with a soft edge — your silhouette is getting sharper while the palette stays warm.',
    aesthetics: [
      { label: 'Minimal street', pct: 38 }, { label: 'Quiet luxury', pct: 27 },
      { label: 'Utility', pct: 19 }, { label: 'Scandi', pct: 11 }, { label: 'Eclectic', pct: 5 },
    ],
    tags: ['clean', 'dark neutral', 'utility'],
  },
  {
    insight: 'Coastal ease traced through linen and light layers — the most relaxed your line has been this month.',
    aesthetics: [
      { label: 'Coastal', pct: 36 }, { label: 'Scandi', pct: 28 },
      { label: 'Quiet luxury', pct: 20 }, { label: 'Old money', pct: 10 }, { label: 'Eclectic', pct: 6 },
    ],
    tags: ['airy', 'linen', 'soft structure'],
  },
  {
    insight: 'Heritage textures, low contrast — an old money weekend reading with a modern hem.',
    aesthetics: [
      { label: 'Old money', pct: 40 }, { label: 'Quiet luxury', pct: 26 },
      { label: 'Classic', pct: 16 }, { label: 'Scandi', pct: 12 }, { label: 'Eclectic', pct: 6 },
    ],
    tags: ['heritage', 'classic', 'layered'],
  },
];

// Mock /api/analyze — swap for the real algorithm later; nothing else changes.
export function analyzeOutfit(imageUri: string): Promise<AnalysisResult> {
  const result = ANALYSIS_POOL[simpleHash(imageUri) % ANALYSIS_POOL.length];
  return new Promise((resolve) => setTimeout(() => resolve(result), 1800));
}

export const WRAPPED_SLIDES = [
  { kicker: 'june wrapped', big: '26 fits', copy: 'strongest look was the 14 June blazer trace' },
  { kicker: 'unexpected color', big: 'charcoal brown', copy: 'appeared 5 times after never showing in may', italic: true },
  { kicker: 'closest twin', big: '@lenav', copy: '94% echo by palette, silhouette, and layering' },
  { kicker: 'neglected aesthetic', big: 'romantic', copy: 'only one soft drape trace this month' },
  { kicker: 'biggest DNA change', big: '+8% structured silhouette', copy: '+5% dark neutral palette' },
];

export const ACTIVITY_ITEMS = [
  { icon: 'echo', text: '@theo echoed your trace', time: '5m', go: 'home' },
  { icon: 'follow', text: '@jude started following your trace', time: '2h', go: 'twins' },
  { icon: 'dna', text: 'DNA shifted +4% toward scandi', time: '1d', go: 'dna' },
  { icon: 'badge', text: 'Gym Warrior badge unlocked', time: '2d', go: 'profile' },
  { icon: 'streak', text: '14-day streak! keep going', time: 'today', go: 'home' },
];
