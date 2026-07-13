import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { ACTIVITY_ITEMS } from '../data';
import { useApp } from '../state';
import { Header, SectionLabel } from '../ui';

const GLYPHS: Record<string, string> = {
  echo: '◎', follow: '+', dna: '◇', badge: '✦', streak: '⚡',
};

export default function ActivityScreen() {
  const { navigate, showToast } = useApp();
  const [voted, setVoted] = useState(false);

  const vote = () => {
    showToast('circle vote saved');
    setVoted(true);
  };

  return (
    <View style={s.root}>
      <Header title="activity" onClose={() => navigate('home')} />
      <ScrollView>
        <View style={s.premium}>
          <Text style={s.premTitle}>DNA Premium</Text>
          <Text style={s.premSub}>$8.99/mo · cancel anytime</Text>
          <Pressable style={s.learnPill} onPress={() => navigate('premium')}>
            <Text style={s.learnText}>learn more</Text>
          </Pressable>
        </View>

        <View style={s.voteCard}>
          <SectionLabel>PRIVATE CIRCLE: DINNER LOOKS</SectionLabel>
          <Text style={s.voteCopy}>
            Maya, Noor, and Lila are voting on your two saved options for tonight.
          </Text>
          {voted ? (
            <Text style={s.votedText}>your circle picked this look</Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable style={s.voteBtn} onPress={vote}>
                <Text style={s.voteBtnText}>Look A — 67% chose structured black</Text>
              </Pressable>
              <Pressable style={s.voteBtn} onPress={vote}>
                <Text style={s.voteBtnText}>Look B — 33% chose silk neutral</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 22 }}>
          {ACTIVITY_ITEMS.map((item, i) => (
            <Pressable key={i} style={s.row} onPress={() => navigate(item.go as any)}>
              <View style={s.glyphCircle}>
                <Text style={[s.glyph, item.icon === 'streak' && { color: colors.flame }]}>
                  {GLYPHS[item.icon] ?? '◎'}
                </Text>
              </View>
              <Text style={s.rowText}>{item.text}</Text>
              <Text style={s.rowTime}>{item.time}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  premium: {
    backgroundColor: colors.ink, borderRadius: 12, padding: 16,
    marginHorizontal: 22, marginBottom: 14,
  },
  premTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.paper },
  premSub: { fontFamily: fonts.sans, fontSize: 10, color: colors.faint, marginTop: 3 },
  learnPill: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.cream,
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, marginTop: 12,
  },
  learnText: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.5, color: colors.cream, textTransform: 'uppercase' },
  voteCard: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16,
    marginHorizontal: 22, marginBottom: 14, gap: 10,
  },
  voteCopy: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.muted },
  voteBtn: {
    borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 11, alignItems: 'center',
  },
  voteBtnText: { fontFamily: fonts.sans, fontSize: 11, color: colors.ink },
  votedText: { fontFamily: fonts.serifItalic, fontSize: 14, color: colors.ink, textAlign: 'center', paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  glyphCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F7F7F7',
    alignItems: 'center', justifyContent: 'center',
  },
  glyph: { fontSize: 14, color: colors.ink },
  rowText: { flex: 1, fontFamily: fonts.serif, fontSize: 14, color: colors.ink },
  rowTime: { fontFamily: fonts.sans, fontSize: 10, color: colors.sand },
});
