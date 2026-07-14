import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { POSTS } from '../data';
import { useApp } from '../state';
import { Avatar, Header, Photo, Rule, SectionLabel, Tag } from '../ui';
import { SaveSheet } from '../ui-save-sheet';

export default function PostDetailScreen() {
  const { params, goBack, navigate, showToast, isPostSaved, unsavePost } = useApp();
  const post = params.post ?? POSTS[0];
  const [liked, setLiked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const savedIn = isPostSaved(post);

  const onBookmark = () => {
    if (savedIn) {
      unsavePost(post, savedIn);
      showToast('removed from ' + savedIn.toLowerCase());
    } else {
      setSheetOpen(true);
    }
  };

  const openProfile = () => {
    if (post.handle !== '@you') {
      navigate('otherProfile', { personKey: post.handle.replace('@', '') });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header
        title={post.handle}
        onBack={goBack}
        right={
          <Pressable onPress={() => showToast('options')} hitSlop={12}>
            <Text style={{ fontSize: 19, color: colors.ink }}>⋯</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Photo uri={post.photoUri} tone={post.tone} style={{ width: '100%', aspectRatio: 4 / 5 }} />
        <View style={{ paddingHorizontal: 22 }}>
          <Pressable style={s.handleRow} onPress={openProfile}>
            <Avatar initials={post.ava} color={post.color} size={36} />
            <Text style={s.handle}>{post.handle}</Text>
            <Text style={s.date}>{post.date}</Text>
          </Pressable>
          <Text style={s.caption}>{post.caption}</Text>
          <View style={s.tagsRow}>
            {post.tags.map((t, i) => <Tag key={t} label={t} filled={i > 0} />)}
          </View>
          <Rule style={{ marginVertical: 16 }} />
          <View style={s.actionsRow}>
            <Pressable onPress={() => setLiked((v) => !v)} hitSlop={8}>
              <Text style={{ fontSize: 20, color: liked ? colors.likeRed : colors.ink }}>{liked ? '♥' : '♡'}</Text>
            </Pressable>
            <Pressable onPress={() => navigate('comments', { commentsKey: 'post-' + post.idx, post })} hitSlop={8}>
              <Text style={{ fontSize: 18, color: colors.ink }}>⋯</Text>
            </Pressable>
            <Pressable onPress={onBookmark} hitSlop={8}>
              <Text style={{ fontSize: 18, color: colors.ink }}>{savedIn ? '▣' : '▢'}</Text>
            </Pressable>
          </View>
          <Text style={s.likes}>{post.likes + (liked ? 1 : 0)} likes</Text>
          <View style={s.dnaCard}>
            <SectionLabel>OUTFIT DNA</SectionLabel>
            <Text style={s.dnaText}>{post.dna}</Text>
          </View>
        </View>
      </ScrollView>
      <SaveSheet post={post} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  handle: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  date: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint, marginLeft: 'auto' },
  caption: { fontFamily: fonts.serifItalic, fontSize: 19, color: colors.ink, marginTop: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  likes: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 10 },
  dnaCard: { backgroundColor: '#F7F7F7', borderRadius: 12, padding: 15, marginTop: 16 },
  dnaText: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.ink, marginTop: 6 },
});
