import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, dnaColors, fonts } from '../theme';
import { BRAND_PICKS, DNA_DEFAULT, ECHO_POSTS, PEOPLE } from '../data';
import { useApp } from '../state';
import { Avatar, DnaWheel, Photo, Rule, SectionLabel } from '../ui';

const ECHO_NOTES = [
  { title: 'Palette', copy: 'The same family of tones, worn without coordination.' },
  { title: 'Silhouette', copy: 'Two lines that fall the same way on different days.' },
  { title: 'Layering', copy: 'The same logic of what sits over what.' },
  { title: 'Mood', copy: 'A shared temperature — quiet, deliberate, unhurried.' },
];

const FRIENDS: { key: string; sub: string }[] = [
  { key: 'lenav', sub: '8 echoes · quiet luxury' },
  { key: 'ari', sub: '5 echoes · scandi' },
  { key: 'noor', sub: '3 echoes · old money' },
];

const ECHO_PCTS = ['94%', '87%', '81%', '79%'];

export default function TwinsScreen() {
  const { navigate, latestOutfit, following, toggleFollow, showToast } = useApp();
  const dna = latestOutfit?.result.aesthetics ?? DNA_DEFAULT;
  const top3 = dna.slice(0, 3);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
      {/* Your DNA card */}
      <Pressable style={s.dnaCard} onPress={() => navigate('dna')}>
        <View style={s.rowBetween}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.ink }}>Your DNA</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.faint }}>View full trace</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <DnaWheel data={dna} size={130} />
          <View style={{ flex: 1, marginLeft: 16, gap: 10 }}>
            {top3.map((d, i) => (
              <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dnaColors[i], marginRight: 8 }} />
                <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.muted }}>{d.label}</Text>
                <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.ink }}>{d.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>

      {/* Wrapped banner */}
      <Pressable style={s.wrappedBanner} onPress={() => navigate('wrapped')}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.paper }}>Your wrapped</Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.faint, marginTop: 4 }}>June in silhouettes, palettes, and echoes</Text>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 40, color: colors.paper }}>06</Text>
      </Pressable>

      {/* Hero */}
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 36, color: colors.ink, textAlign: 'center' }}>Your twins</Text>
        <Text style={{ fontFamily: fonts.serifItalic, fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 8 }}>
          People whose palettes, silhouettes, and moods echo your DNA.
        </Text>
      </View>

      {/* Echo explainer */}
      <View style={s.explainer}>
        <Text style={{ fontFamily: fonts.serifItalic, fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          An echo is when someone else's fit matches yours — same palette, same silhouette, same mood, traced independently.
        </Text>
      </View>

      {/* Echo-note cards */}
      <View style={s.grid}>
        {ECHO_NOTES.map((n) => (
          <View key={n.title} style={s.noteCard}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.taupe }}>{n.title}</Text>
            <Text style={{ fontFamily: fonts.serifItalic, fontSize: 12, color: colors.muted, marginTop: 6 }}>{n.copy}</Text>
          </View>
        ))}
      </View>

      {/* Side-by-side match */}
      <SectionLabel style={{ marginTop: 32 }}>YOUR LATEST FIT · THEIR CLOSEST MATCH</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <View style={s.matchPhoto}>
          <Photo uri={latestOutfit?.photoUri} tone="#C4B098" style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
          <View style={s.captionBar}>
            <Text style={s.captionText}>your fit / 22 June</Text>
          </View>
        </View>
        <View style={s.matchPhoto}>
          <Photo tone={ECHO_POSTS[0].tone} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
          <View style={s.captionBar}>
            <Text style={s.captionText}>@lenav · Apr 14</Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}>94% echo</Text>
        <Rule style={{ width: 40, marginVertical: 8 }} />
        <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.faint }}>palette · silhouette · mood</Text>
      </View>

      {/* More echoes — brand picks interleaved as sponsored recommendations */}
      <SectionLabel style={{ marginTop: 32 }}>More echoes</SectionLabel>
      <View style={[s.grid, { marginTop: 12 }]}>
        {[ECHO_POSTS[0], ECHO_POSTS[1], BRAND_PICKS[0], ECHO_POSTS[2], ECHO_POSTS[3], BRAND_PICKS[1]].map((p, i) => (
          <Pressable key={p.idx} style={{ width: '48%' }} onPress={() => navigate('postDetail', { post: p })}>
            <Photo tone={p.tone} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
            <View style={s.pctBadge}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 10, color: p.sponsor ? colors.taupe : colors.ink }}>
                {p.sponsor ? p.handle : ECHO_PCTS[[0, 1, -1, 2, 3, -1][i]]}
              </Text>
            </View>
            {p.sponsor && (
              <Text style={s.sponsorTag}>SPONSORED · MATCHES YOUR DNA</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* People */}
      <SectionLabel style={{ marginTop: 32 }}>People whose fits often echo yours</SectionLabel>
      <View style={s.searchPill}>
        <TextInput
          placeholder="search people"
          placeholderTextColor={colors.sand}
          editable={false}
          style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink, padding: 0 }}
        />
      </View>
      {FRIENDS.map((f) => {
        const person = PEOPLE.find((p) => p.key === f.key)!;
        const isFollowing = following.includes(f.key);
        return (
          <Pressable key={f.key} style={s.friendRow} onPress={() => navigate('otherProfile', { personKey: f.key })}>
            <Avatar initials={person.ava} color={person.color} size={40} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.ink }}>@{f.key}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.faint, marginTop: 2 }}>{f.sub}</Text>
            </View>
            <Pressable
              onPress={() => {
                toggleFollow(f.key);
                showToast(isFollowing ? `unfollowed @${f.key}` : `following @${f.key}`);
              }}
              style={[s.followPill, isFollowing && { backgroundColor: colors.ink, borderColor: colors.ink }]}
            >
              <Text style={[s.followText, isFollowing && { color: colors.paper }]}>
                {isFollowing ? 'following' : 'follow'}
              </Text>
            </Pressable>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dnaCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, marginTop: 16 },
  wrappedBanner: {
    backgroundColor: colors.ink, borderRadius: 12, padding: 16, marginTop: 14,
    flexDirection: 'row', alignItems: 'center',
  },
  explainer: { backgroundColor: colors.cream, borderRadius: 12, padding: 18, marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 16 },
  noteCard: { width: '48%', borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12 },
  matchPhoto: { flex: 1, position: 'relative' },
  captionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(26,25,22,0.55)', paddingVertical: 6, paddingHorizontal: 8,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
  },
  captionText: { fontFamily: fonts.sans, fontSize: 9, color: colors.paper, letterSpacing: 0.5 },
  pctBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.paper,
    borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8,
  },
  sponsorTag: { fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1, color: colors.sand, marginTop: 5 },
  searchPill: {
    backgroundColor: colors.cream, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18,
    marginTop: 12, marginBottom: 6,
  },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  followPill: {
    borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 16,
  },
  followText: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.ink },
});
