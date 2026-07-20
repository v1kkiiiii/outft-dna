import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { Header, SectionLabel } from '../ui';
import { deleteAccount, requestExport } from '../lib/accountApi';
import { disableReminders, enableReminders } from '../lib/reminders';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { goBack, signOut, showToast, authMode, email, remindersEnabled, update } = useApp();
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
        showToast('reminders set — 9:00 · 14:00 · 19:00');
      } else {
        showToast('notifications unavailable here');
      }
    } else {
      await disableReminders();
      update({ remindersEnabled: false });
      showToast('reminders off');
    }
    setReminderBusy(false);
  };

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    const r = await requestExport();
    setBusy(false);
    if (r.ok) showToast("export requested — we'll email you");
    else if (authMode !== 'supabase') showToast('sign in to request an export');
    else showToast('export request failed — try again');
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
              showToast('deletion failed — try again');
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
            <Text style={st.toggleSub}>three gentle nudges — 9:00, 14:00, 19:00</Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={onToggleReminders}
            disabled={reminderBusy}
            trackColor={{ false: colors.line, true: colors.ink }}
            thumbColor={colors.paper}
          />
        </View>

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
      </ScrollView>
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
