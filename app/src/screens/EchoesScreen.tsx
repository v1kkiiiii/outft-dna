import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { BRAND_PICKS, Post, postIdxFromId } from '../data';
import { useApp } from '../state';
import { backendAvailable } from '../lib/supabase';
import { findSimilarOutfits, SimilarMatch } from '../lib/similarApi';
import { fetchPlacements } from '../lib/adsApi';
import { Header, Photo, SectionLabel } from '../ui';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Find similar" destination for a single post: echoes (style-similar traces —
// not necessarily people you follow, same honesty policy as TwinsScreen) plus
// sponsored picks matched to this specific look. Distinct from TwinsScreen,
// which is the account-wide "your DNA + echoes" home rather than one post's.
export default function EchoesScreen() {
  const { params, goBack, navigate, captures, avatarUri, profileName } = useApp();
  const post = params.post;
  const serverId = (post as { serverId?: string } | undefined)?.serverId;
  const canQuery = !!post && !!serverId && UUID_RE.test(serverId) && backendAvailable();

  const [loading, setLoading] = useState(canQuery);
  const [matches, setMatches] = useState<SimilarMatch[] | null>(null);
  const [picks, setPicks] = useState<Post[]>(BRAND_PICKS);

  useEffect(() => {
    let cancelled = false;
    fetchPlacements('twins').then((p) => {
      if (!cancelled) setPicks(p);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!canQuery || !serverId) return;
    let cancelled = false;
    findSimilarOutfits(serverId).then((r) => {
      if (!cancelled) setMatches(r.ok ? r.matches : []);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, canQuery]);

  const echoPosts: (Post & { why: string; serverId: string })[] = (matches ?? [])
    .map((m): (Post & { why: string; serverId: string }) | null => {
      const c = captures.find((cap) => cap.id === m.outfitId);
      if (!c) return null;
      return {
        idx: postIdxFromId(c.id), handle: '@you', ava: profileName.slice(0, 2).toUpperCase(), avatarUri,
        color: '#CDB89B', date: new Date(c.capturedAt).toLocaleDateString(),
        caption: c.caption ?? c.result.insight, tags: c.result.tags.slice(0, 2), likes: 0,
        dna: c.result.insight, tone: '#DFDFDF', photoUri: c.photoUri,
        why: m.why, serverId: c.id,
      };
    })
    .filter((p): p is Post & { why: string; serverId: string } => p !== null);

  const relevantPicks = post
    ? [...picks].sort((a, b) => {
        const score = (p: Post) => p.tags.reduce((s, t) => s + (post.tags.some((pt) => pt.toLowerCase() === t.toLowerCase()) ? 1 : 0), 0);
        return score(b) - score(a);
      })
    : picks;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="Echoes" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <Text style={s.intro}>
          Echoes are traces whose style matches this one — not necessarily people you follow. As the OUTFT community grows, echoes from across all of OUTFT appear here too.
        </Text>

        <SectionLabel style={{ marginTop: 24 }}>ECHOES FOR THIS LOOK</SectionLabel>
        {!canQuery ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Echoes are available for your own traced outfits.</Text>
          </View>
        ) : loading ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>finding echoes…</Text>
          </View>
        ) : echoPosts.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No close echoes yet. Trace a few more outfits and check back.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 14 }}>
            {echoPosts.map((p) => (
              <Pressable key={p.serverId} style={s.echoRow} onPress={() => navigate('postDetail', { post: p })}>
                <Photo uri={p.photoUri} tone={p.tone} style={{ width: 64, height: 80, borderRadius: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.echoWhy}>{p.why}</Text>
                  <Text style={s.echoMeta}>{p.date}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <SectionLabel style={{ marginTop: 32 }}>PICKS FOR THIS LOOK</SectionLabel>
        <View style={s.grid}>
          {relevantPicks.map((p) => (
            <Pressable key={p.idx} style={{ width: '48%' }} onPress={() => navigate('postDetail', { post: p })}>
              <Photo tone={p.tone} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
              <View style={s.pctBadge}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10, color: colors.taupe }}>{p.handle}</Text>
              </View>
              <Text style={s.sponsorTag}>SPONSORED</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  intro: {
    fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 8,
  },
  emptyCard: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    paddingVertical: 26, paddingHorizontal: 20, marginTop: 12, alignItems: 'center',
  },
  emptyText: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.muted, textAlign: 'center' },
  echoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  echoWhy: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.ink, lineHeight: 19 },
  echoMeta: { fontFamily: fonts.sans, fontSize: 10, color: colors.faint, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, marginTop: 12 },
  pctBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.paper,
    borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8,
  },
  sponsorTag: { fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1, color: colors.sand, marginTop: 5 },
});
