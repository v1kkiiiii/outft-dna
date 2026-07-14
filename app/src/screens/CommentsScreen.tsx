import React, { useMemo, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { colors, fonts } from '../theme';
import { Comment, commentsFor, POSTS } from '../data';
import { useApp } from '../state';
import { Avatar, Header, Photo } from '../ui';

export default function CommentsScreen() {
  const { params, goBack } = useApp();
  const key = params.commentsKey ?? 'detail';
  const post = params.post ?? POSTS[0];

  const initial = useMemo(() => commentsFor(key), [key]);
  const [added, setAdded] = useState<Comment[]>([]);
  const [likedIdx, setLikedIdx] = useState<Record<number, boolean>>({});
  const [text, setText] = useState('');

  const comments = [...initial, ...added];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setAdded((a) => [...a, { ava: 'EV', color: '#CDB89B', name: '@you', text: t, time: 'just now' }]);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="comments" onBack={goBack} />
      <View style={s.preview}>
        <Photo uri={post.photoUri} tone={post.tone} style={{ width: 44, height: 54, borderRadius: 4 }} />
        <View style={{ flex: 1 }}>
          <Text style={s.pHandle}>{post.handle}</Text>
          <Text style={s.pCaption} numberOfLines={1}>{post.caption}</Text>
        </View>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(_, i) => String(i)}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F0EBE3' }} />}
        renderItem={({ item, index }) => (
          <View style={s.row}>
            <Avatar initials={item.ava} color={item.color} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={s.cName}>
                {item.name} <Text style={s.cTime}>{item.time}</Text>
              </Text>
              <Text style={s.cText}>{item.text}</Text>
            </View>
            <Pressable onPress={() => setLikedIdx((m) => ({ ...m, [index]: !m[index] }))} hitSlop={8}>
              <Text style={{ fontSize: 14, color: likedIdx[index] ? colors.likeRed : colors.faint }}>
                {likedIdx[index] ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>
        )}
      />
      <View style={s.inputBar}>
        <Avatar initials="EV" color="#CDB89B" size={32} />
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="add a comment…"
          placeholderTextColor={colors.faint}
          multiline
          blurOnSubmit={false}
        />
        {text.trim().length > 0 && (
          <Pressable onPress={send} hitSlop={8}>
            <Text style={s.postBtn}>Post</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7F7F7', padding: 10 },
  pHandle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink },
  pCaption: { fontFamily: fonts.serifItalic, fontSize: 13, color: colors.muted, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 22, paddingVertical: 12 },
  cName: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink },
  cTime: { fontFamily: fonts.sans, fontSize: 10, color: colors.faint },
  cText: { fontFamily: fonts.serif, fontSize: 14, color: colors.ink, marginTop: 2 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper,
  },
  input: {
    flex: 1, backgroundColor: '#F7F7F7', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100,
    fontFamily: fonts.serif, fontSize: 14, color: colors.ink,
  },
  postBtn: {
    fontFamily: fonts.sansMedium, fontSize: 14, color: '#3897F0', paddingHorizontal: 4,
  },
});
