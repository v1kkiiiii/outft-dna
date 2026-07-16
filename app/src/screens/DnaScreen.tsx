import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, dnaColors, fonts } from '../theme';
import { LatestOutfit, useApp } from '../state';
import { computeDna, fetchMyOutfits } from '../lib/historyApi';
import { DnaWheel, Header, SectionLabel } from '../ui';

const EMPTY_WHEEL = [
  { label: 'unknown', pct: 40 },
  { label: 'unknown', pct: 30 },
  { label: 'unknown', pct: 20 },
  { label: 'unknown', pct: 10 },
];

export default function DnaScreen() {
  const { goBack, navigate, captures } = useApp();
  const [serverItems, setServerItems] = useState<LatestOutfit[]>([]);

  // Best-effort server history; offline or signed-out we keep local captures.
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

  const dna = useMemo(() => computeDna(merged), [merged]);
  const hasDna = dna.length > 0;

  const analyzed = useMemo(
    () => merged.filter((i) => i.result.aesthetics.some((a) => a.pct > 0)),
    [merged],
  );
  const analysisCount = analyzed.length;

  // Weekly change: only when ≥2 real analyses. Sort by capture time, split
  // into oldest and newest halves, compare the top label's share.
  const change = useMemo(() => {
    if (analyzed.length < 2) return null;
    const sorted = [...analyzed].sort((a, b) => (a.capturedAt ?? '').localeCompare(b.capturedAt ?? ''));
    const mid = Math.floor(sorted.length / 2);
    const oldDna = computeDna(sorted.slice(0, mid));
    const newDna = computeDna(sorted.slice(mid));
    if (oldDna.length === 0 || newDna.length === 0) return null;
    const topLabel = newDna[0].label;
    const before = oldDna.find((d) => d.label === topLabel)?.pct ?? 0;
    const delta = newDna[0].pct - before;
    if (delta === 0) return null;
    return { label: topLabel, delta };
  }, [analyzed]);

  const rows: { label: string; go: () => void }[] = [
    { label: `${new Date().toLocaleDateString(undefined, { month: 'long' })} wrapped`, go: () => navigate('wrapped') },
    { label: 'Advanced analytics · premium only', go: () => navigate('premium') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="Fashion DNA" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          {hasDna ? (
            <DnaWheel data={dna} size={180} />
          ) : (
            <View style={{ opacity: 0.25 }}>
              <DnaWheel data={EMPTY_WHEEL} size={180} />
            </View>
          )}
        </View>

        {!hasDna && (
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 18 }}>
            Your DNA forms after your first trace.
          </Text>
        )}

        {hasDna && analysisCount < 5 && (
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <SectionLabel>
              {`EARLY DNA · BASED ON ${analysisCount} OUTFIT${analysisCount === 1 ? '' : 'S'}`}
            </SectionLabel>
          </View>
        )}

        {hasDna && (
          <View style={{ marginTop: 24, gap: 12 }}>
            {dna.map((d, i) => (
              <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dnaColors[i % dnaColors.length], marginRight: 10 }} />
                <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.muted }}>{d.label}</Text>
                <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.ink }}>{d.pct}%</Text>
              </View>
            ))}
          </View>
        )}

        {change && (
          <View style={s.proofCard}>
            <SectionLabel>WEEKLY DNA CHANGE</SectionLabel>
            <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.ink, marginTop: 10 }}>
              {change.delta > 0
                ? `${change.label} rose ${change.delta}% in your recent traces.`
                : `${change.label} eased ${Math.abs(change.delta)}% in your recent traces.`}
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 8 }}>
              Comparing your earlier traces with your most recent ones.
            </Text>
          </View>
        )}

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
