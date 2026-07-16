import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { Header, PillButton } from '../ui';

export default function MessagesScreen() {
  const { navigate } = useApp();
  const invite = () => {
    Share.share({ message: 'tracing my style DNA on OUTFT — join me' });
  };
  return (
    <View style={s.root}>
      <Header title="messages" onClose={() => navigate('home')} />
      <View style={s.center}>
        <Text style={s.title}>Quiet for now.</Text>
        <Text style={s.sub}>Messages arrive when your friends join OUTFT.</Text>
        <PillButton label="INVITE FRIENDS" onPress={invite} style={s.pill} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingBottom: 60,
  },
  title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink, textAlign: 'center' },
  sub: {
    fontFamily: fonts.serifItalic, fontSize: 15, color: colors.muted,
    textAlign: 'center', marginTop: 12, lineHeight: 22,
  },
  pill: { marginTop: 32, alignSelf: 'stretch' },
});
