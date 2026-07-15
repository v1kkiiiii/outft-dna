import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { Header, SectionLabel } from '../ui';
import { deleteAccount, requestExport } from '../lib/accountApi';

export default function SettingsScreen() {
  const { goBack, signOut, showToast, authMode } = useApp();
  const [busy, setBusy] = useState(false);

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
        <SectionLabel>ACCOUNT</SectionLabel>
        <Row label="Sign out" onPress={signOut} />
        <Row label="Request data export" onPress={onExport} disabled={busy} />
        <Row label="Delete account" onPress={onDelete} disabled={busy} danger />
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
  footnote: { fontFamily: fonts.sans, fontSize: 10, color: colors.sand, marginTop: 18, lineHeight: 15 },
});
