import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';

export default function ChatScreen() {
  const { params, goBack } = useApp();
  const key = params.personKey ?? '';

  // Direct messages are not live yet — this screen is unreachable in normal
  // flows, but stays compiling and safe if navigated to directly.
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={goBack} hitSlop={12}><Text style={s.hIcon}>←</Text></Pressable>
        <Text style={s.hName}>{key ? `@${key}` : 'messages'}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.center}>
        <Text style={s.title}>Coming soon.</Text>
        <Text style={s.sub}>Direct messages arrive when your friends join OUTFT.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingVertical: 14,
  },
  hIcon: { fontSize: 19, color: colors.ink },
  hName: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, textAlign: 'center' },
  sub: {
    fontFamily: fonts.serifItalic, fontSize: 15, color: colors.muted,
    textAlign: 'center', marginTop: 12, lineHeight: 22,
  },
});
