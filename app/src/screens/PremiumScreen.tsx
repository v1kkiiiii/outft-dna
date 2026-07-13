import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';

const CREAM = colors.creamDark;

const FEATURES = [
  'Unlimited lifetime backlog',
  'Advanced DNA analytics',
  'Exclusive themes & badge frames',
  'Monthly premium reports',
  'Streak protection & rare collectibles',
];

export default function PremiumScreen() {
  const { navigate, isPremium, update, showToast } = useApp();

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, paddingHorizontal: 22 }}>
      <View style={{ alignItems: 'flex-end', paddingTop: 56 }}>
        <Pressable onPress={() => navigate('profile')} hitSlop={12}>
          <Text style={{ fontSize: 18, color: CREAM }}>✕</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 28, color: CREAM }}>✦</Text>
          <Text style={{ fontFamily: fonts.serifItalic, fontSize: 30, color: CREAM, marginTop: 12 }}>DNA Premium</Text>
          <Text style={{
            fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
            color: colors.faint, marginTop: 8,
          }}>
            read deeper into your trace
          </Text>
        </View>

        <View style={{ marginTop: 40, gap: 16 }}>
          {FEATURES.map((f) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: CREAM, marginRight: 14 }}>✓</Text>
              <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: CREAM }}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingBottom: 48 }}>
        <Pressable
          disabled={isPremium}
          onPress={() => {
            update({ isPremium: true });
            showToast('premium active');
          }}
          style={[s.cta, isPremium && { opacity: 0.5 }]}
        >
          <Text style={s.ctaText}>{isPremium ? 'premium active' : 'start free trial'}</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: colors.faint, textAlign: 'center', marginTop: 12 }}>
          $8.99/mo · cancel anytime
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cta: {
    backgroundColor: CREAM, borderRadius: 999, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: {
    fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2,
    textTransform: 'uppercase', color: colors.ink,
  },
});
