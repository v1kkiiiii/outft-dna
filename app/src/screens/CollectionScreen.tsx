import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { POSTS } from '../data';
import { Header, Photo, SectionLabel, Tag } from '../ui';

function nameHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function CollectionScreen() {
  const { navigate, goBack, params, collections, savedPosts } = useApp();
  const name = params.collectionName ?? 'Night out';
  const offset = nameHash(name) % 40;
  const fillers = POSTS.slice(offset, offset + 3);
  const saved = savedPosts[name] ?? [];
  const total = saved.length + (collections[name] ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title={name} onBack={goBack} />
      <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.sand, textAlign: 'center', marginBottom: 10 }}>
        {total} fits saved
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {saved.length > 0 ? (
          <View style={st.grid}>
            {saved.map((post) => (
              <Pressable
                key={post.idx}
                onPress={() => navigate('postDetail', { post })}
                style={st.tile}
              >
                <Photo uri={post.photoUri} tone={post.tone} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 22 }}>
          {saved.length > 0 ? (
            <SectionLabel style={{ marginTop: 24, marginBottom: 4 }}>FROM THE DEMO</SectionLabel>
          ) : null}
          {fillers.map((post) => (
            <Pressable key={post.idx} onPress={() => navigate('postDetail', { post })} style={st.row}>
              <Photo tone={post.tone} style={{ width: 90, height: 115, borderRadius: 6 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink }}>@you</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.faint }}>{name} · 20 Jun</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {post.tags.slice(0, 2).map((t) => <Tag key={t} label={t} />)}
                </View>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
                  <Text style={{ fontSize: 13, color: colors.faint }}>♡</Text>
                  <Text style={{ fontSize: 13, color: colors.faint }}>💬</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  tile: { width: '33%', aspectRatio: 1, flexGrow: 1, maxWidth: '33.4%' },
  row: {
    flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
});
