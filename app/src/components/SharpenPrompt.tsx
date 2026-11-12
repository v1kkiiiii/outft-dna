// "Add another photo to sharpen your read" experiment. Shown only when the
// sharpen flag is on (or the signed-in email is on the tester list). Records
// shown and tapped; the upload itself is recorded by the camera screen, so
// metrics can tell whether a tap led to a new photo.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { sharpenPromptEnabled } from '../flags';
import { track } from '../lib/track';

export function SharpenPrompt({ surface }: { surface: 'dna' | 'twins' }) {
  const { email, navigate } = useApp();
  const enabled = sharpenPromptEnabled(email);

  useEffect(() => {
    if (enabled) track('sharpen_prompt_shown', { surface }).catch(() => {});
  }, [enabled, surface]);

  if (!enabled) return null;
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
      onPress={() => {
        track('sharpen_prompt_tapped', { surface }).catch(() => {});
        navigate('camera', { from: 'sharpen' });
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Add another photo to sharpen your read</Text>
        <Text style={s.sub}>Each outfit you add makes your Style DNA more precise.</Text>
      </View>
      <Text style={s.plus}>+</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cream, borderRadius: 12, padding: 16, marginTop: 18,
  },
  title: { fontFamily: fonts.serif, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.sans, fontSize: 11, color: colors.taupe, marginTop: 3 },
  plus: { fontFamily: fonts.sans, fontSize: 26, color: colors.ink },
});
