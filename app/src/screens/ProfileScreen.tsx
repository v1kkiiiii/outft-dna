import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../theme';
import { LatestOutfit, useApp } from '../state';
import { fetchMyOutfits } from '../lib/historyApi';
import { BADGES, CATEGORIES, Post } from '../data';
import { Photo, PillButton, Polaroid, SectionLabel, Tag } from '../ui';

const TABS = ['Trace', 'Saves', 'Backlog', 'Badges'] as const;
type TabKey = (typeof TABS)[number];

const BOARD_NAMES = ['Night out', 'Work', 'Gym', 'Inspo'];
const BADGE_GLYPHS = ['✦', '◆', '○', '◇', '✧', '★'];
const GROUPINGS = ['occasions', 'months'] as const;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toDateString();
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())}.${String(d.getFullYear()).slice(2)}`;
}

// Consecutive-day streak ending today or yesterday, from real capture dates.
function computeStreak(items: LatestOutfit[]): number {
  const days = new Set(
    items
      .map((i) => new Date(i.capturedAt))
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()),
  );
  if (days.size === 0) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  let cursor = days.has(today) ? today : days.has(today - DAY) ? today - DAY : NaN;
  if (isNaN(cursor)) return 0;
  let n = 0;
  while (days.has(cursor)) { n += 1; cursor -= DAY; }
  return n;
}

export default function ProfileScreen() {
  const { navigate, showToast, update, latestOutfit, streak, profileName, avatarUri, coverUri, captures, savedPosts } = useApp();
  const [tab, setTab] = useState<TabKey>('Trace');
  const [grouping, setGrouping] = useState<(typeof GROUPINGS)[number]>('occasions');
  const [serverItems, setServerItems] = useState<LatestOutfit[]>([]);

  // Quiet background sync: if the backend is reachable and returns outfits,
  // surface them; otherwise nothing changes visually.
  useEffect(() => {
    let cancelled = false;
    fetchMyOutfits().then((r) => {
      if (!cancelled && r.ok && r.items.length > 0) setServerItems(r.items);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const localIds = new Set(captures.map((c) => c.id));
  const syncedItems = serverItems.filter((i) => !localIds.has(i.id));

  const captureToPost = (c: LatestOutfit): Post => ({
    idx: Number(c.id) || 0, handle: '@you', ava: 'EV', color: '#CDB89B',
    date: new Date(c.capturedAt).toLocaleDateString(),
    caption: c.caption ?? c.result.insight,
    tags: c.result.tags.slice(0, 2), likes: 0, dna: c.result.insight,
    tone: '#DFDFDF', photoUri: c.photoUri,
    serverId: c.id,
  } as Post & { serverId: string });

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('photo permission needed'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1],
    });
    if (!r.canceled && r.assets[0]) {
      update({ avatarUri: r.assets[0].uri });
      showToast('profile photo updated');
    }
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('photo permission needed'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [3, 2],
    });
    if (!r.canceled && r.assets[0]) {
      update({ coverUri: r.assets[0].uri });
      showToast('cover updated');
    }
  };

  // Real merged history (local captures + server items, deduped by id).
  const merged = useMemo(
    () => [...captures, ...serverItems.filter((i) => !captures.some((c) => c.id === i.id))],
    [captures, serverItems],
  );

  const { totalFits, daysCaptured, stylesFound, realStreak, tracingSince } = useMemo(() => {
    const days = new Set(merged.map((i) => dayKey(i.capturedAt)));
    const styles = new Set<string>();
    for (const i of merged) for (const a of i.result.aesthetics) if (a.pct > 0) styles.add(a.label);
    const timed = merged
      .map((i) => ({ i, t: new Date(i.capturedAt).getTime() }))
      .filter((x) => !isNaN(x.t))
      .sort((a, b) => a.t - b.t);
    return {
      totalFits: merged.length,
      daysCaptured: days.size,
      stylesFound: styles.size,
      realStreak: computeStreak(merged),
      tracingSince: timed.length > 0 ? fmtShortDate(timed[0].i.capturedAt) : null,
    };
  }, [merged]);

  // Latest real analysis (newest capture with any tags or aesthetics).
  const latestAnalysis = useMemo(() => {
    const sorted = [...merged].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    );
    return (
      sorted.find((i) => i.result.tags.length > 0 || i.result.aesthetics.length > 0) ??
      (latestOutfit && (latestOutfit.result.tags.length > 0 || latestOutfit.result.aesthetics.length > 0)
        ? latestOutfit
        : null)
    );
  }, [merged, latestOutfit]);

  const savedFlat = Object.values(savedPosts).flat();

  // Backlog groupings from real items only.
  const byCategory = useMemo(() => {
    const map = new Map<string, LatestOutfit[]>();
    for (const i of merged) {
      const key = i.category || 'daily';
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map.entries()];
  }, [merged]);

  const byMonth = useMemo(() => {
    const map = new Map<string, LatestOutfit[]>();
    for (const i of merged) {
      const d = new Date(i.capturedAt);
      const key = isNaN(d.getTime())
        ? 'Undated'
        : d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map.entries()];
  }, [merged]);

  // Badges computed from real data only.
  const badgeStates = useMemo(() => {
    const hourOf = (iso: string) => new Date(iso).getHours();
    const categoriesUsed = new Set(merged.map((i) => i.category || 'daily'));
    const tagCount = (t: string) =>
      merged.filter((i) => i.result.tags.some((x) => x.toLowerCase().includes(t))).length;
    const earned: Record<string, boolean> = {
      'Early Bird': merged.some((i) => {
        const h = hourOf(i.capturedAt);
        return !isNaN(h) && h >= 7 && h < 11;
      }),
      'Gym Warrior': merged.filter((i) => (i.category || '').toLowerCase() === 'gym').length >= 10,
      'Minimalist Master': tagCount('minimal') >= 15,
      'Fashion Explorer': categoriesUsed.size >= 3,
      'Vintage Collector': tagCount('vintage') >= 8,
      'Trend Setter': false, // echoes aren't tracked yet — stays locked
    };
    return BADGES.map((b) => ({ ...b, unlocked: earned[b.name] ?? false }));
  }, [merged]);
  const unlockedCount = badgeStates.filter((b) => b.unlocked).length;

  const catLabel = (key: string) => CATEGORIES.find((c) => c.key === key)?.label ?? key;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Cover */}
      <View style={{ height: 240 }}>
        <Pressable onPress={pickCover}>
          <Photo uri={coverUri ?? latestOutfit?.photoUri} tone="#C4B098" style={{ width: '100%', height: 240 }} />
          <View style={st.coverEditHint}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1, color: colors.paper }}>EDIT COVER</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => navigate('settings')}
          hitSlop={12}
          style={{ position: 'absolute', top: 54, right: 22 }}
        >
          <Text style={{ fontSize: 20, color: colors.paper }}>☰</Text>
        </Pressable>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <View style={{ height: 18, backgroundColor: colors.paper, opacity: 0.25 }} />
          <View style={{ height: 16, backgroundColor: colors.paper, opacity: 0.55 }} />
          <View style={{ height: 14, backgroundColor: colors.paper, opacity: 0.85 }} />
        </View>
      </View>

      {/* Avatar + name */}
      <View style={{ alignItems: 'center', marginTop: -44, paddingHorizontal: 22 }}>
        <Pressable onPress={pickAvatar} style={st.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={st.avatarImg} />
          ) : (
            <View style={[st.avatarImg, { backgroundColor: '#CDB89B', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 22, color: colors.ink }}>
                {profileName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={st.avatarEdit}>
            <Text style={{ fontSize: 11, color: colors.paper }}>+</Text>
          </View>
        </Pressable>
        <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: colors.ink }}>{profileName}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.sand, marginTop: 4 }}>
          {tracingSince ? `TRACING SINCE ${tracingSince}` : 'JUST STARTED'}
        </Text>
      </View>

      {/* Stats strip — real data only */}
      <View style={st.stats}>
        <StatCell num={String(totalFits)} label="outfits traced" />
        <View style={st.statDiv} />
        <StatCell num={String(daysCaptured)} label="days captured" />
        <View style={st.statDiv} />
        <StatCell num={String(stylesFound)} label="styles found" />
        <View style={st.statDiv} />
        <StatCell num={String(realStreak)} label="day streak" />
      </View>

      {/* Sub-tabs */}
      <View style={st.tabRow}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.tabBtn, tab === t && st.tabBtnActive]}>
            <Text style={[st.tabText, tab === t && { color: colors.ink }]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Trace' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24, gap: 18 }}>
          <SectionLabel>YOUR SIGNATURE TRACE</SectionLabel>
          {latestAnalysis ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(latestAnalysis.result.tags.length > 0
                ? latestAnalysis.result.tags
                : latestAnalysis.result.aesthetics.map((a) => a.label)
              ).slice(0, 3).map((t) => <Tag key={t} label={t} />)}
            </View>
          ) : (
            <>
              <Text style={{ fontFamily: fonts.serifItalic, fontSize: 16, color: colors.ink }}>
                Your signature trace appears after your first capture.
              </Text>
              <PillButton label="CAPTURE YOUR FIRST FIT" onPress={() => navigate('camera')} />
            </>
          )}

          <Pressable onPress={() => navigate('camera')} style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.ink }}>{realStreak}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, flex: 1 }}>
              day streak · capture today to keep it alive
            </Text>
          </Pressable>

          <PillButton label="EXPLORE FULL ARCHIVE" onPress={() => setTab('Backlog')} />

          <Pressable onPress={() => navigate('dna')} style={st.miniRow}>
            <Text style={st.miniRowText}>Fashion DNA</Text>
            <Text style={{ fontSize: 16, color: colors.sand }}>›</Text>
          </Pressable>

          <Pressable onPress={() => navigate('premium')} style={st.premiumBanner}>
            <View style={{ flex: 1 }}>
              <Text style={st.premiumKicker}>UNLOCK</Text>
              <Text style={st.premiumTitle}>DNA Premium</Text>
              <Text style={st.premiumCopy}>Deeper trends, unlimited archive, monthly reports</Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.paper }}>›</Text>
          </Pressable>
        </View>
      )}

      {tab === 'Saves' && (
        <View style={{ paddingTop: 2 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingVertical: 12 }}>
            {BOARD_NAMES.map((name) => (
              <Pressable
                key={name}
                onPress={() => navigate('collection', { collectionName: name })}
                style={st.boardChip}
              >
                <Text style={st.boardChipText}>
                  {name} · {(savedPosts[name] ?? []).length}
                </Text>
              </Pressable>
            ))}
          </View>
          {savedFlat.length === 0 ? (
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 16, color: colors.ink, textAlign: 'center', paddingHorizontal: 22, paddingVertical: 40 }}>
              Nothing saved yet. Bookmark looks you love.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {savedFlat.map((p) => (
                <Pressable
                  key={`s-${p.idx}`}
                  style={st.gridTile}
                  onPress={() => navigate('postDetail', { post: p })}
                >
                  <Photo uri={p.photoUri} tone={p.tone} style={{ width: '100%', height: '100%' }} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {tab === 'Backlog' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {GROUPINGS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGrouping(g)}
                style={[st.groupPill, grouping === g && { backgroundColor: colors.ink, borderColor: colors.ink }]}
              >
                <Text style={[st.groupPillText, grouping === g && { color: colors.paper }]}>{g.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.sand, marginTop: 12 }}>
            {grouping} rows · {totalFits} fits traced
          </Text>
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 15, color: colors.ink, marginTop: 12, marginBottom: 8 }}>
            Your wear archive. Every outfit becomes evidence of a style in motion.
          </Text>

          {syncedItems.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionLabel>SYNCED</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
                {syncedItems.map((c, j) => (
                  <Polaroid
                    key={c.id}
                    width={96}
                    uri={c.photoUri || undefined}
                    tiltIndex={j}
                    meta={new Date(c.capturedAt).toLocaleDateString()}
                    number={c.caption ?? c.result.tags[0] ?? c.category}
                    onPress={() => navigate('postDetail', { post: captureToPost(c) })}
                  />
                ))}
              </View>
            </View>
          )}

          {captures.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <SectionLabel>Your captures</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
                {captures.map((c, j) => (
                  <Polaroid
                    key={c.id}
                    width={96}
                    uri={c.photoUri}
                    tiltIndex={j}
                    meta={new Date(c.capturedAt).toLocaleDateString()}
                    number={c.caption ?? c.result.tags[0]}
                    onPress={() => navigate('postDetail', { post: captureToPost(c) })}
                  />
                ))}
              </View>
            </View>
          )}

          {merged.length === 0 && (
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 16, color: colors.ink, marginTop: 28, textAlign: 'center' }}>
              No captures yet. Your archive starts with one fit.
            </Text>
          )}

          {grouping === 'occasions' && byCategory.map(([key, items]) => (
            <View key={key} style={{ marginTop: 22 }}>
              <SectionLabel>{catLabel(key)}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                {items.map((c, j) => (
                  <Polaroid
                    key={c.id}
                    width={82}
                    uri={c.photoUri || undefined}
                    tiltIndex={j}
                    meta={new Date(c.capturedAt).toLocaleDateString()}
                    number={c.caption ?? c.result.tags[0] ?? catLabel(key)}
                    onPress={() => navigate('postDetail', { post: captureToPost(c) })}
                  />
                ))}
              </View>
            </View>
          ))}

          {grouping === 'months' && byMonth.map(([month, items]) => (
            <View key={month} style={{ marginTop: 22 }}>
              <SectionLabel>{month}</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
                {items.map((c, j) => (
                  <Polaroid
                    key={c.id}
                    width={96}
                    uri={c.photoUri || undefined}
                    tiltIndex={j}
                    meta={new Date(c.capturedAt).toLocaleDateString()}
                    number={c.caption ?? c.result.tags[0] ?? catLabel(c.category)}
                    onPress={() => navigate('postDetail', { post: captureToPost(c) })}
                  />
                ))}
              </View>
            </View>
          ))}

          <Pressable onPress={() => navigate('premium')} style={st.lockRow}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.sand }}>
              Unlock full archive · premium only
            </Text>
          </Pressable>
        </View>
      )}

      {tab === 'Badges' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.sand, textAlign: 'center' }}>
            {unlockedCount} of {badgeStates.length} unlocked
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 18 }}>
            {badgeStates.map((b, i) => (
              <Pressable
                key={b.name}
                onPress={() => showToast(b.unlocked ? b.desc : `Locked · ${b.desc}`)}
                style={[st.badgeCard, !b.unlocked && { borderStyle: 'dashed', opacity: 0.5 }]}
              >
                <View style={st.badgeCircle}>
                  <Text style={{ fontSize: 18, color: colors.ink }}>{BADGE_GLYPHS[i % BADGE_GLYPHS.length]}</Text>
                </View>
                <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.ink, marginTop: 10, textAlign: 'center' }}>
                  {b.name}
                </Text>
                {!b.unlocked && (
                  <Text style={{ fontFamily: fonts.sans, fontSize: 9, color: colors.sand, marginTop: 4, textAlign: 'center' }}>
                    {b.desc}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function StatCell({ num, label, onPress }: { num: string; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.ink }}>{num}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1.2, color: colors.sand, textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  stats: {
    flexDirection: 'row', alignItems: 'center', marginTop: 22,
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  statDiv: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line },
  tabRow: { flexDirection: 'row', paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.ink },
  tabText: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.faint },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 15 },
  miniRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  miniRowText: { fontFamily: fonts.serif, fontSize: 16, color: colors.ink },
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink,
    borderRadius: 12, padding: 16, marginTop: 4,
  },
  premiumKicker: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: '#B4A898' },
  premiumTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.paper, marginTop: 2 },
  premiumCopy: { fontFamily: fonts.sans, fontSize: 11, color: '#CFC7BC', marginTop: 3 },
  coverEditHint: {
    position: 'absolute', top: 54, left: 22, backgroundColor: 'rgba(26,25,22,0.4)',
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10,
  },
  avatarWrap: { marginBottom: 10 },
  avatarImg: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: colors.paper },
  avatarEdit: {
    position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.paper,
  },
  boardChip: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  boardChipText: { fontFamily: fonts.sans, fontSize: 10, color: colors.taupe },
  gridTile: { width: '33.05%', aspectRatio: 1, margin: '0.14%', backgroundColor: colors.cream },
  groupPill: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  groupPillText: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.5, color: colors.taupe },
  lockRow: {
    marginTop: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.tagBorder,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  badgeCard: {
    width: '48%', borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 14,
  },
  badgeCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F7F7',
    alignItems: 'center', justifyContent: 'center',
  },
});
