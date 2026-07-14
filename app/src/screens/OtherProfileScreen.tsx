import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { PEOPLE } from '../data';
import { Avatar, CommentIcon, DnaWheel, Photo, SectionLabel, Tag } from '../ui';

const LIGHT = ['#FFFFFF', '#F0EBE3', '#E8D8C4', '#D8CFC4', '#E8E8E8'];

export default function OtherProfileScreen() {
  const { navigate, goBack, params, following, toggleFollow, showToast } = useApp();
  const person = PEOPLE.find((p) => p.key === params.personKey) ?? PEOPLE[0];
  const key = person.key;
  const isFollowing = following.includes(key);
  // Derive a rough aesthetic breakdown from this person's own tags so their
  // wheel reads as their palette, not a generic ramp.
  const dnaData = person.tags.map((t, i) => ({ label: t, pct: [46, 32, 22][i] ?? 10 }));

  const post = {
    idx: 300,
    handle: '@' + key,
    ava: person.ava,
    color: person.color,
    date: '22 June 2026',
    caption: person.caption,
    tags: person.postTags,
    likes: 18,
    dna: 'Their trace runs close to yours — shared palette discipline.',
    tone: person.colors[3],
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={{ height: 240 }}>
        <Photo tone={person.colors[2]} style={{ width: '100%', height: 240 }} />
        <Pressable onPress={goBack} hitSlop={12} style={st.backBtn}>
          <Text style={{ fontSize: 17, color: colors.paper }}>←</Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', marginTop: 20, paddingHorizontal: 22 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.ink }}>{person.name}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: colors.sand, marginTop: 4 }}>
          tracing since {person.since}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18 }}>
        <Pressable
          onPress={() => { toggleFollow(key); showToast(isFollowing ? 'unfollowed' : 'following ' + person.name); }}
          style={[st.pill, isFollowing && { backgroundColor: colors.ink }]}
        >
          <Text style={[st.pillText, isFollowing && { color: colors.paper }]}>
            {isFollowing ? 'following' : 'follow'}
          </Text>
        </Pressable>
        <Pressable onPress={() => navigate('chat', { personKey: key })} style={st.pill}>
          <Text style={st.pillText}>message</Text>
        </Pressable>
      </View>

      <View style={st.stats}>
        <StatCell num={String(person.fits)} label="fits traced" />
        <View style={st.statDiv} />
        <StatCell num={String(person.echoes)} label="echoes found" />
        <View style={st.statDiv} />
        <StatCell num={String(person.streak)} label="day streak" />
      </View>

      <View style={{ paddingHorizontal: 22, gap: 12 }}>
        <SectionLabel>THEIR TRACE</SectionLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <DnaWheel data={dnaData} size={92} centerLabel={key} palette={person.colors} />
          <View style={{ flex: 1, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {person.tags.map((t) => <Tag key={t} label={t} />)}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {person.colors.map((c) => (
            <View
              key={c}
              style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: c,
                borderWidth: LIGHT.includes(c) ? 1 : 0, borderColor: colors.line,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <SectionLabel>TODAY'S TRACE</SectionLabel>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.faint }}>22 June 2026</Text>
        </View>

        <Pressable onPress={() => navigate('postDetail', { post })} style={{ gap: 12 }}>
          <Photo tone={person.colors[3]} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar initials={person.ava} color={person.color} size={32} />
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.ink }}>@{key}</Text>
          </View>
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 15, color: colors.ink }}>{person.caption}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {person.postTags.map((t) => <Tag key={t} label={t} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ fontSize: 15, color: colors.ink }}>♡</Text>
            <CommentIcon size={16} />
            <Text style={{ fontSize: 15, color: colors.ink }}>▢</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatCell({ num, label }: { num: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.ink }}>{num}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1.2, color: colors.sand, textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  backBtn: {
    position: 'absolute', top: 54, left: 22, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(26,25,22,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 26,
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.5, color: colors.ink, textTransform: 'lowercase' },
  stats: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 22,
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  statDiv: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line },
});
