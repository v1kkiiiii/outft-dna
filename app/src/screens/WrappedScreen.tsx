import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { LatestOutfit, useApp } from '../state';
import { computeDna, fetchMyOutfits } from '../lib/historyApi';
import { PillButton } from '../ui';

const CREAM = colors.creamDark;

interface Slide {
  kicker: string;
  big: string;
  copy: string;
  italic?: boolean;
}

const COLOR_WORDS = [
  'black', 'white', 'cream', 'ivory', 'beige', 'tan', 'camel', 'brown', 'charcoal',
  'grey', 'gray', 'navy', 'blue', 'denim', 'green', 'olive', 'sage', 'khaki',
  'red', 'burgundy', 'maroon', 'wine', 'pink', 'blush', 'rose', 'purple',
  'lavender', 'lilac', 'orange', 'rust', 'yellow', 'mustard', 'gold', 'silver',
  'neutral', 'pastel', 'monochrome', 'earth tone', 'taupe',
];

function findColorLabel(items: LatestOutfit[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.result.tags) {
      const lower = tag.toLowerCase();
      if (COLOR_WORDS.some((c) => lower.includes(c))) {
        counts.set(lower, (counts.get(lower) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function topTrait(items: LatestOutfit[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.result.tags) {
      const lower = tag.toLowerCase();
      counts.set(lower, (counts.get(lower) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function topCategory(items: LatestOutfit[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const c = (item.category || 'daily').toLowerCase();
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function buildSlides(items: LatestOutfit[], monthName: string): Slide[] {
  const slides: Slide[] = [
    {
      kicker: `${monthName} wrapped`,
      big: `${items.length} fits`,
      copy: items.length === 1 ? 'one trace on record this month' : 'every trace, distilled',
    },
  ];

  const dna = computeDna(items);
  if (dna.length > 0) {
    slides.push({
      kicker: 'top aesthetic',
      big: dna[0].label,
      copy: `${dna[0].pct}% of your style DNA this month`,
      italic: true,
    });
  } else {
    slides.push({
      kicker: 'top aesthetic',
      big: 'still forming',
      copy: 'your analyses will sharpen this next month',
      italic: true,
    });
  }

  const color = findColorLabel(items);
  const trait = topTrait(items);
  if (color) {
    slides.push({
      kicker: 'color story',
      big: color,
      copy: 'your most traced color this month',
      italic: true,
    });
  } else if (trait) {
    slides.push({
      kicker: 'signature trait',
      big: trait,
      copy: 'the thread running through your traces',
      italic: true,
    });
  } else {
    slides.push({
      kicker: 'color story',
      big: 'undefined palette',
      copy: 'keep tracing to reveal your color story',
      italic: true,
    });
  }

  const category = topCategory(items);
  slides.push({
    kicker: 'most traced category',
    big: category ?? 'daily',
    copy: 'where your trace lives most',
  });

  slides.push({
    kicker: 'see you next month',
    big: 'keep tracing',
    copy: 'your DNA sharpens with every fit',
    italic: true,
  });

  return slides;
}

export default function WrappedScreen() {
  const { navigate, captures } = useApp();
  const [idx, setIdx] = useState(0);
  const [remote, setRemote] = useState<LatestOutfit[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyOutfits()
      .then((res) => {
        if (alive) setRemote(res.ok ? res.items : []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Merge server outfits with local captures (dedupe by id), current month only.
  const monthItems = useMemo(() => {
    const seen = new Set<string>();
    const merged: LatestOutfit[] = [];
    for (const item of [...remote, ...captures]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    const now = new Date();
    return merged.filter((i) => {
      const d = new Date(i.capturedAt);
      return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [remote, captures]);

  const monthName = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const locked = monthItems.length < 3;
  const slides = useMemo<Slide[]>(
    () => (locked ? [] : buildSlides(monthItems, monthName)),
    [locked, monthItems, monthName],
  );

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={s.kicker}>tracing your month…</Text>
      </View>
    );
  }

  if (locked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        <View style={s.topRow}>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => navigate('dna')} hitSlop={12} style={{ marginLeft: 16 }}>
            <Text style={{ fontSize: 18, color: CREAM }}>✕</Text>
          </Pressable>
        </View>
        <View style={s.content}>
          <Text style={s.kicker}>{monthName} wrapped</Text>
          <Text style={[s.big, { fontFamily: fonts.serifItalic }]}>not yet</Text>
          <Text style={s.copy}>Wrapped unlocks after 3 traces this month.</Text>
          <PillButton
            light
            label="START TRACING"
            onPress={() => navigate('camera')}
            style={{ marginTop: 36, paddingHorizontal: 40 }}
          />
        </View>
      </View>
    );
  }

  const safeIdx = Math.min(idx, slides.length - 1);
  const slide = slides[safeIdx];
  const isLast = safeIdx === slides.length - 1;

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => {
    if (isLast) navigate('dna');
    else setIdx((i) => Math.min(slides.length - 1, i + 1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      {/* tap zones */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1 }} onPress={prev} />
          <Pressable style={{ flex: 2 }} onPress={next} />
        </View>
      </View>

      {/* progress + close */}
      <View style={s.topRow} pointerEvents="box-none">
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: i <= safeIdx ? CREAM : 'rgba(240,235,227,0.25)',
              }}
            />
          ))}
        </View>
        <Pressable onPress={() => navigate('dna')} hitSlop={12} style={{ marginLeft: 16 }}>
          <Text style={{ fontSize: 18, color: CREAM }}>✕</Text>
        </Pressable>
      </View>

      {/* content */}
      <View style={s.content} pointerEvents="box-none">
        <Text style={s.kicker}>{slide.kicker}</Text>
        <Text style={[s.big, slide.italic && { fontFamily: fonts.serifItalic }]}>{slide.big}</Text>
        <Text style={s.copy}>{slide.copy}</Text>
        {isLast && (
          <PillButton light label="done" onPress={() => navigate('dna')} style={{ marginTop: 36, paddingHorizontal: 40, zIndex: 2 }} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 56,
  },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  kicker: {
    fontFamily: fonts.sans, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
    color: colors.faint, marginBottom: 18, textAlign: 'center',
  },
  big: { fontFamily: fonts.serif, fontSize: 40, color: CREAM, textAlign: 'center' },
  copy: {
    fontFamily: fonts.serifItalic, fontSize: 16, color: CREAM, opacity: 0.7,
    textAlign: 'center', marginTop: 16,
  },
});
