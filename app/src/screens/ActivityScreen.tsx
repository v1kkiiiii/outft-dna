import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { Header, SectionLabel } from '../ui';

export default function ActivityScreen() {
  const { navigate } = useApp();

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

        <View style={s.section}>
          <SectionLabel>ACTIVITY</SectionLabel>
          <Text style={s.emptyCopy}>Echoes, follows, and streak alerts will land here.</Text>
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
  section: { paddingHorizontal: 22, paddingTop: 14, gap: 10 },
  emptyCopy: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.muted, lineHeight: 22 },
});
