import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, dnaColors, fonts } from '../theme';
import { DNA_DEFAULT } from '../data';
import { LatestOutfit, useApp } from '../state';
import { computeDna, fetchMyOutfits } from '../lib/historyApi';
import { DnaWheel, Header, SectionLabel } from '../ui';

const DELTAS = [
  { label: 'Structured silhouette', delta: '+8%', positive: true },
  { label: 'Dark neutral palette', delta: '+5%', positive: true },
  { label: 'Coastal softness', delta: '−3%', positive: false },
];

export default function DnaScreen() {
  const { goBack, navigate, latestOutfit, captures } = useApp();
  const [serverItems, setServerItems] = useState<LatestOutfit[]>([]);

  // Best-effort server history; offline or signed-out we keep the fallback.
  useEffect(() => {
    let cancelled = false;
    fetchMyOutfits().then((r) => {
      if (!cancelled && r.ok && r.items.length > 0) setServerItems(r.items);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Server items + local captures, deduped by id, newest first from each source.
  const merged = useMemo(() => {
    const localIds = new Set(captures.map((c) => c.id));
    return [...captures, ...serverItems.filter((i) => !localIds.has(i.id))];
  }, [captures, serverItems]);

  const realDna = useMemo(() => computeDna(merged), [merged]);
  const analysisCount = useMemo(
    () => merged.filter((i) => i.result.aesthetics.some((a) => a.pct > 0)).length,
    [merged],
  );
  const dna = realDna.length > 0 ? realDna : (latestOutfit?.result.aesthetics ?? DNA_DEFAULT);

  const rows: { label: string; go: () => void }[] = [
    { label: 'ft. twin · @lenav — 94% echo · closest style match', go: () => navigate('twins') },
    { label: 'May wrapped', go: () => navigate('wrapped') },
    { label: 'Advanced analytics · premium only', go: () => navigate('premium') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="Fashion DNA" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <DnaWheel data={dna} size={180} />
        </View>

        {realDna.length > 0 && analysisCount < 5 && (
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <SectionLabel>
              {`EARLY DNA · BASED ON ${analysisCount} OUTFIT${analysisCount === 1 ? '' : 'S'}`}
            </SectionLabel>
          </View>
        )}

        <View style={{ marginTop: 24, gap: 12 }}>
          {dna.map((d, i) => (
            <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dnaColors[i % dnaColors.length], marginRight: 10 }} />
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.muted }}>{d.label}</Text>
              <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.ink }}>{d.pct}%</Text>
            </View>
          ))}
        </View>

        <View style={s.proofCard}>
          <SectionLabel>WEEKLY DNA CHANGE</SectionLabel>
          <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.ink, marginTop: 10 }}>
            Your silhouette became 8% more structured.
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 8 }}>
            Compared with last week, your trace shows more tailoring and less drape.
          </Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            {DELTAS.map((d) => (
              <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.muted }}>{d.label}</Text>
                <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: d.positive ? colors.ink : colors.sand }}>{d.delta}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          {rows.map((r) => (
            <Pressable key={r.label} style={s.miniRow} onPress={r.go}>
              <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.ink, marginRight: 12 }}>{r.label}</Text>
              <Text style={{ fontSize: 16, color: colors.sand }}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  proofCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginTop: 28 },
  miniRow: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
});
