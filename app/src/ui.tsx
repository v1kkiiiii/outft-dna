import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, dnaColors, fonts } from './theme';
import { useApp, ScreenKey } from './state';

export function Avatar({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: size * 0.32, color: colors.ink, letterSpacing: 0.5 }}>
        {initials}
      </Text>
    </View>
  );
}

export function Tag({ label, filled, onPress }: { label: string; filled?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.tag, filled && s.tagFilled]}>
      <Text style={[s.tagText, filled && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[s.sl, style as any]}>{children}</Text>;
}

export function Rule({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

// Grey/tone photo placeholder or real image
export function Photo({ uri, tone, style }: { uri?: string; tone?: string; style: any }) {
  if (uri) return <Image source={{ uri }} style={style} resizeMode="cover" />;
  return <View style={[style, { backgroundColor: tone || colors.placeholder }]} />;
}

// Tilted polaroid frame
export function Polaroid({ uri, tone, meta, number, width = 96, onPress, tiltIndex = 0 }: {
  uri?: string; tone?: string; meta?: string; number?: string; width?: number;
  onPress?: () => void; tiltIndex?: number;
}) {
  const tilts = ['-1.1deg', '0.8deg', '-0.7deg'];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{
      backgroundColor: colors.paper, padding: 7, paddingBottom: 9, width,
      transform: [{ rotate: tilts[tiltIndex % 3] }],
      shadowColor: colors.ink, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.25, shadowRadius: 11,
      elevation: 4,
    }}>
      <Photo uri={uri} tone={tone} style={{ width: '100%', aspectRatio: 3 / 4 }} />
      {meta ? <Text style={s.polMeta}>{meta}</Text> : null}
      {number ? <Text style={s.polNum}>{number}</Text> : null}
    </Pressable>
  );
}

// DNA donut wheel from stacked stroke arcs
export function DnaWheel({ data, size = 160, centerLabel = 'you' }: {
  data: { label: string; pct: number }[]; size?: number; centerLabel?: string;
}) {
  const r = 68;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 180 180" style={{ transform: [{ rotate: '-90deg' }] }}>
        {data.map((d, i) => {
          const len = (d.pct / 100) * c;
          const el = (
            <Circle key={d.label} cx={90} cy={90} r={r} fill="none"
              stroke={dnaColors[i % dnaColors.length]} strokeWidth={22}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', maxWidth: size * 0.5 }}>
        <Text style={{ fontFamily: fonts.serifItalic, fontSize: Math.max(14, size * 0.11), color: colors.ink }}>{centerLabel}</Text>
        <Text style={{ fontFamily: fonts.sans, fontSize: Math.max(6, size * 0.042), letterSpacing: size * 0.008, color: colors.sand }} numberOfLines={1}>
          FASHION DNA
        </Text>
      </View>
    </View>
  );
}

// Simple line icons drawn with text glyphs to avoid an icon library
const NAV_ITEMS: { key: ScreenKey; glyph: string; label: string; activeFor: ScreenKey[] }[] = [
  { key: 'home', glyph: '⌂', label: 'HOME', activeFor: ['home', 'messages', 'activity'] },
  { key: 'camera', glyph: '◉', label: 'CAMERA', activeFor: ['camera'] },
  { key: 'twins', glyph: '◎', label: 'TWINS', activeFor: ['twins', 'otherProfile'] },
];

function PersonIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={6.5} r={3.5} fill={color} />
      <Path d="M2.5 18c0-4.14 3.36-7 7.5-7s7.5 2.86 7.5 7" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function BottomNav() {
  const { screen, navigate } = useApp();
  const profileActive = ['profile', 'dna', 'premium', 'wrapped'].includes(screen);
  return (
    <View style={s.bnav}>
      {NAV_ITEMS.map((item) => {
        const active = item.activeFor.includes(screen);
        return (
          <Pressable key={item.key} style={s.nb} onPress={() => navigate(item.key)}>
            <Text style={{ fontSize: 20, color: active ? colors.ink : colors.faint }}>{item.glyph}</Text>
            <Text style={[s.nbLabel, active && { color: colors.ink }]}>{item.label}</Text>
          </Pressable>
        );
      })}
      <Pressable style={s.nb} onPress={() => navigate('profile')}>
        <PersonIcon color={profileActive ? colors.ink : colors.faint} />
        <Text style={[s.nbLabel, profileActive && { color: colors.ink }]}>PROFILE</Text>
      </Pressable>
    </View>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <View style={s.toastWrap} pointerEvents="none">
      <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
    </View>
  );
}

export function Header({ title, onBack, onClose, right }: {
  title?: string; onBack?: () => void; onClose?: () => void; right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12}><Text style={s.hIcon}>←</Text></Pressable>
      ) : <View style={{ width: 24 }} />}
      <Text style={s.hTitle}>{title ?? 'outft.'}</Text>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={12}><Text style={s.hIcon}>✕</Text></Pressable>
      ) : right ?? <View style={{ width: 24 }} />}
    </View>
  );
}

export function PillButton({ label, filled, light, onPress, style, disabled }: {
  label: string; filled?: boolean; light?: boolean; onPress?: () => void; style?: ViewStyle; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[
      s.pill,
      filled && { backgroundColor: colors.ink, borderColor: colors.ink },
      light && { backgroundColor: colors.paper, borderColor: colors.paper },
      disabled && { opacity: 0.4 },
      style,
    ]}>
      <Text style={[
        s.pillText,
        filled && { color: colors.paper },
        light && { color: colors.ink },
      ]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tag: {
    borderWidth: 1, borderColor: colors.tagBorder, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  tagFilled: { backgroundColor: colors.ink, borderColor: colors.ink },
  tagText: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 0.8, color: colors.taupe },
  sl: {
    fontFamily: fonts.sans, fontSize: 10, letterSpacing: 2.5,
    textTransform: 'uppercase', color: colors.sand,
  },
  polMeta: { fontFamily: fonts.sans, fontSize: 7.5, color: colors.sand, marginTop: 5, letterSpacing: 0.5 },
  polNum: { fontFamily: fonts.serifItalic, fontSize: 11, color: colors.ink, marginTop: 1 },
  bnav: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingTop: 10, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  nb: { alignItems: 'center', gap: 3, paddingHorizontal: 18 },
  nbLabel: { fontFamily: fonts.sans, fontSize: 9, letterSpacing: 1.5, color: colors.faint },
  toastWrap: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
  toast: { backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 20 },
  toastText: { fontFamily: fonts.sans, fontSize: 12, color: colors.paper, textTransform: 'lowercase' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingVertical: 14,
  },
  hTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
  hIcon: { fontSize: 19, color: colors.ink },
  pill: {
    borderWidth: 1, borderColor: colors.ink, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.ink, textTransform: 'uppercase' },
});
