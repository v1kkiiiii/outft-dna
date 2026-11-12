// Paywall test screen, behind the pricing flag. Payments are not connected:
// tapping a plan records interest and says so plainly.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { FREE_INTRO_ANALYSES, FREE_MONTHLY_ANALYSES, PRICE_MONTHLY, PRICE_YEARLY } from '../flags';
import { allowanceFrom } from '../lib/allowance';
import { track } from '../lib/track';

const CREAM = colors.creamDark;

export default function PaywallScreen() {
  const { goBack, analysisLog, isPremium } = useApp();
  const [picked, setPicked] = useState<'monthly' | 'yearly' | null>(null);
  const a = allowanceFrom(analysisLog, isPremium);

  useEffect(() => { track('paywall_shown').catch(() => {}); }, []);

  const pick = (plan: 'monthly' | 'yearly') => {
    setPicked(plan);
    track('paywall_plan_tapped', { plan }).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink, paddingHorizontal: 22 }}>
      <View style={{ alignItems: 'flex-end', paddingTop: 56 }}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Text style={{ fontSize: 18, color: CREAM }}>✕</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={s.title}>{a.allowed ? 'DNA Premium' : 'You have used your free reads'}</Text>
        <Text style={s.sub}>
          Free includes your first {FREE_INTRO_ANALYSES} analyses, then {FREE_MONTHLY_ANALYSES} a month.
          {a.allowed ? '' : ' Your next free read arrives at the start of next month.'}
        </Text>

        <View style={{ marginTop: 32, gap: 12 }}>
          <Plan label="Monthly" price={`${PRICE_MONTHLY} a month`} on={picked === 'monthly'} onPress={() => pick('monthly')} />
          <Plan label="Yearly" price={`${PRICE_YEARLY} a year`} on={picked === 'yearly'} onPress={() => pick('yearly')} />
        </View>
        <Text style={s.includes}>Premium includes unlimited outfit analyses.</Text>

        {picked ? (
          <Text style={s.note}>
            Payments are not live yet, so nothing was charged. We noted that you are interested in the {picked} plan.
          </Text>
        ) : null}
      </View>

      <View style={{ paddingBottom: 48 }}>
        <Pressable onPress={goBack} style={s.cta}>
          <Text style={s.ctaText}>{a.allowed ? 'NOT NOW' : 'BACK'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Plan({ label, price, on, onPress }: { label: string; price: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.plan, on && { borderColor: CREAM, backgroundColor: 'rgba(240,235,227,0.08)' }]}>
      <Text style={s.planLabel}>{label}</Text>
      <Text style={s.planPrice}>{price}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.serifItalic, fontSize: 30, color: CREAM, textAlign: 'center' },
  sub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.faint, textAlign: 'center', marginTop: 12 },
  plan: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#3A3830', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 18,
  },
  planLabel: { fontFamily: fonts.serif, fontSize: 18, color: CREAM },
  planPrice: { fontFamily: fonts.sansMedium, fontSize: 13, color: CREAM },
  includes: { fontFamily: fonts.sans, fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 14 },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: CREAM, textAlign: 'center', marginTop: 20 },
  cta: { backgroundColor: CREAM, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontFamily: fonts.sansMedium, fontSize: 12, letterSpacing: 2, color: colors.ink },
});
