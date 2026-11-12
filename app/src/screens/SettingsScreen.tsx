import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { Header, SectionLabel } from '../ui';
import { deleteAccount, requestExport } from '../lib/accountApi';
import { disableReminders, enableReminders } from '../lib/reminders';
import Constants from 'expo-constants';
import { FLAGS, PRIVACY_URL, TERMS_URL } from '../flags';
import { myReferralCode, saveNotifyPrefs } from '../lib/growthApi';
import { allowanceFrom } from '../lib/allowance';

export default function SettingsScreen() {
  const {
    goBack, signOut, showToast, authMode, email, remindersEnabled, update, navigate,
    notifyWrapped, notifyTwins, analysisLog, isPremium,
  } = useApp();
  const [referral, setReferral] = useState<string | null>(null);

  useEffect(() => {
    if (authMode === 'supabase') myReferralCode().then(setReferral).catch(() => {});
  }, [authMode]);

  // Mirrors the opt-in choices to the server so email and push triggers
  // respect them. Local reminders keep working without an account.
  const syncPrefs = (next: { daily: boolean; wrapped: boolean; twins: boolean }) => {
    if (!FLAGS.reengagement || authMode !== 'supabase') return;
    saveNotifyPrefs({ daily_reminder: next.daily, wrapped_ready: next.wrapped, twin_match: next.twins }, email)
      .then((r) => { if (!r.ok) showToast('could not save your email preferences'); })
      .catch(() => {});
  };

  const onToggleNotify = (key: 'notifyWrapped' | 'notifyTwins', next: boolean) => {
    update({ [key]: next });
    syncPrefs({
      daily: remindersEnabled,
      wrapped: key === 'notifyWrapped' ? next : notifyWrapped,
      twins: key === 'notifyTwins' ? next : notifyTwins,
    });
  };

  const openUrl = (url: string) => Linking.openURL(url).catch(() => showToast('could not open the link'));
  const allowance = allowanceFrom(analysisLog, isPremium);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [busy, setBusy] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  const onToggleReminders = async (next: boolean) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    if (next) {
      const ok = await enableReminders();
      if (ok) {
        update({ remindersEnabled: true });
        syncPrefs({ daily: true, wrapped: notifyWrapped, twins: notifyTwins });
        showToast('reminders set for 9:00, 14:00, 19:00');
      } else {
        showToast('notifications unavailable here');
      }
    } else {
      await disableReminders();
      update({ remindersEnabled: false });
      syncPrefs({ daily: false, wrapped: notifyWrapped, twins: notifyTwins });
      showToast('reminders off');
    }
    setReminderBusy(false);
  };

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    const r = await requestExport();
    setBusy(false);
    if (r.ok) showToast("export requested. we'll email you");
    else if (authMode !== 'supabase') showToast('sign in to request an export');
    else showToast('export request failed. try again');
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently erases your account, outfits, and Style DNA. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            const r = await deleteAccount();
            setBusy(false);
            if (r.ok || authMode !== 'supabase') {
              signOut();
              showToast('account deleted');
            } else {
              showToast('deletion failed. try again');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Header title="settings" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 48 }}>
        <SectionLabel>RITUAL</SectionLabel>
        <View style={st.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={st.rowText}>daily trace reminders</Text>
            <Text style={st.toggleSub}>three gentle nudges at 9:00, 14:00, 19:00</Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={onToggleReminders}
            disabled={reminderBusy}
            trackColor={{ false: colors.line, true: colors.ink }}
            thumbColor={colors.paper}
          />
        </View>

        {FLAGS.reengagement ? (
          <>
            <ToggleRow
              label="your Wrapped is ready"
              sub="one message when your Wrapped card is ready"
              value={notifyWrapped}
              onChange={(v) => onToggleNotify('notifyWrapped', v)}
            />
            <ToggleRow
              label="new twin match"
              sub="when someone new dresses like you"
              value={notifyTwins}
              onChange={(v) => onToggleNotify('notifyTwins', v)}
            />
            <Text style={st.footnote}>
              All off by default. Every email has an unsubscribe link.
            </Text>
          </>
        ) : null}

        {FLAGS.pricing ? (
          <>
            <View style={{ height: 22 }} />
            <SectionLabel>PLAN</SectionLabel>
            <View style={st.accountRow}>
              <Text style={st.accountLabel}>{isPremium ? 'PREMIUM' : 'FREE'}</Text>
              <Text style={st.accountValue}>
                {isPremium
                  ? 'unlimited analyses'
                  : allowance.introLeft > 0
                    ? `${allowance.introLeft} intro analyses left`
                    : `${allowance.monthLeft} analyses left this month`}
              </Text>
            </View>
            <Row label="See plans" onPress={() => navigate('paywall')} />
          </>
        ) : null}

        {referral ? (
          <>
            <View style={{ height: 22 }} />
            <SectionLabel>REFERRAL</SectionLabel>
            <View style={st.accountRow}>
              <Text style={st.accountLabel}>YOUR CODE</Text>
              <Text style={st.accountValue} selectable>{referral}</Text>
            </View>
            <Text style={st.footnote}>
              Friends can enter this code when they sign up. We record referrals; there are no payouts right now.
            </Text>
          </>
        ) : null}

        <View style={{ height: 22 }} />
        <SectionLabel>ACCOUNT</SectionLabel>
        <View style={st.accountRow}>
          <Text style={st.accountLabel}>SIGNED IN AS</Text>
          <Text style={st.accountValue} numberOfLines={1}>
            {email ? email : 'guest mode'}
          </Text>
        </View>
        <Row label="Sign out" onPress={signOut} />
        <Row label="Request data export" onPress={onExport} disabled={busy} />
        <Row label="Delete account" onPress={onDelete} disabled={busy} danger />
        <View style={st.accountRow}>
          <Text style={st.accountLabel}>APP VERSION</Text>
          <Text style={st.accountValue}>{appVersion}</Text>
        </View>
        <Text style={st.footnote}>
          Deleting your account removes your outfits, analyses, and Style DNA. Exports arrive by email.
        </Text>

        <View style={{ height: 22 }} />
        <SectionLabel>LEGAL</SectionLabel>
        <Row label="Terms of Service" onPress={() => openUrl(TERMS_URL)} />
        <Row label="Privacy Policy" onPress={() => openUrl(PRIVACY_URL)} />
      </ScrollView>
    </View>
  );
}

function ToggleRow({ label, sub, value, onChange }: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={st.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={st.rowText}>{label}</Text>
        <Text style={st.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.ink }}
        thumbColor={colors.paper}
      />
    </View>
  );
}

function Row({ label, onPress, danger, disabled }: {
  label: string; onPress: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[st.row, disabled && { opacity: 0.4 }]}>
      <Text style={[st.rowText, danger && { color: colors.error }]}>{label}</Text>
      <Text style={{ fontSize: 16, color: danger ? colors.error : colors.sand }}>›</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  rowText: { fontFamily: fonts.serif, fontSize: 17, color: colors.ink },
  accountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  accountLabel: {
    fontFamily: fonts.sans, fontSize: 9, letterSpacing: 2, color: colors.sand,
  },
  accountValue: {
    fontFamily: fonts.serif, fontSize: 13, color: colors.ink, opacity: 0.7,
    maxWidth: '65%',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  toggleSub: { fontFamily: fonts.sans, fontSize: 10, color: colors.sand, marginTop: 3 },
  footnote: { fontFamily: fonts.sans, fontSize: 10, color: colors.sand, marginTop: 18, lineHeight: 15 },
});
