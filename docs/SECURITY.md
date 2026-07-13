# OUTFT — Security & Privacy Specification

**CONTRACT — FROZEN v1**

Owner: Security/Privacy specialist agent. Source of truth: master PRD §3, §7.3, §12, §15, §19, §23.
Changes require Lead approval and regeneration of dependent consumers (tests, CI gates, policies).

---

## 1. Release Blockers Checklist (PRD §15.1)

Every item below is a hard gate. P0 does not ship to external beta until each item is verified by the stated method and evidence is attached to the completion report.

| # | Blocker | Verification method |
|---|---------|--------------------|
| 1 | **[R-01 — CRITICAL] Remove `EXPO_PUBLIC_ANTHROPIC_API_KEY` from `app/.env` and `app/src/analyze.ts`, remove all direct mobile-to-provider calls, and ROTATE the key.** The key has entered git history and distributed builds; it must be treated as compromised regardless of removal. **Action owner: founder, via the Anthropic console** (agents must not rotate production credentials — see §8 below). | (a) `git grep -i "EXPO_PUBLIC_ANTHROPIC"` across full history and working tree returns no live key; (b) secret-scan CI gate green; (c) `npx expo export` bundle string-scanned — zero provider keys; (d) founder confirms rotation timestamp in Anthropic console; old key rejected by a test call (401). |
| 2 | Supabase service-role key and RevenueCat webhook secret are server-only (Edge Functions / worker env), never in mobile code or `EXPO_PUBLIC_*` vars. | Bundle string-scan; `git grep` for `service_role`; CI secret scan; code review confirms only anon key ships in the app. |
| 3 | Private buckets for outfits and avatars; short-lived signed URLs only (minutes TTL); no public bucket policies. | Storage policy integration test: anonymous and non-owner GET of a known object path returns 400/403; signed URL expires and returns error after TTL. |
| 4 | JWT and ownership verified on every privileged operation (upload-intent, analysis-job create, delete, export, account delete, publish, moderation). | API integration tests: no token → `AUTH_REQUIRED`; expired token → `SESSION_EXPIRED`; user B token against user A resource → `PERMISSION_DENIED`. |
| 5 | Location metadata stripped client-side; server validates magic bytes, decoded dimensions, and size (≤20 MB original, ≤6 MB / ≤3072 px normalized, ≥512 px minimum). | AC-P0-003: normalized upload contains no GPS EXIF (automated EXIF read on uploaded object); server rejects renamed non-image (`IMAGE_TYPE_UNSUPPORTED`), oversized (`IMAGE_TOO_LARGE`), and undersized (`IMAGE_DIMENSIONS_UNSUPPORTED`) fixtures. |
| 6 | Rate, quota, and abuse limits enforced per user, per device, and per IP; one active job per outfit; request-hash dedupe; free-plan quotas; global analysis kill switch. | Load test exceeding limits returns `ANALYSIS_RATE_LIMITED`; duplicate job request returns existing job (no second row); kill switch flips responses to `ANALYSIS_TEMPORARILY_UNAVAILABLE` with no mock output. |
| 7 | Server alone writes `style_analyses`, `style_dna_snapshots`, entitlements, moderation state, and notifications. Clients have no INSERT/UPDATE path. | RLS deny tests: authenticated user INSERT/UPDATE on these tables fails; only service-role/worker path succeeds; `style_analyses` UPDATE/DELETE denied to all non-privileged roles (immutability). |
| 8 | Logging redaction enforced (see §5 below). | Redaction unit tests on the logging helper; grep of staging Sentry/log output during E2E run for base64 prefixes, `Bearer `, `@`-emails, signed-URL query params, prompt text — zero hits. |
| 9 | Account deletion removes database and storage data through a resumable, monitored job; sessions revoked immediately. | AC-P0-010: post-deletion auth fails; signed asset access fails; DB rows and storage objects gone; deletion job survives a forced mid-run crash and resumes to completion. |
| 10 | RLS tests pass the full user A / user B / anonymous / moderator matrix (see §3 below). | AC-P0-008 plus the matrix suite in CI on every PR against an empty migrated database. |

---

## 2. Threat Model (PRD §15.2)

Each threat maps to a concrete mitigation and a test that proves the mitigation works. A threat without a passing test is an open finding.

| Threat | Mitigation | Proving test |
|--------|-----------|--------------|
| Cross-user reads | Deny-by-default RLS on every owner-scoped table; privileged endpoints re-check ownership server-side. | RLS matrix (§3): user B SELECT on A's `outfits`, `style_analyses`, `style_dna_snapshots`, `profiles` (private) returns zero rows; API read of A's outfit with B's JWT → `PERMISSION_DENIED` / `CONTENT_NOT_VISIBLE`. |
| Object-path guessing in storage | Private buckets; non-enumerable UUID object paths; storage RLS keyed to owner; downloads only via short-lived signed URLs minted after ownership check. | Anonymous + user B GET of A's known object path → 403; sequential/guessed path probes → 403; signed URL for A unusable after expiry. |
| Tampered / forged JWTs | Supabase Auth signature verification on every request; Edge Functions verify JWT before any logic; no client-supplied user IDs trusted — identity always derived from the verified token. | Requests with modified payload (swapped `sub`), wrong signature, `alg=none`, and expired tokens all → 401 `AUTH_REQUIRED`/`SESSION_EXPIRED`; body-supplied `owner_id` mismatching token is ignored/rejected. |
| Service-key leakage | Service-role key exists only in Edge Function and worker env; never in repo, mobile bundle, logs, or CI output; secret-scan gate; rotation runbook. | CI secret scan on every PR; bundle string-scan in release pipeline; log-output grep in staging E2E — zero occurrences. |
| Webhook spoofing / replay | RevenueCat webhook signature verification; provider event-ID dedupe in `webhook_events` (unique constraint); idempotent, safely replayable processing. | Worker/API tests: unsigned or bad-signature POST → 401 and no state change; same event ID posted twice → single entitlement mutation, second returns success without effect. |
| Upload bombs (oversized / flooding) | Size caps enforced at upload-intent and at server validation; per-user/device/IP rate limits; orphan purge within 24 h. | 25 MB fixture rejected `IMAGE_TOO_LARGE`; rapid-fire upload-intent requests hit rate limit; orphaned upload absent from storage after purge job run. |
| Malformed images (decompression attacks, fake extensions, corrupt files) | Server-side magic-byte validation, decode in a bounded/sandboxed step, dimension checks before provider call. | Corrupted, zip-renamed-to-jpg, and pixel-flood fixtures from the evaluation set → `IMAGE_TYPE_UNSUPPORTED`/`IMAGE_DIMENSIONS_UNSUPPORTED`; worker memory stays bounded; no provider call is made. |
| Provider prompt/image abuse (prompt injection via image content, non-outfit or policy-violating images) | Versioned prompt; strict output-schema validation (§10.3); taxonomy allowlist mapping; insight length + disallowed-language filter; multi-person/non-outfit → unsupported/uncertain state; no raw model output persisted by default. | Worker tests with adversarial fixtures: schema-invalid provider output → `ANALYSIS_INVALID_OUTPUT`, never stored; injection-attempt fixture produces no out-of-taxonomy labels; insight >140 chars or containing banned terms is rejected. |
| Quota evasion (multi-device, retry abuse, dedupe bypass) | Quotas keyed server-side per user account (not device); request-hash dedupe; one active job per outfit; idempotency keys unique per `(owner_id, client_idempotency_key)`. | Same user across two simulated devices shares one quota pool; N+1th analysis → `ANALYSIS_RATE_LIMITED`; repeated identical request returns the same job ID, `analysis_jobs` row count unchanged. |
| Compromised devices (stolen token, extracted local data) | Tokens in platform secure storage (Keychain), never AsyncStorage; short-lived access tokens with refresh rotation; sign-out and account deletion revoke sessions server-side; no secrets in local DB. | Static check: no token writes to AsyncStorage; revoked/refresh-rotated token → `SESSION_EXPIRED` on next call; local SQLite dump contains no tokens or keys. |
| Cache resurrection after deletion | Deletion tombstones override stale cache (PRD §7.2); TanStack Query invalidation + SQLite tombstone rows; thumbnails purged; server returns `CONTENT_NOT_VISIBLE` for deleted IDs. | AC-P0-009: delete outfit → force-close → relaunch offline then online: trace never reappears; direct fetch of deleted ID → `CONTENT_NOT_VISIBLE`; cached thumbnail file removed. |
| Unauthorized entitlement changes | Entitlements written only by server from verified RevenueCat webhooks; client `isPremium` toggle prohibited in production; server-authorized limits on every gated call. | RLS deny: client UPDATE on `subscription_entitlements` fails; gated endpoint with free account → `ENTITLEMENT_REQUIRED` regardless of any client-side flag. |
| Moderator privilege escalation | Separate moderator/admin roles authorized server-side per endpoint; least privilege; immutable `audit_events` for every privileged action; moderators cannot self-grant roles or touch entitlements/billing. | Matrix tests: moderator can act on reported content but SELECT on unreported private outfits denied; moderator role-grant attempt → `PERMISSION_DENIED`; every moderation action produces an audit event (asserted in test). |
| Deletion-job failure | Resumable job with persisted progress; monitored exception queue; 99% complete within 24 h alerting; retries idempotent. | Chaos test: kill worker mid-deletion → job resumes and completes; metrics/alert fires when a synthetic job is aged past threshold; re-run of completed job is a no-op. |

---

## 3. RLS Test Matrix Requirement

Every owner-scoped or visibility-scoped table (P0: `profiles`, `outfits`, `analysis_jobs`, `style_analyses`, `style_dna_snapshots`, `data_requests`, `user_blocks`, `audit_events`; P1 tables on introduction) MUST ship with a policy test matrix covering **four principals × both outcomes**:

| Principal | Allow cases (must succeed) | Deny cases (must fail) |
|-----------|---------------------------|------------------------|
| **User A (owner)** | Read/update own profile; read own outfits, analyses, DNA snapshots, data requests; create own outfit draft rows where policy permits. | Write server-only tables (`style_analyses`, `style_dna_snapshots`, entitlements, `audit_events`); update immutable analysis rows; read other users' private rows. |
| **User B (authenticated non-owner)** | Read visibility-eligible public content only (P1). | Any read or mutation of A's private outfits, analyses, DNA, jobs, data requests, storage objects; any write attributing to A's `owner_id`. |
| **Anonymous** | Nothing in P0 (public read paths arrive in P1 and get their own allow rows then). | All reads and all writes on every table; all storage object access. |
| **Moderator** | Server-authorized moderation reads/actions on reported content via privileged endpoints; write `moderation_actions`; generated `audit_events`. | Direct table-level access outside moderation scope; reading unreported private content; modifying entitlements, profiles, analyses; granting roles. |

Rules:
- Deny-by-default: a table with no policy must fail the matrix (zero-policy tables are a test failure, not a pass).
- Matrix runs in CI on every PR against a freshly migrated empty database (PRD §19).
- Adding a table or policy without extending the matrix fails CI (coverage check maps `information_schema` tables → test files).
- Both database-level (direct PostgREST/SQL) and API-level (privileged endpoints) deny paths are asserted (AC-P0-008: failures at database, storage, AND API layers).

---

## 4. Data Retention (PRD §15.3)

| Data class | Retention | Enforcement |
|-----------|-----------|-------------|
| Failed / orphaned uploads | Purge within 24 hours | Scheduled purge job; monitored |
| Temporary normalized derivatives (not archive-referenced) | Purge within 24 hours | Scheduled purge job |
| Outfit originals / processed images | Retained while the user keeps the trace; subject to explicit user settings and policy | Deleted by outfit-deletion and account-deletion jobs |
| Signed URLs | TTL of minutes; never persisted anywhere (DB, logs, analytics, cache) | Redaction rules + code review; TTL asserted in tests |
| Operational logs | 30 days default, redacted per §5 | Log-sink retention config |
| Security audit events (`audit_events`) | Policy-defined period, minimally scoped metadata only | Allowlisted-field schema; no images/tokens/prompts/raw output |
| Export packages | Expire within 7 days (`data_requests.expires_at`) | Expiry job deletes package + signed access |
| Deleted account data | Complete active-system deletion within 24 hours; backup behavior and legal exceptions stated in the privacy policy | Resumable deletion job, 99%-within-24h SLO, exception queue alerting |

---

## 5. Logging Redaction Rules

Applies to all logs: mobile (Sentry breadcrumbs), Edge Functions, worker, database logs surfaced to sinks, CI output, and product analytics events.

**Never log:**
- Image bytes or any base64-encoded payloads.
- Auth tokens, refresh tokens, session cookies, API keys, webhook secrets, `Authorization` headers.
- Email addresses (log the opaque `user_id` UUID instead).
- Image URLs — signed or unsigned; never persist a signed URL anywhere. Log the bucket-relative object path only where operationally required, and never in product analytics.
- Raw prompts sent to the analysis provider and raw model outputs. Log only: schema version, model version, prompt version, validation pass/fail, error code, latency, correlation ID.
- Raw EXIF payloads and freeform sensitive fields (bio text, captions, insight text) in error/telemetry contexts.
- Exact usernames in product analytics (PRD §17.2).

**Required:** a single shared redaction helper used by every log call site, with unit tests feeding known-bad inputs (base64 blob, `Bearer` token, email, signed URL, prompt text) and asserting redacted output. Structured logging with allowlisted fields is preferred over freeform interpolation. Sentry `beforeSend` scrubs the same classes. Guardrail metric: secrets/PII detected in logs = zero accepted events.

---

## 6. Safety & Inclusion Rules for Analysis Output (PRD §15.4)

The analysis output (insight text, traits, labels) MUST NOT infer, state, or imply:
- Sensitive attributes (race, ethnicity, religion, sexuality, disability, age beyond taxonomy-neutral terms).
- Attractiveness, body quality, body shape judgments, or physical desirability.
- Socioeconomic status or wealth signals ("cheap", "expensive-looking", "low-budget").
- Gender correctness or gender conformity of clothing choices.
- Medical or psychological conditions.
- Identity certainty ("you are a…" claims); the product frames results as personal style reflection, never objective judgment.

Operational rules:
- Insight ≤140 characters, drawn from the versioned taxonomy voice; a disallowed-language checklist is enforced in worker validation — violations are rejected as `ANALYSIS_INVALID_OUTPUT`, never displayed or stored.
- Multi-person and non-outfit images return an honest unsupported/uncertain state — no fabricated analysis.
- Low confidence produces the gentle "harder to read" state with retry/feedback options, not fake certainty.
- Every model/prompt release runs the bias-language evaluation on the consented fixture set (PRD §10.6); a release that regresses required thresholds does not deploy.
- Production never silently substitutes mock analysis; demo results are visibly labeled and cannot satisfy release gates.

---

## 7. Secret Management

**Where secrets live:**

| Surface | Secrets | Rules |
|---------|---------|-------|
| Mobile app / bundle | **NONE.** | Only the Supabase URL and anon (publishable) key ship in the client. No `EXPO_PUBLIC_*` variable may ever contain a provider key, service-role key, or webhook secret — `EXPO_PUBLIC_` means bundled and public by definition. |
| Supabase Edge Functions | Service-role key, provider API key (if a function calls it), RevenueCat webhook secret. | Set via Supabase secrets manager per environment; never committed; never returned in responses or logs. |
| Analysis worker (Railway/Render/Fly) | Provider (vision/model) API key, Supabase service-role key, queue credentials, Sentry DSN. | Host env-var store per environment; separate keys for staging vs production (PRD §19); least-privilege scoping. |
| CI (GitHub Actions) | EAS token, Supabase access token, staging deploy credentials, Sentry auth token. | GitHub encrypted secrets; never echoed; no production data or production model credentials in CI test runs. |

Environment separation: local, staging, and production use **separate** Supabase projects, buckets, analytics projects, and model credentials. Production data never populates local tests.

**Secret-scan CI gate (required on every PR — PRD §19):**
- Full-tree and history-aware secret scan (e.g. gitleaks) blocking merge on any hit.
- Release-pipeline step string-scans the exported Expo/EAS bundle for key patterns (Anthropic `sk-ant-`, Supabase service-role JWT, generic high-entropy) — a hit fails the build.
- Guardrail metric: secrets detected in committed source or mobile bundles = zero.
- Any secret that ever lands in history or a distributed build is rotated (human-approved), not merely removed — removal does not un-leak it (see R-01).

---

## 8. Privileged Actions Requiring Human Approval

Per PRD §3 (final principle) and §19 (final paragraph): agents and CI may build, test, and verify — but the following external-state actions require **explicit owner (founder) approval, recorded before execution**:

1. Submitting to the App Store / TestFlight external distribution.
2. Making purchases or executing purchases outside sandbox.
3. Publishing externally (store metadata, public communications, external emails).
4. Changing billing or creating paid products (StoreKit/RevenueCat product creation, price changes).
5. Rotating production credentials (including the R-01 Anthropic key rotation — founder executes via the Anthropic console).
6. Deleting production data.
7. Sending external communications of any kind.

No agent or CI job performs any of the above automatically. Approval is recorded (who, what, when) in `audit_events` / decision records before the action, and the final release checklist requires recorded human approval before App Store submission or billing changes.

---

*End of contract. CONTRACT — FROZEN v1. Amendments require Lead approval and a version bump.*
