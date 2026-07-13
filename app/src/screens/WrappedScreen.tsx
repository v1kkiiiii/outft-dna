import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { WRAPPED_SLIDES } from '../data';
import { useApp } from '../state';
import { PillButton } from '../ui';

const CREAM = colors.creamDark;

export default function WrappedScreen() {
  const { navigate } = useApp();
  const [idx, setIdx] = useState(0);
  const slide = WRAPPED_SLIDES[idx];
  const isLast = idx === WRAPPED_SLIDES.length - 1;

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => {
    if (isLast) navigate('dna');
    else setIdx((i) => i + 1);
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
          {WRAPPED_SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                backgroundColor: i <= idx ? CREAM : 'rgba(240,235,227,0.25)',
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
        <Text style={[s.big, (slide as any).italic && { fontFamily: fonts.serifItalic }]}>{slide.big}</Text>
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
