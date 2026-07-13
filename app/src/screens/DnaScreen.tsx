import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, dnaColors, fonts } from '../theme';
import { DNA_DEFAULT } from '../data';
import { useApp } from '../state';
import { DnaWheel, Header, SectionLabel } from '../ui';

const DELTAS = [
  { label: 'Structured silhouette', delta: '+8%', positive: true },
  { label: 'Dark neutral palette', delta: '+5%', positive: true },
  { label: 'Coastal softness', delta: '−3%', positive: false },
];

export default function DnaScreen() {
  const { goBack, navigate, latestOutfit } = useApp();
  const dna = latestOutfit?.result.aesthetics ?? DNA_DEFAULT;

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
