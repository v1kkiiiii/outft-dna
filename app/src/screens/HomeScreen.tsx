import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { BRAND_PICKS, buildPosts, ECHO_POSTS, Post, postIdxFromId } from '../data';
import { LatestOutfit, useApp } from '../state';
import { BellIcon, CommentIcon, initialsFrom, Photo, pressDim } from '../ui';
import { fetchMyOutfits } from '../lib/historyApi';
import { fetchPlacements, HOME_FALLBACK } from '../lib/adsApi';
import { STYLE_FAMILIES } from '../styles';

// Local calendar-day key (YYYY-MM-DD) for a date.
function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function captureToPost(c: LatestOutfit, profileName: string, avatarUri: string | null): Post {
  return {
    idx: postIdxFromId(c.id),
    handle: '@you',
    ava: initialsFrom(profileName),
    avatarUri,
    color: '#CDB89B',
    date: new Date(c.capturedAt).toLocaleDateString(),
    caption: c.caption ?? c.result.insight,
    tags: c.result.tags.slice(0, 2),
    likes: 0,
    dna: c.result.insight,
    tone: '#DFDFDF',
    photoUri: c.photoUri,
  };
}

const FILTERS = ['All', ...STYLE_FAMILIES.map((f) => f.name)];

// Which style families a post belongs to. Real captures match by their
// analysed aesthetic labels; placeholder discover posts get a stable family
// from their id so every pill has content until the recs database is loaded.
function familiesOf(p: Post, labels: string[] | undefined): string[] {
  if (labels && labels.length > 0) {
    const want = labels.map((l) => l.toLowerCase());
    return STYLE_FAMILIES
      .filter((f) => f.labels.some((l) => want.includes(l.toLowerCase())))
      .map((f) => f.name);
  }
  return [STYLE_FAMILIES[p.idx % STYLE_FAMILIES.length].name];
}

// Card heights cycle so the two columns stagger like a Pinterest board.
const ASPECTS = [1.25, 1.55, 1.1, 1.45, 1.3, 1.65];

export default function HomeScreen() {
  const { navigate, profileName, avatarUri, captures } = useApp();
  const [serverItems, setServerItems] = useState<LatestOutfit[]>([]);
  const [homeAd, setHomeAd] = useState<Post>(HOME_FALLBACK[0]);
  const [filter, setFilter] = useState('All');
  const [liked, setLiked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let alive = true;
    fetchPlacements('home')
      .then((p) => { if (alive && p.length > 0) setHomeAd(p[0]); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchMyOutfits()
      .then((r) => { if (alive && r.ok) setServerItems(r.items); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Merge local + server captures, deduped by id, newest first.
  const allCaptures = useMemo(() => {
    const localIds = new Set(captures.map((c) => c.id));
    const merged = [...captures, ...serverItems.filter((i) => !localIds.has(i.id))];
    return merged.sort((a, b) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''));
  }, [captures, serverItems]);

  const captureDays = useMemo(() => {
    const days = new Set<string>();
    for (const c of allCaptures) {
      const d = new Date(c.capturedAt);
      if (!isNaN(d.getTime())) days.add(dayKey(d));
    }
    return days;
  }, [allCaptures]);

  // Streak: consecutive days ending today (or yesterday) with at least one capture.
  const streak = useMemo(() => {
    const cursor = new Date();
    if (!captureDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let n = 0;
    while (captureDays.has(dayKey(cursor))) {
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }, [captureDays]);

  const doneToday = captureDays.has(dayKey(new Date()));

  // The feed: your own real captures first, then discover posts. The discover
  // posts are placeholders until the outfit/brand recs database is connected.
  const feed = useMemo(() => {
    const mine = allCaptures.map((c) => ({
      post: captureToPost(c, profileName, avatarUri),
      labels: c.result.aesthetics.map((a) => a.label),
    }));
    const discover = [...ECHO_POSTS, ...BRAND_PICKS, ...buildPosts(60).map((p, i) => ({
      ...p, idx: 1000 + i, handle: ['@maya', '@lila', '@jade', '@noor', '@ari', '@theo'][i % 6],
    }))].map((post) => ({ post, labels: undefined as string[] | undefined }));
    const all = [...mine, ...discover];
    const filtered = (filter === 'All'
      ? all
      : all.filter(({ post, labels }) => familiesOf(post, labels).includes(filter))
    ).map(({ post }) => post);
    // Slot the sponsored placement in after the first few cards.
    const out = [...filtered];
    if (out.length > 3) {
      out.splice(3, 0, { ...homeAd, sponsor: homeAd.sponsor ?? { brand: homeAd.handle, shopUrl: '', affiliateId: '' } });
    }
    return out;
  }, [allCaptures, profileName, avatarUri, filter, homeAd]);

  const left = feed.filter((_, i) => i % 2 === 0);
  const right = feed.filter((_, i) => i % 2 === 1);

  const renderCard = (p: Post, i: number, col: number) => {
    const aspect = ASPECTS[(i * 2 + col + p.idx) % ASPECTS.length];
    const isLiked = !!liked[p.idx];
    return (
      <Pressable
        key={`${p.idx}-${col}-${i}`}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
        onPress={() => navigate('postDetail', { post: p })}
      >
        <View>
          <Photo uri={p.photoUri} tone={p.tone} style={[s.cardPhoto, { aspectRatio: 1 / aspect }]} />
          {p.sponsor ? (
            <View style={s.badge}><Text style={s.badgeText}>SPONSORED</Text></View>
          ) : null}
        </View>
        <Text style={s.cardCaption} numberOfLines={2}>{p.caption}</Text>
        <View style={s.cardMeta}>
          <View style={[s.ava, { backgroundColor: p.color }]}>
            <Text style={s.avaText}>{p.ava.slice(0, 2)}</Text>
          </View>
          <Text style={s.handle} numberOfLines={1}>{p.handle}</Text>
          {p.sponsor ? null : (
            <Pressable
              hitSlop={10}
              onPress={() => setLiked((m) => ({ ...m, [p.idx]: !m[p.idx] }))}
            >
              <Text style={[s.heart, isLiked && { color: colors.likeRed }]}>{isLiked ? '♥' : '♡'}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={s.headerRow}>
        <Text style={s.wordmark}>outft.</Text>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <Pressable onPress={() => navigate('messages')} hitSlop={8} style={pressDim}>
            <CommentIcon size={22} />
          </Pressable>
          <Pressable onPress={() => navigate('activity')} hitSlop={8} style={pressDim}>
            <BellIcon size={22} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Story-style row: add today's trace + streak */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storyRow}>
          <Pressable style={s.story} onPress={() => navigate('camera')}>
            <View style={[s.storyRing, !doneToday && s.storyRingOpen]}>
              <View style={s.storyInner}>
                <Text style={s.storyPlus}>{doneToday ? '✓' : '+'}</Text>
              </View>
            </View>
            <Text style={s.storyLabel}>{doneToday ? 'today' : 'your trace'}</Text>
          </Pressable>
          <Pressable style={s.story} onPress={() => navigate('profile')}>
            <View style={[s.storyRing, s.storyRingOpen]}>
              <View style={s.storyInner}>
                <Text style={s.storyNum}>{streak}</Text>
              </View>
            </View>
            <Text style={s.storyLabel}>day streak</Text>
          </Pressable>
          <Pressable style={s.story} onPress={() => navigate('twins')}>
            <View style={[s.storyRing, s.storyRingOpen]}>
              <View style={s.storyInner}><Text style={s.storyPlus}>◎</Text></View>
            </View>
            <Text style={s.storyLabel}>twins</Text>
          </Pressable>
          <Pressable style={s.story} onPress={() => navigate('dna')}>
            <View style={[s.storyRing, s.storyRingOpen]}>
              <View style={s.storyInner}><Text style={s.storyPlus}>✦</Text></View>
            </View>
            <Text style={s.storyLabel}>your DNA</Text>
          </Pressable>
        </ScrollView>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pills}>
          {FILTERS.map((f) => {
            const sel = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[s.pill, sel && { backgroundColor: colors.ink, borderColor: colors.ink }]}
              >
                <Text style={[s.pillText, sel && { color: colors.paper }]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Masonry grid */}
        {feed.length === 0 ? (
          <Text style={s.empty}>nothing here yet. try another filter</Text>
        ) : (
          <View style={s.grid}>
            <View style={s.col}>{left.map((p, i) => renderCard(p, i, 0))}</View>
            <View style={s.col}>{right.map((p, i) => renderCard(p, i, 1))}</View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
  },
  wordmark: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  storyRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 14 },
  story: { alignItems: 'center', width: 70 },
  storyRing: {
    width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  storyRingOpen: { borderColor: colors.sand },
  storyInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  storyPlus: { fontFamily: fonts.sans, fontSize: 24, color: colors.ink },
  storyNum: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
  storyLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 5 },
  pills: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  pill: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.cream,
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  grid: { flexDirection: 'row', paddingHorizontal: 8, gap: 8 },
  col: { flex: 1 },
  card: { marginBottom: 14 },
  cardPhoto: { width: '100%', borderRadius: 16 },
  cardCaption: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink, marginTop: 7, paddingHorizontal: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, paddingHorizontal: 4 },
  ava: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontFamily: fonts.sansMedium, fontSize: 8, color: colors.paper },
  handle: { flex: 1, fontFamily: fonts.sans, fontSize: 11, color: colors.taupe },
  heart: { fontSize: 18, color: colors.taupe },
  badge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(26,25,22,0.75)',
    borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8,
  },
  badgeText: { fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1.2, color: colors.paper },
  empty: { fontFamily: fonts.serifItalic, fontSize: 16, color: colors.taupe, textAlign: 'center', marginTop: 50 },
});
