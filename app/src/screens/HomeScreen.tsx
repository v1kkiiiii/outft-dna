import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { ECHO_POSTS, FEED_POSTS, POSTS, commentsFor, Post } from '../data';
import { useApp } from '../state';
import { Avatar, Photo, Rule, SectionLabel } from '../ui';
import { SaveSheet } from '../ui-save-sheet';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function FeedArticle({ post, idx }: { post: Post; idx: number }) {
  const { navigate, isPostSaved, unsavePost, showToast } = useApp();
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
  const key = 'feed-' + idx;
  const preview = commentsFor(key).slice(0, 2);
  const goComments = () => navigate('comments', { commentsKey: key, post });
  const name = post.handle.replace('@', '');
  return (
    <View>
      <View style={s.artHead}>
        <Avatar initials={post.ava} color={post.color} size={32} />
        <Text style={s.artName}>{name}</Text>
        <Text style={s.artDate}>{post.date}</Text>
      </View>
      <Photo tone={post.tone} style={s.artPhoto} />
      <Text style={s.artCaption}>{post.caption}</Text>
      <View style={s.artActions}>
        <Pressable onPress={() => setLiked(!liked)} hitSlop={8}>
          <Text style={{ fontSize: 18, color: liked ? colors.likeRed : colors.ink }}>{liked ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable onPress={onBookmark} hitSlop={8}>
          <Text style={{ fontSize: 16, color: colors.ink }}>{savedIn ? '▣' : '▢'}</Text>
        </Pressable>
        <Pressable onPress={goComments} hitSlop={8}>
          <Text style={s.artMeta}>{preview.length} comments</Text>
        </Pressable>
      </View>
      <SaveSheet post={post} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      {preview.map((c, i) => (
        <Text key={i} style={s.previewComment}>
          <Text style={{ fontFamily: fonts.sansMedium }}>{c.name}</Text>
          {'  '}{c.text}
        </Text>
      ))}
      <Pressable onPress={goComments} hitSlop={6}>
        <Text style={s.viewAll}>View all comments</Text>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const { navigate, profileName, streak, latestOutfit } = useApp();
  const firstName = profileName.split(' ')[0];
  const insight = latestOutfit?.result.insight
    ?? 'This week, your style has been tracing quiet confidence. 5 people echoed your fits.';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.wordmark}>outft.</Text>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Pressable onPress={() => navigate('messages')} hitSlop={8}>
            <Text style={s.headerGlyph}>✉</Text>
          </Pressable>
          <Pressable onPress={() => navigate('activity')} hitSlop={8}>
            <Text style={s.headerGlyph}>🔔</Text>
          </Pressable>
        </View>
      </View>

      {/* Greeting */}
      <Text style={s.h1}>Good morning, {firstName}.</Text>
      <Text style={s.h1Italic}>Your trace continues.</Text>

      {/* Streak card */}
      <Pressable style={s.streakCard} onPress={() => navigate('profile')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={s.streakNum}>{streak}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.streakLabel}>Day streak</Text>
            <Text style={s.streakSub}>capture today to keep it alive</Text>
          </View>
        </View>
        <View style={s.daysRow}>
          {DAYS.map((d, i) => {
            if (i < 4) {
              return (
                <View key={i} style={[s.dayCircle, s.dayFilled]}>
                  <Text style={[s.dayText, { color: colors.paper }]}>{d}</Text>
                </View>
              );
            }
            if (i === 4) {
              return (
                <Pressable key={i} style={[s.dayCircle, s.dayToday]} onPress={() => navigate('camera')}>
                  <Text style={s.dayText}>{d}</Text>
                </Pressable>
              );
            }
            return (
              <View key={i} style={[s.dayCircle, s.dayFuture]}>
                <Text style={[s.dayText, { color: colors.faint }]}>{d}</Text>
              </View>
            );
          })}
        </View>
      </Pressable>

      {/* Today's trace */}
      <SectionLabel style={{ marginTop: 30, marginBottom: 12 }}>TODAY'S TRACE</SectionLabel>
      <Pressable onPress={() => navigate('postDetail', { post: POSTS[0] })}>
        <Photo uri={latestOutfit?.photoUri} tone="#DFDFDF" style={s.todayPhoto} />
        <View style={s.todayBar}>
          <Text style={s.todayBarText}>Today's trace · 22 June</Text>
          <Pressable onPress={() => navigate('camera')} hitSlop={10}>
            <Text style={{ fontSize: 14, color: colors.ink }}>✎</Text>
          </Pressable>
        </View>
      </Pressable>

      {/* Recent echoes */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Recent echoes</Text>
        <Text style={s.sectionAside}>FITS THAT MATCH YOURS</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {ECHO_POSTS.map((p) => (
          <Pressable key={p.idx} onPress={() => navigate('postDetail', { post: p })}>
            <Photo tone={p.tone} style={s.echoPhoto} />
            <View style={s.echoBadge}>
              <Text style={s.echoBadgeText}>{p.handle}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Insight card */}
      <View style={s.insightCard}>
        <Text style={s.insightText}>{insight}</Text>
      </View>

      {/* Wear this again */}
      <Pressable style={s.wearCard} onPress={() => navigate('postDetail', { post: POSTS[8] })}>
        <Photo tone={POSTS[8].tone} style={{ width: 56, height: 70, borderRadius: 6 }} />
        <View style={{ flex: 1 }}>
          <Text style={s.wearKicker}>WEAR THIS AGAIN · 72°F</Text>
          <Text style={s.wearTitle}>linen jacket day</Text>
          <Text style={s.wearCopy}>you traced this on 9 June — same light, same mood.</Text>
        </View>
      </Pressable>

      {/* Friends' traces */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Friends' traces</Text>
        <Text style={s.sectionDate}>22 June</Text>
      </View>
      {FEED_POSTS.slice(0, 2).map((post, idx) => (
        <View key={post.idx}>
          <FeedArticle post={post} idx={idx} />
          {idx === 0 ? <Rule style={{ marginVertical: 24 }} /> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: fonts.serif, fontSize: 22, color: colors.ink },
  headerGlyph: { fontSize: 17, color: colors.ink },
  h1: { fontFamily: fonts.serif, fontSize: 28, color: colors.ink, marginTop: 22 },
  h1Italic: { fontFamily: fonts.serifItalic, fontSize: 28, color: colors.ink },
  streakCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginTop: 22 },
  streakNum: { fontFamily: fonts.serif, fontSize: 44, color: colors.ink },
  streakLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  streakSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.sand, marginTop: 2 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayFilled: { backgroundColor: colors.ink },
  dayToday: { borderWidth: 1.5, borderColor: colors.ink },
  dayFuture: { borderWidth: 1, borderColor: colors.line },
  dayText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.ink },
  todayPhoto: { width: '100%', height: 200, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  todayBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cream, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  todayBarText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 32, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 19, color: colors.ink },
  sectionAside: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.faint },
  sectionDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint },
  echoPhoto: { width: 72, height: 90, borderRadius: 8 },
  echoBadge: {
    position: 'absolute', bottom: 5, left: 5, backgroundColor: colors.paper,
    borderRadius: 999, paddingVertical: 2, paddingHorizontal: 6,
  },
  echoBadgeText: { fontFamily: fonts.sans, fontSize: 8, color: colors.ink },
  insightCard: { backgroundColor: colors.cream, borderRadius: 12, padding: 18, marginTop: 24 },
  insightText: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 22, color: colors.ink },
  wearCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.line,
    borderRadius: 12, padding: 14, marginTop: 14,
  },
  wearKicker: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.faint },
  wearTitle: { fontFamily: fonts.serif, fontSize: 18, color: colors.ink, marginTop: 3 },
  wearCopy: { fontFamily: fonts.sans, fontSize: 11, color: colors.sand, marginTop: 2 },
  artHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  artName: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink, textTransform: 'lowercase', flex: 1 },
  artDate: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint },
  artPhoto: { width: '86%', aspectRatio: 3 / 4, borderRadius: 4, marginTop: 12 },
  artCaption: { fontFamily: fonts.serifItalic, fontSize: 15, color: colors.ink, marginTop: 10 },
  artActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  artMeta: { fontFamily: fonts.sans, fontSize: 11, color: colors.sand },
  previewComment: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted, marginTop: 6 },
  viewAll: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint, marginTop: 8 },
});
