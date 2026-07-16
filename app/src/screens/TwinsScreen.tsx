import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { colors, dnaColors, fonts } from '../theme';
import { BRAND_PICKS } from '../data';
import { LatestOutfit, useApp } from '../state';
import { computeDna, fetchMyOutfits } from '../lib/historyApi';
import { DnaWheel, Photo, Rule, SectionLabel } from '../ui';

const EMPTY_WHEEL = [
  { label: 'unknown', pct: 40 },
  { label: 'unknown', pct: 30 },
  { label: 'unknown', pct: 20 },
  { label: 'unknown', pct: 10 },
];

export default function TwinsScreen() {
  const { navigate, captures } = useApp();
  const [serverItems, setServerItems] = useState<LatestOutfit[]>([]);

  // Best-effort server history; offline or signed-out we keep local captures.
  useEffect(() => {
    let cancelled = false;
    fetchMyOutfits().then((r) => {
      if (!cancelled && r.ok && r.items.length > 0) setServerItems(r.items);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const merged = useMemo(() => {
    const localIds = new Set(captures.map((c) => c.id));
    return [...captures, ...serverItems.filter((i) => !localIds.has(i.id))];
  }, [captures, serverItems]);

  const dna = useMemo(() => computeDna(merged), [merged]);
  const hasDna = dna.length > 0;
  const top3 = dna.slice(0, 3);

  // Sponsored picks ordered by how well their tags match the user's real top aesthetic.
  const picks = useMemo(() => {
    if (!hasDna) return BRAND_PICKS;
    const topLabels = dna.map((d) => d.label.toLowerCase());
    const score = (p: (typeof BRAND_PICKS)[number]) => {
      let s = 0;
      p.tags.forEach((t) => {
        const tag = t.toLowerCase();
        topLabels.forEach((label, i) => {
          if (label.includes(tag) || tag.includes(label)) s += topLabels.length - i;
        });
      });
      return s;
    };
    return [...BRAND_PICKS].sort((a, b) => score(b) - score(a));
  }, [dna, hasDna]);

  const invite = async () => {
    try {
      await Share.share({
        message: 'Trace your fashion DNA with me on OUTFT — every outfit, analyzed. Your closest style twins appear as the community grows.',
      });
    } catch {}
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
      {/* Your DNA card — real analyses only */}
      <Pressable style={s.dnaCard} onPress={() => navigate('dna')}>
        <View style={s.rowBetween}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.ink }}>Your DNA</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.faint }}>View full trace</Text>
        </View>
        {hasDna ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <DnaWheel data={dna} size={130} />
            <View style={{ flex: 1, marginLeft: 16, gap: 10 }}>
              {top3.map((d, i) => (
                <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dnaColors[i % dnaColors.length], marginRight: 8 }} />
                  <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.muted }}>{d.label}</Text>
                  <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.ink }}>{d.pct}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View style={{ opacity: 0.25 }}>
              <DnaWheel data={EMPTY_WHEEL} size={130} />
            </View>
            <Text style={{ flex: 1, marginLeft: 16, fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 22, color: colors.muted }}>
              Your DNA forms after your first trace.
            </Text>
          </View>
        )}
      </Pressable>

      {/* Wrapped banner */}
      <Pressable style={s.wrappedBanner} onPress={() => navigate('wrapped')}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.paper }}>Your wrapped</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.faint, marginTop: 4 }}>June in silhouettes, palettes, and echoes</Text>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 40, color: colors.paper }}>06</Text>
      </Pressable>

      {/* Hero */}
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 36, color: colors.ink, textAlign: 'center' }}>Your twins</Text>
      </View>

      {/* Echoes — honest empty state until real social ships */}
      <SectionLabel style={{ marginTop: 24 }}>ECHOES</SectionLabel>
      <View style={s.echoCard}>
        <Text style={{ fontFamily: fonts.serifItalic, fontSize: 17, lineHeight: 26, color: colors.ink, textAlign: 'center' }}>
          Echoes are people whose style matches yours. As the OUTFT community grows, your closest style twins appear here.
        </Text>
        <Rule style={{ width: 40, marginVertical: 18, alignSelf: 'center' }} />
        <Pressable onPress={invite} style={s.invitePill}>
          <Text style={s.inviteText}>INVITE FRIENDS</Text>
        </Pressable>
      </View>

      {/* Sponsored picks — clearly labeled */}
      <SectionLabel style={{ marginTop: 32 }}>CURATED FOR YOUR DNA</SectionLabel>
      <View style={s.grid}>
        {picks.map((p) => (
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
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dnaCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginTop: 16 },
  wrappedBanner: {
    backgroundColor: colors.ink, borderRadius: 12, padding: 16, marginTop: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  echoCard: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    paddingVertical: 26, paddingHorizontal: 24, marginTop: 12,
  },
  invitePill: {
    borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 26, alignSelf: 'center',
  },
  inviteText: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, marginTop: 12 },
  pctBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.paper,
    borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8,
  },
  sponsorTag: { fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1, color: colors.sand, marginTop: 5 },
});
