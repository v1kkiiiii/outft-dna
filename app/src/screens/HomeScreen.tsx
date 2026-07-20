import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Post, postIdxFromId } from '../data';
import { LatestOutfit, useApp } from '../state';
import { Photo, pressDim, SectionLabel } from '../ui';
import { fetchMyOutfits } from '../lib/historyApi';
import { fetchPlacements, HOME_FALLBACK } from '../lib/adsApi';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Local calendar-day key (YYYY-MM-DD) for a date.
function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function captureToPost(c: LatestOutfit): Post {
  return {
    idx: postIdxFromId(c.id),
    handle: '@you',
    ava: 'EV',
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

export default function HomeScreen() {
  const hourNow = new Date().getHours();
  const greeting = hourNow < 12 ? 'Good morning' : hourNow < 18 ? 'Good afternoon' : 'Good evening';
  const { navigate, profileName, latestOutfit, captures } = useApp();
  const firstName = profileName.split(' ')[0];
  const [serverItems, setServerItems] = useState<LatestOutfit[]>([]);
  const [homeAd, setHomeAd] = useState<Post>(HOME_FALLBACK[0]);

  // Remote sponsored spotlight; fetchPlacements falls back on any error,
  // so the card always has content.
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

  // Current week, Monday through Sunday.
  const week = useMemo(() => {
    const today = new Date();
    const todayKey = dayKey(today);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return DAYS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dayKey(d);
      return { label, filled: captureDays.has(key), isToday: key === todayKey };
    });
  }, [captureDays]);

  const todayCapture = allCaptures.find((c) => {
    const d = new Date(c.capturedAt);
    return !isNaN(d.getTime()) && dayKey(d) === dayKey(new Date());
  });
  const newestCapture = todayCapture ?? allCaptures[0];
  const insight = latestOutfit?.result.insight;

  // Streak number springs in on mount.
  const streakAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(streakAnim, {
      toValue: 1, friction: 5, tension: 60, useNativeDriver: true,
    }).start();
  }, [streakAnim]);

  const inviteFriends = () => {
    Share.share({ message: 'tracing my style DNA on OUTFT — join me' }).catch(() => {});
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.wordmark}>outft.</Text>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Pressable onPress={() => navigate('messages')} hitSlop={8} style={pressDim}>
            <Text style={s.headerGlyph}>▤</Text>
          </Pressable>
          <Pressable onPress={() => navigate('activity')} hitSlop={8} style={pressDim}>
            <Text style={s.headerGlyph}>◈</Text>
          </Pressable>
        </View>
      </View>

      {/* Greeting */}
      <Text style={s.h1}>{greeting}, {firstName}.</Text>
      <Text style={s.h1Italic}>Your trace continues.</Text>

      {/* Streak card */}
      <Pressable style={({ pressed }) => [s.streakCard, pressed && { transform: [{ scale: 0.97 }] }]} onPress={() => navigate('profile')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Animated.Text style={[s.streakNum, { transform: [{ scale: streakAnim }], opacity: streakAnim }]}>{streak}</Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={s.streakLabel}>Day streak</Text>
            <Text style={s.streakSub}>
              {allCaptures.length === 0
                ? 'capture your first trace to start a streak'
                : streak === 0
                  ? 'start again — the record keeps everything'
                  : 'capture today to keep it alive'}
            </Text>
          </View>
        </View>
        <View style={s.daysRow}>
          {week.map((d, i) => {
            if (d.isToday) {
              return (
                <Pressable
                  key={i}
                  style={[s.dayCircle, s.dayToday, d.filled && s.dayFilled]}
                  onPress={() => navigate('camera')}
                >
                  <Text style={[s.dayText, d.filled && { color: colors.paper }]}>{d.label}</Text>
                </Pressable>
              );
            }
            if (d.filled) {
              return (
                <View key={i} style={[s.dayCircle, s.dayFilled]}>
                  <Text style={[s.dayText, { color: colors.paper }]}>{d.label}</Text>
                </View>
              );
            }
            return (
              <View key={i} style={[s.dayCircle, s.dayFuture]}>
                <Text style={[s.dayText, { color: colors.faint }]}>{d.label}</Text>
              </View>
            );
          })}
        </View>
      </Pressable>

      {/* Today's trace */}
      <SectionLabel style={{ marginTop: 30, marginBottom: 12 }}>
        {todayCapture || !newestCapture ? "TODAY'S TRACE" : 'LATEST TRACE'}
      </SectionLabel>
      {newestCapture ? (
        <Pressable style={pressDim} onPress={() => navigate('postDetail', { post: captureToPost(newestCapture) })}>
          <Photo uri={newestCapture.photoUri} tone="#DFDFDF" style={s.todayPhoto} />
          <View style={s.todayBar}>
            <Text style={s.todayBarText}>
              {(todayCapture ? "Today's trace · " : 'Latest trace · ')
                + new Date(newestCapture.capturedAt).toLocaleDateString()}
            </Text>
            <Pressable onPress={() => navigate('camera')} hitSlop={10}>
              <Text style={{ fontSize: 14, color: colors.ink }}>✎</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : (
        <View style={s.emptyTrace}>
          <Text style={s.emptyTraceText}>No trace yet today.</Text>
          <Pressable style={({ pressed }) => [s.emptyTracePill, pressed && { transform: [{ scale: 0.97 }] }]} onPress={() => navigate('camera')}>
            <Text style={s.emptyTracePillText}>CAPTURE YOUR FIRST TRACE</Text>
          </Pressable>
        </View>
      )}

      {/* Insight card — only when a real insight exists */}
      {insight ? (
        <View style={s.insightCard}>
          <Text style={s.insightText}>{insight}</Text>
        </View>
      ) : null}

      {/* Brand spotlight — one sponsored slot per style lane, served from
          sponsored_placements (surface 'home') with a hardcoded fallback. */}
      <View style={s.sponsorCard}>
        <Text style={s.sponsorLabel}>SPONSORED · {homeAd.dna.toUpperCase()}</Text>
        <Text style={s.sponsorBrand}>{homeAd.handle}</Text>
        <Text style={s.sponsorCopy}>{homeAd.caption}</Text>
      </View>

      {/* Friends */}
      <SectionLabel style={{ marginTop: 32, marginBottom: 12 }}>FRIENDS</SectionLabel>
      <View style={s.friendsCard}>
        <Text style={s.friendsCopy}>
          OUTFT is better with friends. Invite yours — their traces will appear here.
        </Text>
        <Pressable style={({ pressed }) => [s.invitePill, pressed && { transform: [{ scale: 0.97 }] }]} onPress={inviteFriends}>
          <Text style={s.invitePillText}>INVITE FRIENDS</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  headerGlyph: { fontSize: 17, color: colors.ink },
  h1: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, marginTop: 22 },
  h1Italic: { fontFamily: fonts.serifItalic, fontSize: 28, color: colors.ink },
  streakCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginTop: 22 },
  streakNum: { fontFamily: fonts.serif, fontSize: 44, color: colors.ink },
  streakLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  streakSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.sand, marginTop: 2 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayFilled: { backgroundColor: colors.ink },
  dayToday: { borderWidth: 1.5, borderColor: colors.ink },
  dayFuture: { borderWidth: 1, borderColor: colors.line },
  dayText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.ink },
  todayPhoto: { width: '100%', height: 200, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  todayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cream, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  todayBarText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  emptyTrace: {
    backgroundColor: colors.cream, borderRadius: 12, paddingVertical: 36,
    paddingHorizontal: 20, alignItems: 'center',
  },
  emptyTraceText: { fontFamily: fonts.serifItalic, fontSize: 17, color: colors.ink },
  emptyTracePill: {
    marginTop: 16, borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  emptyTracePillText: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.5, color: colors.ink },
  insightCard: { backgroundColor: colors.cream, borderRadius: 12, padding: 18, marginTop: 24 },
  insightText: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 22, color: colors.ink },
  sponsorCard: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 12,
    padding: 16, marginTop: 14,
  },
  sponsorLabel: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.5, color: colors.sand, marginBottom: 6 },
  sponsorBrand: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  sponsorCopy: { fontFamily: fonts.sans, fontSize: 12, color: colors.taupe, marginTop: 3 },
  friendsCard: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center',
  },
  friendsCopy: {
    fontFamily: fonts.serifItalic, fontSize: 16, lineHeight: 24,
    color: colors.ink, textAlign: 'center',
  },
  invitePill: {
    marginTop: 18, borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  invitePillText: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.5, color: colors.ink },
});
