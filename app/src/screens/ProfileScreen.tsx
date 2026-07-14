import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { BADGES, CATEGORIES, POSTS, SIGNATURE_COLORS } from '../data';
import { Photo, PillButton, Polaroid, SectionLabel, Tag } from '../ui';

const TABS = ['Trace', 'Saves', 'Backlog', 'Badges'] as const;
type TabKey = (typeof TABS)[number];

const BOARD_NAMES = ['Night out', 'Work', 'Gym', 'Inspo'];
const BOARD_META = ['No. 12', 'No. 08', 'No. 05', 'No. 24'];
const BADGE_GLYPHS = ['✦', '◆', '○', '◇', '✧', '★'];
const GROUPINGS = ['occasions', 'months', 'years'] as const;

const LIGHT_DOT = (c: string) => ['#FFFFFF', '#F0EBE3', '#E8D8C4'].includes(c.toUpperCase()) || ['#FFFFFF', '#F0EBE3', '#E8D8C4'].includes(c);

export default function ProfileScreen() {
  const { navigate, showToast, latestOutfit, outfitCount, streak, profileName, collections, captures, savedPosts } = useApp();
  const [tab, setTab] = useState<TabKey>('Trace');
  const [grouping, setGrouping] = useState<(typeof GROUPINGS)[number]>('occasions');

  const sigTags = latestOutfit?.result.tags ?? ['Quiet luxury', 'Old money', 'Scandi'];
  const totalFits = 87 + outfitCount;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Cover */}
      <View style={{ height: 240 }}>
        <Photo uri={latestOutfit?.photoUri} tone="#C4B098" style={{ width: '100%', height: 240 }} />
        <Pressable
          onPress={() => showToast('settings')}
          hitSlop={12}
          style={{ position: 'absolute', top: 54, right: 22 }}
        >
          <Text style={{ fontSize: 20, color: colors.paper }}>☰</Text>
        </Pressable>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <View style={{ height: 18, backgroundColor: colors.paper, opacity: 0.25 }} />
          <View style={{ height: 16, backgroundColor: colors.paper, opacity: 0.55 }} />
          <View style={{ height: 14, backgroundColor: colors.paper, opacity: 0.85 }} />
        </View>
      </View>

      {/* Name */}
      <View style={{ alignItems: 'center', marginTop: -6, paddingHorizontal: 22 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: colors.ink }}>{profileName}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.sand, marginTop: 4 }}>
          TRACING SINCE 12.03.25
        </Text>
      </View>

      {/* Stats strip */}
      <View style={st.stats}>
        <StatCell num={String(totalFits)} label="outfits traced" />
        <View style={st.statDiv} />
        <StatCell num="142" label="days captured" />
        <View style={st.statDiv} />
        <StatCell num="31" label="echoes found" onPress={() => navigate('twins')} />
        <View style={st.statDiv} />
        <StatCell num={String(streak)} label="day streak" />
      </View>

      {/* Sub-tabs */}
      <View style={st.tabRow}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.tabBtn, tab === t && st.tabBtnActive]}>
            <Text style={[st.tabText, tab === t && { color: colors.ink }]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Trace' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24, gap: 18 }}>
          <SectionLabel>YOUR SIGNATURE TRACE</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {sigTags.slice(0, 3).map((t) => <Tag key={t} label={t} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {SIGNATURE_COLORS.map((c) => (
              <View
                key={c}
                style={{
                  width: 24, height: 24, borderRadius: 12, backgroundColor: c,
                  borderWidth: LIGHT_DOT(c) ? 1 : 0, borderColor: colors.line,
                }}
              />
            ))}
          </View>

          <Pressable onPress={() => navigate('dna')} style={st.card}>
            <SectionLabel>THIS MONTH</SectionLabel>
            <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.ink, marginTop: 8 }}>
              Silhouette became 8% more structured.
            </Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, marginTop: 6 }}>
              Proof of wear — your trace is shifting toward sharper lines and quieter palettes.
            </Text>
          </Pressable>

          <Pressable onPress={() => navigate('camera')} style={[st.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.ink }}>{streak}</Text>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.muted, flex: 1 }}>
              day streak · capture today to keep it alive
            </Text>
          </Pressable>

          <PillButton label="EXPLORE FULL ARCHIVE" onPress={() => setTab('Backlog')} />

          <Pressable onPress={() => navigate('dna')} style={st.miniRow}>
            <Text style={st.miniRowText}>Fashion DNA</Text>
            <Text style={{ fontSize: 16, color: colors.sand }}>›</Text>
          </Pressable>
          <Pressable onPress={() => navigate('premium')} style={st.miniRow}>
            <Text style={st.miniRowText}>DNA Premium</Text>
            <Text style={{ fontSize: 16, color: colors.sand }}>›</Text>
          </Pressable>
        </View>
      )}

      {tab === 'Saves' && (
        <View style={{ paddingTop: 2 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingVertical: 12 }}>
            {BOARD_NAMES.map((name) => (
              <Pressable
                key={name}
                onPress={() => navigate('collection', { collectionName: name })}
                style={st.boardChip}
              >
                <Text style={st.boardChipText}>{name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {captures.map((c) => (
              <Pressable
                key={c.id}
                style={st.gridTile}
                onPress={() => navigate('postDetail', {
                  post: {
                    idx: Number(c.id) || 0, handle: '@you', ava: 'EV', color: '#CDB89B',
                    date: new Date(c.capturedAt).toLocaleDateString(), caption: c.caption ?? c.result.insight,
                    tags: c.result.tags.slice(0, 2), likes: 0, dna: c.result.insight,
                    tone: '#DFDFDF', photoUri: c.photoUri,
                  },
                })}
              >
                <Photo uri={c.photoUri} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
            {Object.values(savedPosts).flat().map((p) => (
              <Pressable
                key={`s-${p.idx}`}
                style={st.gridTile}
                onPress={() => navigate('postDetail', { post: p })}
              >
                <Photo uri={p.photoUri} tone={p.tone} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
            {POSTS.slice(0, 9).map((p) => (
              <Pressable
                key={`d-${p.idx}`}
                style={st.gridTile}
                onPress={() => navigate('postDetail', { post: p })}
              >
                <Photo tone={p.tone} style={{ width: '100%', height: '100%' }} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {tab === 'Backlog' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {GROUPINGS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGrouping(g)}
                style={[st.groupPill, grouping === g && { backgroundColor: colors.ink, borderColor: colors.ink }]}
              >
                <Text style={[st.groupPillText, grouping === g && { color: colors.paper }]}>{g.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.sand, marginTop: 12 }}>
            {grouping} rows · {totalFits} fits traced
          </Text>
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 15, color: colors.ink, marginTop: 12, marginBottom: 8 }}>
            Your wear archive. Every outfit becomes evidence of a style in motion.
          </Text>

          {grouping === 'occasions' && CATEGORIES.slice(0, 4).map((cat, i) => (
            <View key={cat.key} style={{ marginTop: 22 }}>
              <SectionLabel>{cat.label}</SectionLabel>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                {[0, 1, 2, 3].map((j) => {
                  const post = POSTS[i * 4 + j];
                  return (
                    <Polaroid
                      key={j}
                      width={82}
                      tone={post.tone}
                      tiltIndex={j}
                      meta={`Jun ${22 - j} · ${cat.label}`}
                      number={`No. 0${j + 1}`}
                      onPress={() => navigate('postDetail', { post })}
                    />
                  );
                })}
              </View>
            </View>
          ))}

          {grouping === 'months' && (
            <>
              <PolaroidGrid title="June" posts={POSTS.slice(0, 12)} onTap={(p) => navigate('postDetail', { post: p })} />
              <PolaroidGrid title="May" posts={POSTS.slice(24, 30)} onTap={(p) => navigate('postDetail', { post: p })} />
            </>
          )}

          {grouping === 'years' && (
            <PolaroidGrid title="2026" posts={POSTS.slice(0, 12)} onTap={(p) => navigate('postDetail', { post: p })} />
          )}

          <Pressable onPress={() => navigate('premium')} style={st.lockRow}>
            <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.sand }}>
              Unlock full archive · premium only
            </Text>
          </Pressable>
        </View>
      )}

      {tab === 'Badges' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.sand, textAlign: 'center' }}>
            5 of 6 unlocked
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 18 }}>
            {BADGES.map((b, i) => (
              <Pressable
                key={b.name}
                onPress={() => (b.unlocked ? showToast(b.desc) : navigate('premium'))}
                style={[st.badgeCard, !b.unlocked && { borderStyle: 'dashed', opacity: 0.5 }]}
              >
                <View style={st.badgeCircle}>
                  <Text style={{ fontSize: 18, color: colors.ink }}>{BADGE_GLYPHS[i % BADGE_GLYPHS.length]}</Text>
                </View>
                <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.ink, marginTop: 10, textAlign: 'center' }}>
                  {b.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function StatCell({ num, label, onPress }: { num: string; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.ink }}>{num}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 8, letterSpacing: 1.2, color: colors.sand, textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function PolaroidGrid({ title, posts, onTap }: {
  title: string; posts: typeof POSTS; onTap: (p: (typeof POSTS)[number]) => void;
}) {
  return (
    <View style={{ marginTop: 22 }}>
      <SectionLabel>{title}</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
        {posts.map((p, j) => (
          <Polaroid
            key={p.idx}
            width={96}
            tone={p.tone}
            tiltIndex={j}
            meta={p.date.split(' · ')[1] ?? p.date}
            number={`No. ${String(j + 1).padStart(2, '0')}`}
            onPress={() => onTap(p)}
          />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  stats: {
    flexDirection: 'row', alignItems: 'center', marginTop: 22,
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  statDiv: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.line },
  tabRow: { flexDirection: 'row', paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.ink },
  tabText: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.faint },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 15 },
  miniRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  miniRowText: { fontFamily: fonts.serif, fontSize: 16, color: colors.ink },
  boardChip: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  boardChipText: { fontFamily: fonts.sans, fontSize: 10, color: colors.taupe },
  gridTile: { width: '33.05%', aspectRatio: 1, margin: '0.14%', backgroundColor: colors.cream },
  groupPill: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  groupPillText: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.5, color: colors.taupe },
  lockRow: {
    marginTop: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.tagBorder,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  badgeCard: {
    width: '48%', borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    padding: 14, alignItems: 'center', marginBottom: 14,
  },
  badgeCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7F7F7',
    alignItems: 'center', justifyContent: 'center',
  },
});
