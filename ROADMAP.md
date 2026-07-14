# OUTFT — Build Roadmap (prototype → shipped app)

Grounded in the Master PRD v1.0 (§6 scope, §18 acceptance, §20 waves). This is the
plan to take the current working prototype to a real, secure, App-Store app.

## Where we are today

- **Prototype app** (`app/`): every screen, Instagram-style UI, camera, saves, echoes,
  affiliate brand picks. Data is local (AsyncStorage). Analysis calls Claude via a key
  bundled in the app (fine for demo, must move server-side).
- **Backend built, not deployed** (`supabase/`, `worker/`): real Postgres schema, row-level
  security, private storage, and the analysis worker that runs Claude server-side.
- **Contracts frozen** (`docs/`): product spec, API, DB schema, ML, security, acceptance tests.

## What "done" means (PRD §1)

A real user can: create an account → make a profile → capture/select an outfit →
get a real analysis → save it → reopen the app and still see it → delete an outfit →
delete their account — all on a physical iPhone, securely, with no data leaking between users.

---

## Wave A — Stand up the real backend  *(unblocks everything)*
Goal: the database and analysis worker are live and reachable.
1. Create a Supabase personal access token; link the CLI to the project.
2. Push migrations (`supabase db push`) — creates the 8 tables, RLS, storage buckets, worker RPCs.
3. Run the RLS test suite; confirm user-A / user-B / anon allow-deny matrix passes.
4. Deploy the worker to Railway/Render/Fly; set `ANTHROPIC_API_KEY`, `SUPABASE_*` env vars.
5. Smoke-test: insert a fake job row → worker analyzes → immutable result written.
**Needs from you:** Supabase access token, hosting account (free tier), the rotated API key.

## Wave B — Auth + profiles (real accounts)
Goal: replace the fake sign-in with real Supabase Auth.
1. Add `@supabase/supabase-js` to the app; secure session storage (not plain AsyncStorage).
2. Email sign-up / sign-in / sign-out / recovery; session persists across restarts.
3. Onboarding writes a real `profiles` row; unique username check server-side.
4. Avatar/cover upload to the private `avatars` bucket.
**Acceptance:** AC-P0-001, AC-P0-002.

## Wave C — Capture → upload → real analysis
Goal: the core loop runs through the backend, key off the phone.
1. Remove `EXPO_PUBLIC_ANTHROPIC_API_KEY` from the app (security release blocker R-01).
2. Capture → normalize/strip EXIF → upload to private `outfits` bucket → create outfit + job.
3. Poll job status; show truthful states (uploading, queued, analyzing, ready, failed, retry).
4. Result receipt reads the immutable `style_analyses` row.
**Acceptance:** AC-P0-003, AC-P0-005, AC-P0-006.

## Wave D — History, Style DNA, persistence
Goal: saved traces are real and survive restarts/devices.
1. History = paginated query of the user's outfits (grouped by month), offline cache.
2. Style DNA aggregation (PRD §9.7) computed from real analyses; Early/Stable states.
3. Backlog/saves/collections backed by real rows.
**Acceptance:** AC-P0-007.

## Wave E — Deletion + account lifecycle
Goal: users can remove data for real.
1. Outfit delete → removes storage + analysis, recomputes DNA, can't resurrect from cache.
2. Account delete → revokes sessions, wipes user data via monitored job, clears local state.
3. Data export request.
**Acceptance:** AC-P0-009, AC-P0-010.

## Wave F — Security hardening + verification
Goal: pass the release gates.
1. RLS adversarial tests (cross-user, object-path guessing, tampered JWT, webhook replay).
2. Rate limits, quotas, image validation (magic bytes, dimensions, size), log redaction.
3. Physical-iPhone QA of the full journey; accessibility (VoiceOver, Dynamic Type, contrast).
4. CI: typecheck, tests, migration on empty DB, RLS matrix, secret scan.
**Acceptance:** AC-P0-008, AC-P0-011, AC-P0-012 + Definition of Complete (§18.3).

## Wave G — P1 features (only after P0 is green)
- Explicit publishing of traces; public/private profiles; follow.
- Real social feed, likes, comments, saves, block, report, notifications.
- Style Twin discovery via documented similarity algorithm.
- **Affiliate/brand monetization**: real affiliate-network deep links, click attribution,
  brand dashboards (this is the revenue engine from the pitch — build it here, on real data).
- Premium: RevenueCat, server-authoritative entitlements, paywall (no client `isPremium`).
- Monthly Wrapped from real data.

## Wave H — Release
- Staging migration + preview EAS build + clean-machine test.
- TestFlight (needs Apple Developer, $99/yr): icon, bundle ID, privacy policy, terms.
- Rollback rehearsal; human approval before submission/billing.

---

## Your action items (gated, not code)
- [ ] Supabase personal access token (Wave A)
- [ ] Hosting account for the worker — Railway/Render/Fly, free tier (Wave A)
- [ ] Rotate + provide the Anthropic API key (server-side only) (Wave A/C)
- [ ] Apple Developer Program, $99/yr (Wave H only)
- [ ] Founder decisions from PRD §22 (age policy, premium pricing, social model)

## Order of operations
A → B → C → D → E → F  is the P0 spine (a real, shippable, secure app).
G and H come after P0 gates pass, exactly as the PRD requires.
