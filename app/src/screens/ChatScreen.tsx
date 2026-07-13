import React, { useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { colors, fonts } from '../theme';
import { CHATS, ChatMessage, PEOPLE } from '../data';
import { useApp } from '../state';
import { Avatar } from '../ui';

export default function ChatScreen() {
  const { params, goBack, navigate, update, sentMessages } = useApp();
  const key = params.personKey ?? 'lenav';
  const person = PEOPLE.find((p) => p.key === key)!;
  const [text, setText] = useState('');

  const messages: ChatMessage[] = [
    ...(CHATS[key] ?? []),
    ...sentMessages
      .filter((m) => m.person === key)
      .map((m): ChatMessage => ({ from: 'me', text: m.text, time: m.time })),
  ];

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    update({ sentMessages: [...sentMessages, { person: key, text: trimmed, time: 'now' }] });
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <Pressable onPress={goBack} hitSlop={12}><Text style={s.hIcon}>←</Text></Pressable>
        <Pressable style={s.hCenter} onPress={() => navigate('otherProfile', { personKey: key })}>
          <Avatar initials={person.ava} color={person.color} size={28} />
          <Text style={s.hName}>@{key}</Text>
        </Pressable>
        <View style={{ width: 24 }} />
      </View>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const mine = item.from === 'me';
          return (
            <View style={[s.msgWrap, mine ? s.wrapMine : s.wrapTheirs]}>
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                <Text style={[s.msgText, mine && { color: colors.paper }]}>{item.text}</Text>
              </View>
              <Text style={s.msgTime}>{item.time}</Text>
            </View>
          );
        }}
      />
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="message…"
          placeholderTextColor={colors.sand}
          onSubmitEditing={send}
        />
        <Pressable style={s.sendBtn} onPress={send}>
          <Text style={s.sendGlyph}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingVertical: 14,
  },
  hIcon: { fontSize: 19, color: colors.ink },
  hCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hName: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink },
  list: { paddingHorizontal: 22, paddingVertical: 14, gap: 10 },
  msgWrap: { maxWidth: '78%' },
  wrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingVertical: 9, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: colors.ink, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#F7F7F7', borderBottomLeftRadius: 4 },
  msgText: { fontFamily: fonts.serif, fontSize: 14, color: colors.ink },
  msgTime: { fontFamily: fonts.sans, fontSize: 9, color: colors.sand, marginTop: 3 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  input: {
    flex: 1, backgroundColor: '#F7F7F7', borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 16,
    fontFamily: fonts.serif, fontSize: 14, color: colors.ink,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  sendGlyph: { color: colors.paper, fontSize: 15 },
});
