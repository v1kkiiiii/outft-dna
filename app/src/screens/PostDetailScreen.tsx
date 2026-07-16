import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { affiliateUrl, BRAND_PICKS, ECHO_POSTS, Post, POSTS, postIdxFromId } from '../data';
import { LatestOutfit, useApp } from '../state';
import { backendAvailable } from '../lib/supabase';
import { deleteOutfit, fetchMyOutfitById } from '../lib/historyApi';
import { Avatar, CommentIcon, Header, Photo, Rule, SectionLabel, Tag } from '../ui';
import { SaveSheet } from '../ui-save-sheet';

export default function PostDetailScreen() {
  const { params, goBack, navigate, showToast, isPostSaved, unsavePost, captures, update } = useApp();
  const post = params.post ?? POSTS[0];
  const isMine = post.handle === '@you';
  const serverId = (post as { serverId?: string }).serverId;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Authoritative refresh for the user's own server-backed posts: if params
  // carry a serverId, re-fetch the capture so insight/tags reflect the server.
  // Fail-soft — anything missing keeps what was passed in params.
  const [fresh, setFresh] = useState<LatestOutfit | null>(null);
  useEffect(() => {
    if (!isMine || !serverId || !UUID_RE.test(serverId) || !backendAvailable()) return;
    let cancelled = false;
    fetchMyOutfitById(serverId).then((r) => {
      if (!cancelled && r) setFresh(r);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, isMine]);

  const shownCaption = fresh ? (fresh.caption ?? fresh.result.insight ?? post.caption) : post.caption;
  const shownDna = fresh?.result.insight || post.dna;
  const shownTags = fresh && fresh.result.tags.length > 0 ? fresh.result.tags.slice(0, 2) : post.tags;

  const confirmDelete = () => {
    Alert.alert(
      'Delete this trace?',
      'The photo and its analysis will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const serverId = (post as { serverId?: string }).serverId;
            const local = captures.find(
              (c) => c.id === serverId || (!!post.photoUri && c.photoUri === post.photoUri),
            );
            const targetId = serverId ?? local?.id;
            if (targetId && UUID_RE.test(targetId) && backendAvailable()) {
              deleteOutfit(targetId).catch(() => {}); // best-effort
            }
            update({
              captures: captures.filter(
                (c) => c.id !== targetId && (!post.photoUri || c.photoUri !== post.photoUri),
              ),
            });
            goBack();
            showToast('trace deleted');
          },
        },
      ],
    );
  };
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

  // Map one of the user's real captures to the Post shape for a thumbnail tile.
  const captureToPost = (c: LatestOutfit): Post => ({
    idx: postIdxFromId(c.id), handle: '@you', ava: 'EV', color: '#CDB89B',
    date: new Date(c.capturedAt).toLocaleDateString(),
    caption: c.caption ?? c.result.insight,
    tags: c.result.tags.slice(0, 2), likes: 0, dna: c.result.insight,
    tone: '#DFDFDF', photoUri: c.photoUri,
    serverId: c.id,
  } as Post & { serverId: string });

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
          <Text style={s.caption}>{shownCaption}</Text>
          <View style={s.tagsRow}>
            {shownTags.map((t, i) => <Tag key={t} label={t} filled={i > 0} />)}
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
          {/* Own posts have no fake engagement numbers — the heart above is the
              only (session-local) like state. Demo posts keep their counts. */}
          {!isMine && <Text style={s.likes}>{post.likes + (liked ? 1 : 0)} likes</Text>}

          <Pressable
            style={s.findSimilarBtn}
            onPress={() => { showToast('finding brands that match this aesthetic…'); navigate('twins'); }}
          >
            <Text style={s.findSimilarText}>FIND SIMILAR</Text>
          </Pressable>

          <View style={s.dnaCard}>
            <SectionLabel>OUTFIT DNA</SectionLabel>
            <Text style={s.dnaText}>{shownDna}</Text>
          </View>

          {post.sponsor && (
            <View>
              <Pressable
                style={s.shopBtn}
                onPress={() => { showToast('opening ' + post.sponsor!.brand); Linking.openURL(affiliateUrl(post.sponsor!)); }}
              >
                <Text style={s.shopBtnText}>SHOP AT {post.sponsor.brand.toUpperCase()} ↗</Text>
              </Pressable>
              <Text style={s.affNote}>Affiliate link · OUTFT may earn a commission</Text>
            </View>
          )}

          {/* Echoes + a sponsored brand pick matched to this look.
              Own posts show the user's real other captures (no fake echoes);
              demo/sponsored posts keep the demo echo thumbnails. */}
          <SectionLabel style={{ marginTop: 24 }}>ECHOES + PICKS FOR THIS LOOK</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {(isMine
              ? [
                  ...captures
                    .filter((c) => c.id !== serverId && (!post.photoUri || c.photoUri !== post.photoUri))
                    .slice(0, 2)
                    .map(captureToPost),
                  BRAND_PICKS[Math.abs(post.idx) % BRAND_PICKS.length],
                ]
              : [
                  ECHO_POSTS[(post.idx + 1) % ECHO_POSTS.length],
                  ECHO_POSTS[(post.idx + 2) % ECHO_POSTS.length],
                  BRAND_PICKS[post.idx % BRAND_PICKS.length],
                ]
            ).map((p, i) => (
              <Pressable
                key={`${p.idx}-${i}`}
                style={{ flex: 1 }}
                onPress={() => navigate('postDetail', { post: p })}
              >
                <Photo uri={p.photoUri} tone={p.tone} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
                <Text style={s.pickLabel} numberOfLines={1}>
                  {p.sponsor ? `${p.handle} · SPONSORED` : p.handle}
                </Text>
              </Pressable>
            ))}
          </View>

          {isMine && (
            <Pressable onPress={confirmDelete} hitSlop={10} style={{ marginTop: 24 }}>
              <Text style={s.deleteText}>delete trace</Text>
            </Pressable>
          )}
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
  affNote: { fontFamily: fonts.sans, fontSize: 9, color: colors.sand, textAlign: 'center', marginTop: 6 },
  pickLabel: { fontFamily: fonts.sans, fontSize: 8, letterSpacing: 0.5, color: colors.sand, marginTop: 5 },
  deleteText: { fontFamily: fonts.sans, fontSize: 10, color: colors.likeRed, textAlign: 'center', letterSpacing: 1 },
});
