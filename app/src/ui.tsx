import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, dnaColors, fonts } from './theme';
import { hapticTap } from './haptics';
import { useApp, ScreenKey } from './state';

// Subtle press-scale used across primary pills and cards.
export const pressScale = ({ pressed }: { pressed: boolean }) =>
  pressed ? { transform: [{ scale: 0.97 }] as any } : null;

// Gentler pressed state for rows and small tappables.
export const pressDim = ({ pressed }: { pressed: boolean }) =>
  pressed ? { opacity: 0.55 } : null;

export function CommentIcon({ color = colors.ink, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d="M2 4.5C2 3.67 2.67 3 3.5 3h13c.83 0 1.5.67 1.5 1.5v8c0 .83-.67 1.5-1.5 1.5H8l-3.5 3v-3H3.5C2.67 13 2 12.33 2 11.5v-7z"
        stroke={color} strokeWidth={1.3} fill="none" strokeLinejoin="round"
      />
    </Svg>
  );
}

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
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.tag, filled && s.tagFilled, onPress && pressed && { opacity: 0.55 }]}>
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
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({
      backgroundColor: colors.paper, padding: 7, paddingBottom: 9, width,
      transform: [{ rotate: tilts[tiltIndex % 3] }, { scale: onPress && pressed ? 0.97 : 1 }],
      shadowColor: colors.ink, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.25, shadowRadius: 11,
      elevation: 4,
    })}>
      <Photo uri={uri} tone={tone} style={{ width: '100%', aspectRatio: 3 / 4 }} />
      {meta ? <Text style={s.polMeta}>{meta}</Text> : null}
      {number ? <Text style={s.polNum}>{number}</Text> : null}
    </Pressable>
  );
}

// DNA donut wheel from stacked stroke arcs. Pass `palette` to tint the wheel
// with a specific person's own color story instead of the default ramp —
// used so each twin's aesthetic reads visually distinct.
export function DnaWheel({ data, size = 160, centerLabel = 'you', palette }: {
  data: { label: string; pct: number }[]; size?: number; centerLabel?: string; palette?: string[];
}) {
  const ramp = palette && palette.length > 0 ? palette : dnaColors;
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
              stroke={ramp[i % ramp.length]} strokeWidth={22}
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
function PersonIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function CreateIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x={4} y={4} width={16} height={16} rx={4} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M12 8.5v7M8.5 12h7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1v-8.5z" stroke={color} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

function TwinsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={9} cy={12} r={5.5} stroke={color} strokeWidth={1.6} fill="none" />
      <Circle cx={15} cy={12} r={5.5} stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

export function BottomNav() {
  const { screen, navigate } = useApp();
  const homeActive = ['home', 'messages', 'activity'].includes(screen);
  const twinsActive = ['twins', 'otherProfile'].includes(screen);
  const profileActive = ['profile', 'dna', 'premium', 'wrapped'].includes(screen);
  const go = (key: ScreenKey) => { hapticTap(); navigate(key); };
  return (
    <View style={s.bnav}>
      <Pressable style={({ pressed }) => [s.nb, pressed && { opacity: 0.55 }]} onPress={() => go('home')}>
        <View style={s.navIcon}><HomeIcon color={homeActive ? colors.ink : colors.faint} /></View>
        <Text style={[s.nbLabel, homeActive && { color: colors.ink }]}>HOME</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [s.nb, pressed && { opacity: 0.55 }]} onPress={() => go('camera')}>
        <View style={s.navIcon}><CreateIcon color={screen === 'camera' ? colors.ink : colors.faint} /></View>
        <Text style={[s.nbLabel, screen === 'camera' && { color: colors.ink }]}>CREATE</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [s.nb, pressed && { opacity: 0.55 }]} onPress={() => go('twins')}>
        <View style={s.navIcon}><TwinsIcon color={twinsActive ? colors.ink : colors.faint} /></View>
        <Text style={[s.nbLabel, twinsActive && { color: colors.ink }]}>TWINS</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [s.nb, pressed && { opacity: 0.55 }]} onPress={() => go('profile')}>
        <View style={s.navIcon}><PersonIcon color={profileActive ? colors.ink : colors.faint} /></View>
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
        <Pressable onPress={onBack} hitSlop={12} style={pressDim}><Text style={s.hIcon}>←</Text></Pressable>
      ) : <View style={{ width: 24 }} />}
      <Text style={s.hTitle}>{title ?? 'outft.'}</Text>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={12} style={pressDim}><Text style={s.hIcon}>✕</Text></Pressable>
      ) : right ?? <View style={{ width: 24 }} />}
    </View>
  );
}

export function PillButton({ label, filled, light, onPress, style, disabled }: {
  label: string; filled?: boolean; light?: boolean; onPress?: () => void; style?: ViewStyle; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
      s.pill,
      filled && { backgroundColor: colors.ink, borderColor: colors.ink },
      light && { backgroundColor: colors.paper, borderColor: colors.paper },
      disabled && { opacity: 0.4 },
      style,
      pressed && { transform: [{ scale: 0.97 }] },
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
  nb: { alignItems: 'center', gap: 4, paddingHorizontal: 14 },
  navIcon: { height: 24, alignItems: 'center', justifyContent: 'center' },
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
