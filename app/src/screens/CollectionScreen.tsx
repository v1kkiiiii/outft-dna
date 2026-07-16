import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { LatestOutfit, useApp } from '../state';
import { Post } from '../data';
import { Header, Photo } from '../ui';

// Map board names to capture category keys so real captures land on the right board.
const BOARD_CATEGORY: Record<string, string> = {
  'Night out': 'night',
  Work: 'work',
  Gym: 'gym',
};

export default function CollectionScreen() {
  const { navigate, goBack, params, savedPosts, captures } = useApp();
  const name = params.collectionName ?? 'Night out';
  const saved = savedPosts[name] ?? [];
  const boardCaptures = captures.filter(
    (c) => (c.category || '').toLowerCase() === (BOARD_CATEGORY[name] ?? name.toLowerCase()),
  );
  const total = saved.length + boardCaptures.length;

  const captureToPost = (c: LatestOutfit): Post => ({
    idx: Number(c.id) || 0, handle: '@you', ava: 'EV', color: '#CDB89B',
    date: new Date(c.capturedAt).toLocaleDateString(),
    caption: c.caption ?? c.result.insight,
    tags: c.result.tags.slice(0, 2), likes: 0, dna: c.result.insight,
    tone: '#DFDFDF', photoUri: c.photoUri,
    serverId: c.id,
  } as Post & { serverId: string });

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title={name} onBack={goBack} />
      <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.sand, textAlign: 'center', marginBottom: 10 }}>
        {total} {total === 1 ? 'fit' : 'fits'} saved
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {total > 0 ? (
          <View style={st.grid}>
            {boardCaptures.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => navigate('postDetail', { post: captureToPost(c) })}
                style={st.tile}
              >
                <Photo uri={c.photoUri} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
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
        ) : (
          <View style={{ paddingHorizontal: 22, paddingTop: 48, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 17, color: colors.ink, textAlign: 'center' }}>
              This board is still blank.
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, textAlign: 'center' }}>
              Bookmark looks you love and they will gather here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  tile: { width: '33%', aspectRatio: 1, flexGrow: 1, maxWidth: '33.4%' },
});
