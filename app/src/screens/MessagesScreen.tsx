import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { CHATS, PEOPLE } from '../data';
import { useApp } from '../state';
import { Avatar, Header } from '../ui';

const KEYS = ['lenav', 'maren', 'noor'] as const;
const TIMES: Record<string, string> = { lenav: '2m', maren: '1h', noor: '3h' };

export default function MessagesScreen() {
  const { navigate, sentMessages } = useApp();
  return (
    <View style={s.root}>
      <Header title="messages" onClose={() => navigate('home')} />
      <ScrollView>
        {KEYS.map((key) => {
          const person = PEOPLE.find((p) => p.key === key)!;
          const sent = sentMessages.filter((m) => m.person === key);
          const last = sent.length > 0
            ? sent[sent.length - 1].text
            : (CHATS[key] ?? []).slice(-1)[0]?.text ?? '';
          return (
            <Pressable key={key} style={s.row} onPress={() => navigate('chat', { personKey: key })}>
              <Avatar initials={person.ava} color={person.color} size={44} />
              <View style={s.col}>
                <Text style={s.name}>@{key}</Text>
                <Text style={s.last} numberOfLines={1}>{last}</Text>
              </View>
              <Text style={s.time}>{TIMES[key]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  col: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  last: { fontFamily: fonts.serifItalic, fontSize: 13, color: colors.muted },
  time: { fontFamily: fonts.sans, fontSize: 10, color: colors.sand },
});
