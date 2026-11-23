// Feature flags. Set in app/.env (local) or the EAS build profile env. Every
// flag reads EXPO_PUBLIC_FLAG_<NAME> as on/off; see the README "Flags" table.

const on = (v: string | undefined, fallback: boolean) =>
  v == null || v === '' ? fallback : /^(1|true|on|yes)$/i.test(v);

const list = (v: string | undefined) =>
  (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export const FLAGS = {
  // Full first-run flow: terms, five photos, first Style DNA read, share.
  onboarding: on(process.env.EXPO_PUBLIC_FLAG_ONBOARDING, true),
  // "Add another photo to sharpen your read" prompt after DNA or twin views.
  sharpenPrompt: on(process.env.EXPO_PUBLIC_FLAG_SHARPEN_PROMPT, false),
  // Free tier limits and the paywall screen. Payments stay off either way.
  pricing: on(process.env.EXPO_PUBLIC_FLAG_PRICING, false),
  // Opt-in notification settings for daily reminders, Wrapped, twin matches.
  reengagement: on(process.env.EXPO_PUBLIC_FLAG_REENGAGEMENT, false),
  // Camera uploads go through Supabase storage and a background analysis
  // worker. Off until that worker is deployed: without it every photo waits
  // for the 90 second poll to time out before the direct read runs.
  queuePipeline: on(process.env.EXPO_PUBLIC_FLAG_QUEUE_PIPELINE, false),
};

// Testers who see the sharpen prompt even when the flag is off for everyone.
const SHARPEN_TESTERS = list(process.env.EXPO_PUBLIC_SHARPEN_TESTERS);

export function sharpenPromptEnabled(email: string): boolean {
  return FLAGS.sharpenPrompt || (!!email && SHARPEN_TESTERS.includes(email.trim().toLowerCase()));
}

export const WEBSITE_URL = (process.env.EXPO_PUBLIC_WEBSITE_URL ?? 'https://outft.app').replace(/\/$/, '');
export const TERMS_URL = `${WEBSITE_URL}/terms`;
export const PRIVACY_URL = `${WEBSITE_URL}/privacy`;
// Must match TERMS_VERSION / PRIVACY_VERSION in the website's lib/legal.ts.
export const LEGAL_VERSION = '2026-11-15';

export const ONBOARDING_PHOTOS = 5;
export const FREE_INTRO_ANALYSES = 5;
export const FREE_MONTHLY_ANALYSES = 2;
export const PRICE_MONTHLY = '$9.99';
export const PRICE_YEARLY = '$49.99';
