# outft.

A mobile-first outfit journal with camera capture and AI-powered style DNA analysis. This project combines the full outft. product prototype with the working DNA analyzer in one deployable Node application.

Live at: https://outft-dna-production.up.railway.app

## Run locally

Requirements: Node.js 20 or newer and an Anthropic API key.

```bash
npm install
cp .env.example .env
```

Put your key in `.env`, then run:

```bash
npm run dev
```

Open `http://localhost:3000`. The browser camera works on localhost. On a phone, use an HTTPS tunnel or deploy the app first.

## What works

- Responsive mobile product prototype
- Rear and front camera capture
- Photo upload fallback
- Server-side Anthropic vision request
- Style DNA percentages, tags, and insight
- Persistent local product state for traces, follows, messages, collections, profile, and premium demo access
- Latest captured outfit synchronized across Home, Profile, and Fashion DNA
- Demo sign-in with email, Apple, or guest mode
- Home and Friends’ Traces as a connected two-tab destination
- Portrait 3:4 capture presented as a polaroid-style barcode receipt
- DNA-first Twins view and priced Premium reminder in Activity
- Image-first friend traces integrated directly into Home with visible comments
- Persistent Camera navigation that remains reachable after saving a receipt
- Circular DNA summary and Wrapped entry on Twins
- Numbered polaroid treatment for Saves and Backlog
- Installable PWA metadata
- API health endpoint at `/api/health`

The app is now a fully connected local product demo. Seed feed content remains illustrative, while new traces, follows, messages, collection saves, profile edits, and premium demo access persist in the browser. Replace the local adapter with Supabase and StoreKit before production launch.

## Deploy

Deploy the repository to Railway, Render, or Fly.io.

- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `ANTHROPIC_API_KEY`
- Health check: `/api/health`

Never expose the Anthropic key in browser code.

## Next production milestone

Add Supabase authentication, Postgres tables, and Storage for user-uploaded outfit photos. Then connect the current prototype screens to persisted data before wrapping the PWA with Capacitor for the App Store and Google Play.

## Managing sponsored placements

Sponsored slots (the Twins "CURATED FOR YOUR DNA" grid and the Home spotlight card) are served from the `sponsored_placements` table — no app update needed. If the fetch fails or returns nothing, the app falls back to built-in placeholder picks, so pausing everything never leaves an empty slot.

Run these in the Supabase SQL editor:

```sql
-- Add a brand to the Twins grid (higher weight = shown first)
insert into sponsored_placements (brand, caption, dna_copy, tags, tone, shop_url, surface, weight)
values ('Acne Studios', 'Oversized wool, worn easy.', 'Matched to your relaxed-tailoring trace.', array['minimal','oversized'], '#C9C2B6', 'https://acnestudios.com', 'twins', 2);

-- Swap the Home spotlight card (dna_copy is the "lane" label after SPONSORED ·)
insert into sponsored_placements (brand, caption, dna_copy, tags, tone, shop_url, surface)
values ('Toteme', 'Shop the pieces closest to your trace.', 'Quiet luxury lane', array['quiet luxury'], '#DCD3C6', 'https://toteme-studio.com', 'home');

-- Pause a brand (resume with active = true)
update sponsored_placements set active = false where brand = 'COS';

-- Schedule a placement window
update sponsored_placements set starts_at = '2026-08-01', ends_at = '2026-08-31' where brand = 'Arket';
```

Changes appear in the app within 5 minutes (in-memory cache TTL).

## Onboarding, measurement, and growth (November 2026)

### How the system fits together

- **App:** Expo SDK 58 (React Native 0.88, TypeScript) in `app/`. Navigation is a hand-rolled screen switch in `app/App.tsx` and `app/src/state.tsx`.
- **Analysis:** the app posts a base64 photo to `POST /api/analyze` on this Express server (`server.js`, deployed on Railway). The server calls Claude (`claude-sonnet-5`) through `@anthropic-ai/sdk` with the 478-label taxonomy prompt and returns `{ aesthetics, tags, insight }`. The Anthropic key lives only in the server environment. `supabase/functions/analyze-image` and `worker/` hold an older queued pipeline that pointed at a Supabase project that no longer exists.
- **Auth:** Supabase email and password auth (`app/src/lib/authApi.ts`). Sessions are stored in the device keychain through `expo-secure-store`. Without `EXPO_PUBLIC_SUPABASE_URL` the app runs in local demo mode.
- **Storage:** Supabase Postgres (`supabase/migrations`) and a private Storage bucket for outfit photos, both owner-scoped by row level security. Local state and captures are cached in AsyncStorage.
- **Website:** the separate Next.js repo `sahanac-cpu/outft` (Vercel). It holds `/terms` and `/privacy`, and `lib/legal.ts` has the version string the app records on acceptance.

### Flags and configuration

| Flag | Where | Default | What it does |
|---|---|---|---|
| `EXPO_PUBLIC_FLAG_ONBOARDING` | app | on | New accounts go through terms, 5 photos, first Style DNA read, then share |
| `EXPO_PUBLIC_FLAG_SHARPEN_PROMPT` | app | off | Shows "Add another photo to sharpen your read" on the DNA and Twins screens |
| `EXPO_PUBLIC_SHARPEN_TESTERS` | app | empty | Comma-separated emails that see the sharpen prompt while the flag is off |
| `EXPO_PUBLIC_FLAG_PRICING` | app | off | Free tier limit in the app and the paywall screen. Payments are never charged |
| `EXPO_PUBLIC_FLAG_REENGAGEMENT` | app | off | Opt-in toggles for Wrapped and twin-match messages in Settings |
| `EXPO_PUBLIC_FLAG_QUEUE_PIPELINE` | app | off | Camera photos go through Supabase storage and the background analysis worker. Keep off until the worker is deployed, or every photo waits about 90 seconds before the direct read |
| `FEATURE_PRICING` | server | off | Server-side free tier check on `/api/analyze` (402 `LIMIT_REACHED`) |
| `FEATURE_REENGAGEMENT` | server | off | Enables `POST /api/admin/notify/:kind` |

What you need to configure:

1. **Create a Supabase project** and run every file in `supabase/migrations` in order (`supabase db push`, or paste them into the SQL editor). `0007_growth_metrics.sql` adds the events, AI cost, entitlements, notification, campaign, and referral tables.
2. **App env** (`app/.env` for local, the EAS profile `env` for builds): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEBSITE_URL` (where `/terms` and `/privacy` live), and the flags above. `eas.json` still points at the old Supabase project, so update it too.
3. **Railway env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never in the app), `ADMIN_TOKEN` (a long random string), `PUBLIC_BASE_URL` (used in unsubscribe links), and the server flags.
4. **Email:** `EMAIL_PROVIDER=stub` logs instead of sending. To send for real, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM`.
5. **Push:** `PUSH_PROVIDER=expo` sends through Expo's push service. It needs a development or store build, because Expo Go cannot receive remote push notifications.
6. **Daily reminder schedule:** run a daily cron (for example a Railway cron service) that calls `curl -X POST -H "x-admin-token: $ADMIN_TOKEN" $PUBLIC_BASE_URL/api/admin/notify/daily_reminder`. Call `wrapped_ready` and `twin_match` with `{"userIds": [...]}` when those events happen.

### Metrics

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/metrics.mjs        # table
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/metrics.mjs --json
```

The same data is available at `GET /api/admin/metrics` with the `x-admin-token` header. Per user it reports photos uploaded, time to first Style DNA read, photos before the first read, upload after a twin-match view, session count, and day-1 and day-7 return. It also reports average AI tokens and estimated dollars per analysis, plus onboarding cost (cost per analysis x median photos before the first read). Every number comes from `app_events` and `ai_cost_log` in our own database. Nothing goes to a third party.

### Admin APIs (all need `x-admin-token`)

- `POST /api/admin/campaigns` `{ brandName, code, styleCluster }` and `GET /api/admin/campaigns` (impressions, clicks, redemptions per code)
- `POST /api/campaigns/:code/events` `{ kind: impression | click | redemption, outfitId? }` (public, attaches the signed-in user when a token is sent)
- `POST /api/admin/referrals/credit` `{ userId }` when a referred user becomes a paid subscriber, and `GET /api/admin/referrals` for the leaderboard. Record only, no payouts.

### Pricing conflict to resolve

The pitch deck says the free tier includes a 30-day backlog and a yearly Wrapped. The new rule is 5 intro analyses, then 2 a month. These conflict in two places:

- **The backlog would be mostly empty.** With 2 analyses a month after the intro, a free user's 30-day backlog holds about 2 analysed outfits, so the promise is hollow.
- **The yearly Wrapped would be thin.** It would summarise about 29 reads in the first year (5 + 2 x 12). That is enough for a card, but much less than the daily ritual the deck describes.

Proposal: limit **AI analyses**, not **logging**. Free users can log an outfit every day, and every log is kept in a 30-day backlog. Only 5 intro logs, then 2 a month, get a full AI Style DNA read. Wrapped is built from all logged outfits plus the analysed ones. The free tier keeps the daily habit and still caps cost. This build enforces the limit only at analysis time, so this model fits it. Logging without analysis does not exist yet; it would be the next piece to build.
