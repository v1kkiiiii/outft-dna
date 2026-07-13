# OUTFT — Acceptance Tests & QA Plan

**Owner:** Independent QA agent
**Source of truth:** Master PRD v1.0 (2026-07-13), §5, §17.2, §18
**Status:** Frozen for P0. Changes require lead approval.

Decision standard (PRD): *The app is complete only when the real core journey works securely on a physical iPhone, persists after restart, and passes independent verification.*

QA independence rule: QA and security do not certify code they authored. "Implemented" without tool/test evidence is not completion.

---

## 1. P0 Acceptance Scenarios (AC-P0-001 .. AC-P0-012)

Conventions used below:

- **Auto** = executable via CI or scripted command. **Device** = manual step on a supported physical iPhone. **Both** = automated check plus device confirmation.
- Environment: staging Supabase project unless stated. Production data is never used.
- Test identities: `qa-user-a@outft.test` (User A), `qa-user-b@outft.test` (User B), anonymous client (no JWT).
- All commands run from repo root. `$API` = staging Edge Function base URL, `$SB` = staging Supabase project ref.

---

### AC-P0-001 — Account creation and session persistence

**Given** a new valid user with no existing OUTFT account
**When** account creation and verification complete
**Then** a secure session and profile-onboarding state persist after a full app restart.

Verification steps:

1. *(Device)* Fresh install of the preview EAS build. Complete sign-up with a new email; complete verification (link or one-time code per founder auth decision).
2. *(Device)* Confirm the app lands in profile onboarding (not Home, not Welcome).
3. *(Device)* Force-quit the app (swipe away from app switcher). Relaunch. **Pass:** app resumes at onboarding with the same session; no re-login prompt.
4. *(Auto)* Token storage check — session token must be in secure storage, not AsyncStorage:
   ```bash
   npm run test -- --testPathPattern auth/secure-storage
   grep -rn "AsyncStorage" app/ src/ | grep -iE "token|session|jwt" && echo "FAIL: token in AsyncStorage" || echo "PASS"
   ```
5. *(Auto)* Server-side: confirm a single auth user row exists and no duplicate accounts were created on retry:
   ```bash
   supabase db query "select count(*) from auth.users where email = 'qa-user-a@outft.test';" --project-ref $SB
   # expected: 1
   ```
6. *(Auto)* Event check: `signup_started` and `signup_completed` fired exactly once each (PostHog staging project, filtered to the QA device ID).

Failure modes to also exercise: expired verification code, wrong credentials, rate-limited attempts — each must show its defined state from PRD §9.1 (no crash, no silent success).

---

### AC-P0-002 — Profile creation and duplicate username

**Given** an authenticated user without a profile
**When** they submit an available valid username and display name
**Then** the server stores the profile and Home opens. A duplicate username produces `USERNAME_TAKEN` without losing form data.

Verification steps:

1. *(Device)* As User A, enter username `qa_alpha`, display name "QA Alpha", accept policies. **Pass:** Home opens with first-trace empty state.
2. *(Auto)* Server confirms profile row and consent versions:
   ```bash
   supabase db query "select username, onboarding_completed_at, terms_version, privacy_version from public.profiles where username = 'qa_alpha';" --project-ref $SB
   # expected: 1 row, onboarding_completed_at not null, both versions recorded
   ```
3. *(Device)* As User B, attempt username `qa_alpha` and also `QA_Alpha` (case-insensitivity check). **Pass:** inline `USERNAME_TAKEN` error; display name and bio fields retain their entered values; no navigation.
4. *(Auto)* Unit tests for username rules (3–24 chars; lowercase letters, numbers, periods, underscores; reserved-name list):
   ```bash
   npm run test -- --testPathPattern profile/username-rules
   ```
5. *(Auto)* Negative API test: direct insert of duplicate username via Supabase client returns constraint violation, not success (covered in RLS/constraint test suite).
6. *(Auto)* Event check: `profile_completed` fired once for User A.

---

### AC-P0-003 — Capture durability and GPS stripping

**Given** camera permission granted
**When** the user captures a supported outfit image
**Then** a durable local record exists before navigation and the normalized image contains no GPS metadata.

Verification steps:

1. *(Device)* Grant camera permission, capture an outfit photo. Immediately after the shutter (before any upload progress is visible), force-quit the app. Relaunch. **Pass:** the capture exists as a local draft/pending trace — it did not vanish.
2. *(Auto)* EXIF stripping unit test using a fixture image with embedded GPS + full EXIF:
   ```bash
   npm run test -- --testPathPattern capture/exif-strip
   ```
3. *(Auto)* End-to-end metadata check on the actual uploaded object: download the normalized object from staging storage with a signed URL and inspect it:
   ```bash
   npx exiftool /tmp/qa-downloaded-normalized.jpg | grep -iE "gps|location" && echo "FAIL: GPS present" || echo "PASS: no GPS"
   ```
4. *(Auto)* Normalization bounds: normalized upload ≤ 6 MB and ≤ 3072 px longest edge; original ≤ 20 MB accepted, larger rejected with `IMAGE_TOO_LARGE`; sub-512 px rejected with `IMAGE_DIMENSIONS_UNSUPPORTED` (unit + worker validation tests).
5. *(Auto)* SQLite durability test: local record row (with UUID and idempotency key generated *before* first network call) exists in the local queue table before navigation — component/integration test with network mocked off.
6. *(Auto)* Events: `capture_started`, `image_selected`, `upload_queued` fired in order.

---

### AC-P0-004 — Offline capture, restart survival, single upload

**Given** no network connection
**When** the user captures an image
**Then** it is labeled "Waiting for connection", survives restart, and uploads exactly once after reconnection.

Verification steps:

1. *(Device)* Enable Airplane Mode. Capture an outfit. **Pass:** UI shows "Waiting for connection"; it does NOT claim analysis is complete or show fake progress.
2. *(Device)* Force-quit and relaunch while still offline. **Pass:** the draft persists with the same waiting state.
3. *(Device)* Disable Airplane Mode. **Pass:** upload resumes automatically without user action; state progresses Uploading → In queue → Analyzing → Ready.
4. *(Auto)* Exactly-once check — one outfit row, one storage object, one analysis job for the idempotency key:
   ```bash
   supabase db query "select client_idempotency_key, count(*) from public.outfits where owner_id = '<user-a-uuid>' group by 1 having count(*) > 1;" --project-ref $SB
   # expected: 0 rows
   supabase db query "select outfit_id, count(*) from public.analysis_jobs group by 1 having count(*) > 1;" --project-ref $SB
   # expected: 0 rows (one active/terminal job per outfit for this flow)
   ```
5. *(Auto)* Integration test simulating connectivity flap mid-upload: upload retries with the same idempotency key; server dedupes (queue/idempotency test suite).
6. *(Device)* Cancel path: capture offline, delete the draft before reconnection. **Pass:** nothing uploads after reconnection.

---

### AC-P0-005 — Real analysis, schema validity, correct owner, no bundled secrets

**Given** a valid uploaded image
**When** analysis completes
**Then** the saved result passes schema validation, records model/prompt versions, belongs to the correct user, and no provider secret exists in the mobile bundle.

Verification steps:

1. *(Device)* Complete a capture→analysis flow on staging with a real image. **Pass:** result receipt shows insight, 4 aesthetic scores summing to 100, colors, garments, traits.
2. *(Auto)* Schema validation of the stored row against OutfitAnalysisV1 (schemaVersion, modelVersion, promptVersion present; confidence in [0,1]; scores sum to 100 ± 0.5; insight ≤ 140 chars; labels in versioned taxonomy):
   ```bash
   npm run test -- --testPathPattern analysis/schema-v1
   supabase db query "select schema_version, model_version, prompt_version from public.style_analyses order by created_at desc limit 1;" --project-ref $SB
   # expected: all three non-null
   ```
3. *(Auto)* Ownership: the analysis's outfit `owner_id` equals User A's UUID (integration test + spot query).
4. *(Auto)* Secret scan of the built mobile bundle — the release blocker check:
   ```bash
   npx expo export --platform ios --output-dir /tmp/outft-bundle
   grep -rEl "sk-ant|ANTHROPIC_API_KEY|EXPO_PUBLIC_ANTHROPIC|service_role" /tmp/outft-bundle && echo "FAIL: secret in bundle" || echo "PASS"
   npm run scan:secrets   # gitleaks/trufflehog over repo history
   ```
5. *(Auto)* Confirm no direct mobile→provider network path exists: static check that no `api.anthropic.com` (or any provider host) appears in app source or bundle.
6. *(Auto)* Events: `analysis_queued`, `analysis_completed`, `result_viewed` fired with correlation ID linking mobile op → API → job → worker attempt.

---

### AC-P0-006 — Failure honesty: no mock results, retryable error surfaced

**Given** a provider timeout
**When** retries are exhausted (max 3 attempts, capped exponential backoff with jitter)
**Then** the user sees a retryable error and no mock result is displayed or saved.

Verification steps:

1. *(Auto)* Worker test with provider mocked to time out: job transitions `analyzing → analysis_failed_retryable` and, after 3 attempts, stops; `attempt_count = 3`; `error_code` set; no `style_analyses` row inserted:
   ```bash
   npm --prefix worker run test -- --testPathPattern retry-exhaustion
   ```
2. *(Auto)* Grep-level guard: `mockAnalysis` / demo fixtures are not reachable from production code paths:
   ```bash
   grep -rn "mockAnalysis" app/ src/ worker/ && echo "FAIL: mock path present" || echo "PASS"
   ```
3. *(Device)* With staging kill switch enabled (or provider stubbed to 5xx), run a capture. **Pass:** UI shows a non-blaming retryable message ("temporarily unavailable" state), a Retry action, and never a plausible-looking result.
4. *(Device)* Tap Retry after the provider recovers. **Pass:** same outfit is reused — History shows one trace, not duplicates.
5. *(Auto)* Terminal-failure test: non-outfit/corrupted fixture → `analysis_failed_terminal`, user prompted to choose another image, no retry loop.
6. *(Auto)* Event: `analysis_failed` fired with error classification, no `analysis_completed`.

---

### AC-P0-007 — History persistence and immutability across restart

**Given** a ready trace
**When** the app is force-closed and reopened
**Then** the trace appears in History and opens with the same immutable analysis.

Verification steps:

1. *(Device)* With ≥1 saved trace, force-quit and relaunch. Open History. **Pass:** trace present with thumbnail, category, date, dominant aesthetic.
2. *(Device)* Open the trace detail. **Pass:** identical insight text, scores, colors, garments as before restart.
3. *(Auto)* Immutability at the database layer — updates to `style_analyses` are rejected:
   ```bash
   supabase db query "update public.style_analyses set insight = 'tampered' where id = '<analysis-id>';" --project-ref $SB
   # expected: permission denied / trigger rejection
   ```
   (Encoded as a database test in the RLS/constraint suite.)
4. *(Auto)* Cursor pagination test: seed 60 traces for a test user, verify pages are stable, ordered reverse-chronologically, grouped by month, with no duplicates or gaps across pages.
5. *(Device)* Offline History: enable Airplane Mode, open History. **Pass:** cached traces render with an offline-cache label; no crash; pull-to-refresh shows an actionable offline error.
6. *(Auto)* Performance gate (PRD §5.3): History initial load p95 < 1.5 s warm cache / < 3 s typical mobile connection — measured via Sentry performance transaction in staging beta.
7. *(Auto)* Event: `history_viewed` fired.

---

### AC-P0-008 — Cross-user isolation (zero-tolerance guardrail)

**Given** users A and B plus an anonymous client
**When** each attempts to read or mutate A's private outfit
**Then** only A is allowed and all other attempts fail at database, storage, AND API layers.

Verification steps (this is the RLS allow/deny matrix — all automated, run in CI on every PR):

1. *(Auto)* Database layer — run the policy test suite with three clients (A JWT, B JWT, anon):
   ```bash
   npm run test:rls
   ```
   Matrix (every cell asserted, allow AND deny):
   | Operation | A | B | anon |
   |---|---|---|---|
   | select A's outfit row | ALLOW | DENY (0 rows) | DENY |
   | update A's outfit (caption) | ALLOW | DENY | DENY |
   | delete A's outfit | ALLOW | DENY | DENY |
   | select A's style_analyses | ALLOW | DENY | DENY |
   | select A's style_dna_snapshots | ALLOW | DENY | DENY |
   | select A's profile (private) | ALLOW | DENY* | DENY |
   | insert analysis row directly | DENY | DENY | DENY (server-only write) |

   \* per private-by-default visibility rules.
2. *(Auto)* Storage layer — B and anon request A's object path directly and via signed-URL forging:
   ```bash
   npm run test:storage-isolation
   # asserts: 403/404 on direct GET; signed URL for A's object cannot be minted by B; expired signed URL fails
   ```
3. *(Auto)* API layer — B calls `GET /v1/analysis-jobs/{A's jobId}` and `DELETE /v1/outfits/{A's outfitId}`; anon calls all privileged endpoints. **Pass:** `PERMISSION_DENIED` / `AUTH_REQUIRED` with stable error codes; no data leakage in error bodies.
4. *(Auto)* Object-path guessing: enumerate plausible object paths for A's bucket as B. **Pass:** all denied (threat model §15.2).
5. **Gate:** zero accepted cross-user events. Any single failure is a release blocker (PRD §5.4).

---

### AC-P0-009 — Outfit deletion completeness

**Given** a ready private trace
**When** its owner confirms deletion
**Then** it disappears immediately, all storage and analysis data are removed by the deletion job, DNA recomputes, and stale cache cannot restore it.

Verification steps:

1. *(Device)* Open a trace, choose Delete, read the consequence explanation, confirm. **Pass:** trace vanishes from History and Home immediately (tombstone hides it before the job completes).
2. *(Auto)* Deletion job completeness — after job completion:
   ```bash
   supabase db query "select status from public.outfits where id = '<outfit-id>';" --project-ref $SB          # deleted / absent per policy
   supabase db query "select count(*) from public.style_analyses where outfit_id = '<outfit-id>';" --project-ref $SB   # 0
   supabase db query "select count(*) from public.analysis_jobs where outfit_id = '<outfit-id>';" --project-ref $SB    # 0 or anonymized per policy
   # storage: attempt signed download of original_object_path and processed_object_path → must 404
   ```
3. *(Auto)* DNA recomputation: `style_dna_snapshots` has a new snapshot post-deletion whose `outfit_count` excludes the deleted trace; if the user drops below the evidence minimum, UI returns to Early DNA / insufficient state (unit test on aggregation + integration check).
4. *(Device)* Cache resurrection check: force-quit, enable Airplane Mode, relaunch. **Pass:** deleted trace does not reappear from local cache; thumbnail files are removed from app storage.
5. *(Auto)* Idempotent deletion: replaying the DELETE request with the same idempotency key returns success without error or side effects.
6. *(Auto)* Event: `outfit_deleted` fired once.

---

### AC-P0-010 — Account deletion

**Given** a user with outfits
**When** deletion is confirmed
**Then** sessions revoke, the app clears local data, server deletion completes, and the former user cannot authenticate or access signed assets.

Verification steps:

1. *(Device)* Settings → Account → Delete account. **Pass:** consequences, export option, and irreversibility are explained; reauthentication is required; confirmation is explicit.
2. *(Device)* After confirming: app clears secure session, SQLite database, caches, and image files, then returns to Welcome. Verify via app relaunch — no residual traces or session.
3. *(Auto)* Immediate revocation: the pre-deletion JWT is rejected on the next API call (`SESSION_EXPIRED`/`AUTH_REQUIRED`); attempts during cleanup return `ACCOUNT_DELETION_PENDING` where applicable.
4. *(Auto)* Server completion within SLA (99% within 24 h, PRD §5.3):
   ```bash
   supabase db query "select type, status, requested_at, completed_at from public.data_requests where user_id = '<deleted-user-uuid>' and type = 'deletion';" --project-ref $SB
   supabase db query "select count(*) from public.outfits where owner_id = '<deleted-user-uuid>';" --project-ref $SB   # 0
   # storage bucket listing for the user's prefix → empty
   ```
5. *(Auto)* Re-authentication attempt with the deleted credentials fails; previously issued signed URLs no longer resolve (expired by TTL and object gone).
6. *(Auto)* Audit: `audit_events` records the account-lifecycle event with allowlisted metadata only (no images, tokens, or content).
7. *(Auto)* Events: `account_deletion_requested` and `account_deleted` fired; the analytics identity is severed afterward.
8. *(Auto)* Resumability test: kill the deletion job mid-run in staging, restart it. **Pass:** it completes without error or partial-state corruption.

---

### AC-P0-011 — Clean-machine build and physical-device install

**Given** a clean machine following README steps
**When** dependencies and environment are configured
**Then** typecheck/tests pass and a preview EAS build installs on a supported physical iPhone.

Verification steps:

1. *(Auto)* Clean-machine simulation (fresh macOS runner or new user account; no global caches):
   ```bash
   git clone <repo> /tmp/outft-clean && cd /tmp/outft-clean
   # follow README verbatim — deviation from README is itself a finding
   npm ci
   npm run typecheck
   npm run test
   npm run lint
   ```
   **Pass:** every command exits 0 using only README instructions. Any undocumented step, missing env variable, or manual fix is a blocker finding.
2. *(Auto)* Environment validation: `npm run validate:env` (or equivalent) fails loudly with a helpful message when a required staging variable is absent.
3. *(Auto)* Build:
   ```bash
   npx eas build --profile preview --platform ios --non-interactive
   ```
   **Pass:** build succeeds without local credentials hacks.
4. *(Device)* Install the preview build on at least one small-screen and one current large-screen physical iPhone (per §16 device matrix). **Pass:** app launches, sign-in works against staging.
5. *(Auto)* CI parity: the same checks that pass locally pass in GitHub Actions on the PR (no "works on the runner only" divergence).

---

### AC-P0-012 — Accessibility of the critical journey

**Given** VoiceOver enabled and enlarged text (Dynamic Type at accessibility sizes)
**When** the user completes auth, capture, result, history, and deletion
**Then** all essential controls are reachable, named, ordered, and readable without clipping.

Verification steps:

1. *(Auto)* Accessibility automation in component tests: every interactive element in the five critical flows has an accessibility name/role; touch targets ≥ 44×44 pt; contrast tokens meet WCAG 2.1 AA (checked against the theme palette):
   ```bash
   npm run test:a11y
   ```
2. *(Device, VoiceOver)* With VoiceOver on, complete: sign-in → capture → view result → open History → delete an outfit. **Pass per screen:** logical focus order; every essential control announced with name + role + state; error messages announced when they appear; no unreachable control; decorative elements skipped.
3. *(Device, Dynamic Type)* Set text size to the largest accessibility setting. Repeat the journey. **Pass:** no clipped labels, no hidden/overlapping actions, forms remain submittable, keyboard avoidance works.
4. *(Device, Reduced Motion)* Enable Reduce Motion. **Pass:** nonessential transforms and autoplay are disabled; flows remain fully usable.
5. *(Device)* Color-blindness spot check: upload/analysis states (waiting, analyzing, failed, ready) are distinguishable without color alone (icon/text present).
6. *(Device)* Outfit images expose useful alt descriptions to VoiceOver (e.g. derived from analysis labels), not raw filenames.

---

## 2. Automated Test Layer Plan (PRD §18.1)

All layers run in GitHub Actions on every PR (PRD §19). Directory layout assumes the ownership map in `docs/AGENTS.md` (mobile `app/`, backend `supabase/`, ML `worker/`).

| # | Layer | Tooling | Covers | Location in repo |
|---|-------|---------|--------|------------------|
| 1 | **Unit** | Jest + TypeScript (`ts-jest` / babel-jest); Zod schemas as the validation source | OutfitAnalysisV1 schema validation, DNA aggregation math (normalization, top-4, trait thresholds, evidence windows), outfit state-machine transitions, retry classification (retryable vs terminal), idempotency-key generation, date/month grouping, privacy helpers (EXIF strip, log redaction) | `app/src/**/__tests__/`, `worker/src/**/__tests__/`, shared logic in `packages/shared/__tests__/` (or `app/src/lib/__tests__/` if no shared package) |
| 2 | **Component** | React Native Testing Library + Jest; MSW (or adapter mocks) for network | Every meaningful screen state per PRD §9: loading, empty, error, permission-denied, offline, rate-limited, and success for Welcome/Auth, Onboarding, Home, Capture, Progress, Result, DNA, History, Settings | `app/src/components/**/__tests__/`, `app/src/screens/**/__tests__/` |
| 3 | **API contract** | OpenAPI (`docs/API.openapi.yaml`) as frozen source; `openapi-typescript` for generated types; Dredd or schemathesis (or supertest-based conformance suite) against staging functions; drift check that regenerated types match committed types | Generated client/server compatibility, stable error envelope (machine code + safe message + correlation ID + retry class) for every endpoint in PRD §13.2, idempotency-key acceptance on all mutations | `tests/contract/`; generated types in `packages/shared/api-types/` (generated, never hand-edited); drift check in CI (`npm run check:api-drift`) |
| 4 | **Database** | Supabase CLI (`supabase db reset` on empty DB) + pgTAP or SQL-driven Jest suite with three role clients (User A, User B, anon; plus moderator when P1 lands) | All migrations apply cleanly on an empty database in order; full RLS allow/deny matrix for every owner-scoped table; constraint checks (unique username CI, unique (owner_id, client_idempotency_key), confidence range, status enums, self-block prohibition); style_analyses immutability | `supabase/tests/` (policy specs beside `supabase/migrations/`) |
| 5 | **Worker** | Jest (or Vitest) with the provider adapter fully mocked; fixture images from the evaluation set (PRD §10.6) | Job leasing, timeout handling, invalid provider output → `ANALYSIS_INVALID_OUTPUT` (never a saved bad row), retry with backoff/jitter capped at 3, request-hash deduplication, single-transaction immutable insert + outfit ready + DNA recompute scheduling, kill-switch behavior | `worker/src/**/__tests__/`, fixtures in `worker/fixtures/` |
| 6 | **Integration** | Jest + Supabase JS client + supertest against a disposable local Supabase stack (`supabase start`) with provider mocked | Full slices: auth → profile; upload-intent → signed upload → analysis job → completion; history pagination; outfit deletion job; account export/deletion lifecycle; error taxonomy end to end | `tests/integration/` |
| 7 | **End-to-end (mobile)** | **Maestro** (primary — YAML flows, good Expo fit) on iOS simulator in CI; the same flows re-run manually on physical iPhone per §18.2 device steps | Critical journeys: first-time happy path (§8.1), offline capture (§8.2), failure/retry (§8.3), outfit deletion (§8.4), restart persistence | `e2e/flows/*.yaml`; run script `npm run e2e` |
| 8 | **Accessibility** | eslint-plugin-react-native-a11y (static) + RNTL accessibility assertions (automated) + manual VoiceOver/Dynamic Type/Reduce Motion protocol (AC-P0-012) | Names/roles/targets/contrast automated; focus order, announcement, and real screen-reader usability verified manually — automation alone never passes AC-P0-012 | Static+component checks live with layer 2; manual protocol and results log in `docs/qa/a11y-runs/` |
| 9 | **Security scan** | gitleaks (repo + history) and trufflehog; `npm audit` + Dependabot; `npx expo config --type public` validation (no secret-bearing keys in public config); bundle grep for provider hosts/keys (AC-P0-005 step 4); generated-schema drift check | Zero secrets in source, history, or bundles; no vulnerable dependency above threshold; Expo config sanity; contract/type drift | `.github/workflows/ci.yml` jobs `secret-scan`, `dep-audit`, `config-check`; config in `.gitleaks.toml` |

CI ordering: layers 1–5 and 9 on every PR; layer 6 on every PR against ephemeral local Supabase; layer 7 nightly + on release branches (simulator), physical-device runs at every vertical-slice gate (Wave 3+).

---

## 3. Definition of Complete — Release Gates (PRD §18.3)

P0 is **complete only when ALL of the following hold**. Each gate requires attached evidence; a claim without command output, test report, or device recording does not count.

| Gate | Requirement | Evidence required |
|------|-------------|-------------------|
| G1 | All 12 acceptance scenarios AC-P0-001..012 pass | Per-scenario checklist with command outputs, CI run links, and device photos/screen recordings; signed off by Independent QA (who did not author the code) |
| G2 | Security audit: zero critical findings | Security agent's audit report covering §15.2 threat model; re-test evidence for any remediated finding |
| G3 | Independent QA: zero blocker bugs | QA bug list with severities; all blockers closed and re-verified |
| G4 | Reliability thresholds met in staging beta | Sentry/analytics dashboards: crash-free sessions ≥ 99.5%; analysis success ≥ 97%; analysis latency p50 < 15 s, p95 < 45 s; upload retry success ≥ 95%; History load p95 within targets (§5.3) |
| G5 | Clean-machine setup succeeds | AC-P0-011 log from a fresh environment, README followed verbatim |
| G6 | Physical-iPhone verification | Preview EAS build installed and the full core journey completed on ≥ 2 supported physical devices (one small-screen, one current large-screen) |
| G7 | Guardrails at zero (§5.4) | Zero cross-user access events, zero production demo/mock responses, zero secrets in source or bundles — CI scan outputs and isolation-suite results |
| G8 | Lead evidence package | Lead compiles commands, test reports, database policy test results, and physical-device results into the release record |

Standing rules:

- No agent or CI job submits to the App Store, changes billing, or deletes production data without recorded human approval (PRD §19).
- Production never returns a result labeled or derived from demo/mock analysis; any occurrence reopens G7 regardless of other gates.
- A gate that passed and then regresses (e.g., a new migration breaks an RLS test) re-blocks release until re-verified.

---

## Appendix A — P0 Product Event Taxonomy (PRD §17.2)

QA verifies each event fires at the correct moment, exactly once per logical action, with correlation ID present and privacy rules honored.

| Event | Fires when | QA verification point |
|-------|-----------|----------------------|
| `signup_started` | User begins authentication (submits first auth step) | AC-P0-001 |
| `signup_completed` | Account created and verified | AC-P0-001 |
| `profile_completed` | Server confirms onboarding completion | AC-P0-002 |
| `capture_started` | User opens capture (camera or library) | AC-P0-003 |
| `image_selected` | Image captured/picked and validated locally | AC-P0-003 |
| `upload_queued` | Durable local record + queue entry created | AC-P0-003/004 |
| `upload_completed` | Storage upload confirmed by server | AC-P0-004 |
| `analysis_queued` | Analysis job created | AC-P0-005 |
| `analysis_completed` | Validated result stored, outfit ready | AC-P0-005 |
| `analysis_failed` | Job reaches retryable-exhausted or terminal failure | AC-P0-006 |
| `result_viewed` | Result receipt rendered to the user | AC-P0-005 |
| `trace_saved` | User confirms/saves the trace to archive | AC-P0-007 |
| `history_viewed` | History screen opened | AC-P0-007 |
| `outfit_deleted` | Owner confirms outfit deletion | AC-P0-009 |
| `export_requested` | User requests data export | Settings flow |
| `account_deletion_requested` | User confirms account deletion | AC-P0-010 |
| `account_deleted` | Server deletion job completes | AC-P0-010 |

Privacy assertions (checked in the analytics pipeline tests and by staging payload inspection):

- **Never present in any event payload:** image content or bytes, analysis free text (insight), email address, exact username, auth tokens, signed URLs.
- Consent and regional requirements respected; analytics consent toggle in Settings is honored (events stop when consent is withdrawn where required).
- One correlation ID connects mobile operation → API request → analysis job → worker attempt → provider call (verified in AC-P0-005).

North-star measurement dependency: `analysis_completed` + `result_viewed` + `trace_saved` + 24-hour retention define a *meaningful saved trace* (PRD §5.1) — QA confirms these events are reliable enough to compute it.
