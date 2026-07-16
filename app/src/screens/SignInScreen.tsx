import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts } from '../theme';
import { useApp } from '../state';
import { backendAvailable } from '../lib/supabase';
import { resetPassword, signInWithEmail, signUpWithEmail, upsertProfile } from '../lib/authApi';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CREAM = colors.creamDark; // #F0EBE3

type Path = 'email' | 'apple';

export default function SignInScreen() {
  const { update, navigate, showToast } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [path, setPath] = useState<Path>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const transitionTo = (next: 1 | 2) => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 18, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slide.setValue(18);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const startEmail = () => {
    setPath('email');
    transitionTo(2);
  };

  const startApple = () => {
    setPath('apple');
    update({ signedIn: true, guestMode: false, email: '' });
    transitionTo(2);
  };

  const startGuest = () => {
    update({ signedIn: true, guestMode: true, email: '', userId: null, authMode: 'guest' });
    navigate('home');
    showToast('guest mode');
  };

  const emailValid = EMAIL_RE.test(email.trim());
  const showEmailError = path === 'email' && emailTouched && email.trim().length > 0 && !emailValid;
  const canContinue =
    !busy &&
    name.trim().length > 0 &&
    (path === 'apple' || (emailValid && password.length >= 6));

  const onForgotPassword = async () => {
    if (busy) return;
    if (!emailValid) {
      showToast('enter your email first');
      return;
    }
    const r = await resetPassword(email.trim());
    if (r.ok) showToast('reset link sent (check your email)');
    else showToast("couldn't send reset link — try again");
  };

  const welcome = (displayName: string) => {
    const first = displayName.split(/\s+/)[0].toLowerCase();
    showToast('welcome, ' + first);
  };

  // Local-only fallback so demos keep working without a backend.
  const finishLocal = (offline: boolean) => {
    update({
      signedIn: true,
      guestMode: false,
      email: path === 'email' ? email.trim() : '',
      profileName: name.trim(),
      userId: null,
      authMode: 'demo',
    });
    navigate('home');
    if (offline) showToast('offline demo mode');
    else welcome(name.trim());
  };

  const finish = async () => {
    if (!canContinue) return;
    setAuthError(null);

    if (path === 'apple' || !backendAvailable()) {
      finishLocal(path === 'email');
      return;
    }

    setBusy(true);
    try {
      const cleanEmail = email.trim();
      const cleanName = name.trim();
      const displayName = cleanName || cleanEmail.split('@')[0];
      const username = (cleanName || cleanEmail.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '') || cleanEmail.split('@')[0].toLowerCase();

      let res = await signInWithEmail(cleanEmail, password);
      if (!res.ok) {
        if (res.error === 'BACKEND_UNAVAILABLE' || /network|fetch/i.test(res.error ?? '')) {
          finishLocal(true);
          return;
        }
        // Invalid credentials: either wrong password or no account yet — try sign-up.
        const signup = await signUpWithEmail(cleanEmail, password);
        if (signup.ok) {
          const prof = await upsertProfile(username, displayName);
          if (!prof.ok && prof.error === 'USERNAME_TAKEN') {
            setAuthError('that username is taken');
            return;
          }
          res = signup;
        } else if (/already|registered|exists/i.test(signup.error ?? '')) {
          setAuthError('wrong password — try again');
          return;
        } else if (/network|fetch/i.test(signup.error ?? '') || signup.error === 'BACKEND_UNAVAILABLE') {
          finishLocal(true);
          return;
        } else {
          setAuthError(signup.error?.toLowerCase() ?? 'sign in failed');
          return;
        }
      }

      update({
        signedIn: true,
        guestMode: false,
        email: cleanEmail,
        profileName: displayName,
        userId: res.userId ?? null,
        authMode: 'supabase',
      });
      navigate('home');
      welcome(displayName);
    } catch {
      // Never crash the sign-in screen — degrade to local demo mode.
      finishLocal(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
        {step === 1 ? (
          <View style={s.stepOne}>
            <View style={s.brand}>
              <Text style={s.kicker}>STYLE DNA</Text>
              <Text style={s.wordmark}>outft.</Text>
              <Text style={s.tagline}>
                Your wardrobe leaves a trace.{'\n'}Start seeing the pattern.
              </Text>
            </View>

            <View style={s.actions}>
              <Pressable style={[s.pill, s.pillFilled]} onPress={startEmail}>
                <Text style={s.pillFilledText}>Continue with email</Text>
              </Pressable>
              <Pressable style={[s.pill, s.pillOutline]} onPress={startApple}>
                <Text style={s.pillOutlineText}>{''}  Continue with Apple</Text>
              </Pressable>
              <Pressable style={s.guest} onPress={startGuest} hitSlop={8}>
                <Text style={s.guestText}>EXPLORE AS GUEST</Text>
              </Pressable>
              <Text style={s.legal}>
                By continuing, you agree to the Terms of Use and Privacy Policy.
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.stepTwo}>
            <Pressable onPress={() => transitionTo(1)} hitSlop={14} style={s.back}>
              <Text style={s.backGlyph}>←</Text>
            </Pressable>

            <Text style={s.heading}>Create your trace.</Text>

            {path === 'email' && (
              <View style={s.field}>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  onBlur={() => setEmailTouched(true)}
                  onSubmitEditing={() => setEmailTouched(true)}
                  placeholder="your email"
                  placeholderTextColor="rgba(240,235,227,0.35)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {showEmailError && (
                  <Text style={s.error}>that doesn't look like an email</Text>
                )}
              </View>
            )}

            {path === 'email' && (
              <View style={s.field}>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="password (6+ characters)"
                  placeholderTextColor="rgba(240,235,227,0.35)"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={onForgotPassword} hitSlop={8} style={s.forgot}>
                  <Text style={s.forgotText}>forgot password?</Text>
                </Pressable>
              </View>
            )}

            <View style={s.field}>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="your name"
                placeholderTextColor="rgba(240,235,227,0.35)"
                autoCorrect={false}
              />
            </View>

            {authError && <Text style={s.error}>{authError}</Text>}

            <Pressable
              style={[s.pill, s.pillFilled, s.continueBtn, !canContinue && { opacity: 0.35 }]}
              onPress={finish}
              disabled={!canContinue}
            >
              {busy ? (
                <View style={s.busyRow}>
                  <ActivityIndicator size="small" color={colors.ink} />
                  <Text style={s.pillFilledText}>One moment…</Text>
                </View>
              ) : (
                <Text style={s.pillFilledText}>Continue</Text>
              )}
            </Pressable>
          </View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },

  // Step 1
  stepOne: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  brand: { paddingTop: 120 },
  kicker: {
    fontFamily: fonts.sans, fontSize: 10, letterSpacing: 4,
    color: colors.sand, textTransform: 'uppercase', marginBottom: 14,
  },
  wordmark: { fontFamily: fonts.serifLight, fontSize: 64, color: CREAM },
  tagline: {
    fontFamily: fonts.serifItalic, fontSize: 22, lineHeight: 34,
    color: CREAM, opacity: 0.75, marginTop: 16,
  },
  actions: { paddingBottom: 40, gap: 12 },
  pill: {
    borderRadius: 999, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  pillFilled: { backgroundColor: CREAM },
  pillFilledText: {
    fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 1, color: colors.ink,
  },
  pillOutline: { borderWidth: 1, borderColor: 'rgba(240,235,227,0.3)' },
  pillOutlineText: {
    fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 1, color: CREAM,
  },
  guest: { alignItems: 'center', paddingVertical: 10 },
  guestText: {
    fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2,
    color: 'rgba(240,235,227,0.55)', textTransform: 'uppercase',
  },
  legal: {
    fontFamily: fonts.sans, fontSize: 9, letterSpacing: 0.4,
    color: 'rgba(240,235,227,0.45)', textAlign: 'center', marginTop: 4,
  },

  // Step 2
  stepTwo: { flex: 1, paddingHorizontal: 28, paddingTop: 64 },
  back: { alignSelf: 'flex-start', marginBottom: 28 },
  backGlyph: { fontSize: 22, color: CREAM },
  heading: { fontFamily: fonts.serif, fontSize: 30, color: CREAM, marginBottom: 36 },
  field: { marginBottom: 28 },
  input: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(240,235,227,0.3)',
    paddingVertical: 10, color: CREAM,
    fontFamily: fonts.serif, fontSize: 17, backgroundColor: 'transparent',
  },
  error: {
    fontFamily: fonts.sans, fontSize: 10, letterSpacing: 0.5,
    color: colors.error, marginTop: 6,
  },
  continueBtn: { marginTop: 12 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forgot: { alignSelf: 'flex-start', marginTop: 10 },
  forgotText: {
    fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1,
    color: 'rgba(240,235,227,0.55)', textTransform: 'uppercase',
  },
});
