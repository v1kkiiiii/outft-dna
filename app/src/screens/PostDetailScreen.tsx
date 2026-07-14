import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { BRAND_PICKS, ECHO_POSTS, POSTS } from '../data';
import { useApp } from '../state';
import { Avatar, CommentIcon, Header, Photo, Rule, SectionLabel, Tag } from '../ui';
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
              <CommentIcon size={19} />
            </Pressable>
            <Pressable onPress={onBookmark} hitSlop={8}>
              <Text style={{ fontSize: 18, color: colors.ink }}>{savedIn ? '▣' : '▢'}</Text>
            </Pressable>
          </View>
          <Text style={s.likes}>{post.likes + (liked ? 1 : 0)} likes</Text>

          <Pressable
            style={s.findSimilarBtn}
            onPress={() => { showToast('finding brands that match this aesthetic…'); navigate('twins'); }}
          >
            <Text style={s.findSimilarText}>FIND SIMILAR</Text>
          </Pressable>

          <View style={s.dnaCard}>
            <SectionLabel>OUTFIT DNA</SectionLabel>
            <Text style={s.dnaText}>{post.dna}</Text>
          </View>

          {post.sponsor && (
            <Pressable
              style={s.shopBtn}
              onPress={() => Linking.openURL(post.sponsor!.shopUrl)}
            >
              <Text style={s.shopBtnText}>SHOP AT {post.sponsor.brand.toUpperCase()} ↗</Text>
            </Pressable>
          )}

          {/* Echoes + a sponsored brand pick matched to this look */}
          <SectionLabel style={{ marginTop: 24 }}>ECHOES + PICKS FOR THIS LOOK</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {[ECHO_POSTS[(post.idx + 1) % ECHO_POSTS.length], ECHO_POSTS[(post.idx + 2) % ECHO_POSTS.length], BRAND_PICKS[post.idx % BRAND_PICKS.length]].map((p) => (
              <Pressable
                key={p.idx}
                style={{ flex: 1 }}
                onPress={() => navigate('postDetail', { post: p })}
              >
                <Photo tone={p.tone} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
                <Text style={s.pickLabel} numberOfLines={1}>
                  {p.sponsor ? `${p.handle} · SPONSORED` : p.handle}
                </Text>
              </Pressable>
            ))}
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
  findSimilarBtn: {
    borderWidth: 1, borderColor: colors.ink, borderRadius: 999, paddingVertical: 11,
    alignItems: 'center', marginTop: 14,
  },
  findSimilarText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2, color: colors.ink },
  dnaCard: { backgroundColor: '#F7F7F7', borderRadius: 12, padding: 15, marginTop: 16 },
  dnaText: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.ink, marginTop: 6 },
  shopBtn: {
    backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 13,
    alignItems: 'center', marginTop: 14,
  },
  shopBtnText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2, color: colors.paper },
  pickLabel: { fontFamily: fonts.sans, fontSize: 8, letterSpacing: 0.5, color: colors.sand, marginTop: 5 },
});
