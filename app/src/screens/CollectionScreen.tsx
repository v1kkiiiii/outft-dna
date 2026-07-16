import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { Header, Photo } from '../ui';

export default function CollectionScreen() {
  const { navigate, goBack, params, savedPosts } = useApp();
  const name = params.collectionName ?? 'Night out';
  const saved = savedPosts[name] ?? [];
  const total = saved.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title={name} onBack={goBack} />
      <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.sand, textAlign: 'center', marginBottom: 10 }}>
        {total} {total === 1 ? 'fit' : 'fits'} saved
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {total > 0 ? (
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
