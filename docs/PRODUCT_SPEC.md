# OUTFT — Frozen P0 Product Specification

Document: docs/PRODUCT_SPEC.md
Source of truth: Master PRD v1.0 (2026-07-13), §2, §3, §4, §6.1, §6.4, §7, §8, §9.1–§9.10, §22
Status: FROZEN for P0 implementation. Changes require Lead approval and a new spec version.
Scope: P0 only. §9.11 (Premium/paywall) and §9.12 (Social surfaces) are P1-GATED and are noted but not specified for implementation here.
Requirement ID convention: REQ-<AREA>-<NNN>. Every normative statement carries exactly one ID. Other agents must reference these IDs in task packets, commits, and tests.

---

## 1. Product vision (PRD §2)

OUTFT turns everyday outfit photos into an evolving visual archive and personal style identity. Each captured look is a collectible trace, not a disposable social post. Traces accumulate into the user's Style DNA: patterns in aesthetics, colors, silhouettes, garments, and contexts.

- REQ-VISION-001: The experience must feel editorial, intimate, tactile, image-led, and specific — never a generic social feed, business dashboard, or trend-scoring machine.
- REQ-VISION-002: The outfit image is always the dominant object on any screen that displays it; analysis provides language and reflection, not judgment.
- REQ-VISION-003: Product promise (verbatim, usable in UI copy): "Capture what you wore. Understand the visual patterns that make it yours. Build a private archive that becomes more meaningful with every trace."

Jobs to be done (context, non-normative): quick capture with useful interpretation; cross-outfit pattern recognition without spreadsheet effort; an archive worth revisiting; and — when sharing (P1) — control and safety.

## 2. Product principles (PRD §3)

- REQ-PRIN-001: The outfit is the primary object; metadata and social context are supporting elements.
- REQ-PRIN-002: Every saved trace must feel intentional, durable, and worth revisiting (collectible, not disposable).
- REQ-PRIN-003: DNA explains before it scores: plain-language insights and visual patterns precede percentages in hierarchy.
- REQ-PRIN-004: Private by default. Outfit images, analyses, and Style DNA are private until the user explicitly publishes (publishing itself is P1).
- REQ-PRIN-005: Real state, visible state. The UI must never claim success before durable local or server state confirms it.
- REQ-PRIN-006: No fake intelligence. Production never silently substitutes mock analysis. Demo results are visibly labeled and cannot satisfy release gates.
- REQ-PRIN-007: One complete loop before breadth. Capture, analysis, persistence, isolation, deletion, and recovery outrank social breadth.
- REQ-PRIN-008: Mobile reality is the test. A feature is complete only when it works on a supported physical iPhone under realistic network and permission conditions.
- REQ-PRIN-009: Accessibility is product quality. VoiceOver, Dynamic Type, contrast, focus order, touch targets, and reduced motion are acceptance requirements, not polish.
- REQ-PRIN-010: Human approval protects external state. Agents may build and test but may not purchase, publish, change billing, rotate production credentials, delete production data, or submit to Apple without explicit owner approval.

## 3. Users and roles (PRD §4)

- REQ-USER-001: Primary persona (P0): the style-curious archivist. Supported primary actions: capture, analyze, save, review, delete. All P0 flows are designed for this persona.
- REQ-USER-002: Secondary persona (P1-gated): premium member. No premium benefit may be surfaced in P0 UI; the client must never be the authority for entitlement.
- REQ-USER-003: Future persona (P1/P2-gated): social participant. No social visibility or interaction surfaces ship in P0.
- REQ-USER-004: Internal roles (support, moderator, administrator) require separate roles, server-side authorization, immutable audit events, and least privilege. No admin capability is exposed in the P0 mobile client.

## 4. P0 scope (PRD §6.1) and explicit exclusions (PRD §6.4)

### 4.1 In scope for P0

- REQ-SCOPE-001: Email/password or email one-time-code authentication, session persistence, sign-out, and password/account recovery.
- REQ-SCOPE-002: Profile onboarding and editing with unique username.
- REQ-SCOPE-003: Camera and photo library permission handling.
- REQ-SCOPE-004: Capture or select exactly one outfit image per trace.
- REQ-SCOPE-005: Durable local capture record and resumable private upload.
- REQ-SCOPE-006: Real server-side outfit analysis using a versioned schema.
- REQ-SCOPE-007: Visible upload, queued, analyzing, success, failure, offline, and retry states.
- REQ-SCOPE-008: Result receipt with aesthetics, garments, colors, traits, confidence handling, insight; model metadata stored but hidden from normal UI.
- REQ-SCOPE-009: Save analysis to the authenticated user's private archive.
- REQ-SCOPE-010: Style DNA computed from completed analyses, including insufficient-data behavior.
- REQ-SCOPE-011: History with detail view, pagination, empty state, refresh, and deletion.
- REQ-SCOPE-012: Settings with sign-out, privacy controls, data export request, and account deletion.
- REQ-SCOPE-013: Row Level Security, private storage, rate limits, secret management, image metadata stripping, logging redaction, and security tests.
- REQ-SCOPE-014: Local/staging/production environments, GitHub Actions CI, preview EAS build, Sentry, and privacy-filtered analytics.
- REQ-SCOPE-015: Physical-iPhone verification and clean-machine setup verification as completion conditions.

### 4.2 Explicitly out of P0

- REQ-SCOPE-101: No messaging, realtime chat, typing indicators, or read receipts.
- REQ-SCOPE-102: No public posting, feed ranking, comments, likes, or social notifications.
- REQ-SCOPE-103: No store purchases and no Apple submission.
- REQ-SCOPE-104: No vector databases, custom recommendation infrastructure, Kubernetes, Kafka, GraphQL, or microservices.
- REQ-SCOPE-105: No on-device ML unless the existing proprietary algorithm is proven compatible and superior for latency, privacy, and quality.
- REQ-SCOPE-106: No automatic weather/location enrichment.

## 5. Canonical product state model (PRD §7)

### 5.1 Outfit lifecycle state machine (PRD §7.1)

```
                        ┌────────────────────────────────────────────────┐
                        │              OUTFIT LIFECYCLE                  │
                        └────────────────────────────────────────────────┘

  local_draft ──(no network)──> queued_offline ──(reconnect)──┐
      │                                                       │
      └──────────────(network available)──────────────────────┤
                                                              v
                                                          uploading
                                                              │
                                        ┌── failure ──> upload_failed ──(retry, same
                                        │                     idempotency key)──> uploading
                                                              │ success
                                                              v
                                                          uploaded
                                                              │
                                                              v
                                                       analysis_queued
                                                              │
                                                              v
                                                          analyzing
                                          ┌───────────────────┼───────────────────┐
                                          │ transient failure │ success           │ permanent failure
                                          v                   v                   v
                          analysis_failed_retryable         ready       analysis_failed_terminal
                                          │ (retry ≤3, backoff+jitter,             │
                                          │  or manual retry)                      │ (user must choose
                                          └────────> analysis_queued               │  another image)
                                                                                   x

  Deletion (from any user-visible state): <state> ──> deleting ──> deleted
```

- REQ-STATE-001: The canonical happy path is exactly: local_draft → queued_offline (when offline) → uploading → uploaded → analysis_queued → analyzing → ready. When online, local_draft may proceed directly to uploading.
- REQ-STATE-002: The only failure states are upload_failed, analysis_failed_retryable, and analysis_failed_terminal.
- REQ-STATE-003: Deletion passes through deleting to deleted; deleted is terminal.
- REQ-STATE-004: Every retry (upload or analysis) must be idempotent and must not create duplicate outfit or analysis records.

### 5.2 Source-of-truth rules (PRD §7.2)

- REQ-STATE-010: The device is authoritative for an unuploaded local draft and the pending mutation queue.
- REQ-STATE-011: The server is authoritative for authentication, ownership, analysis, Style DNA snapshots, entitlements, moderation, counts, and deletion completion.
- REQ-STATE-012: Optimistic display of reversible social mutations is P1-only, and failures must reconcile visibly.
- REQ-STATE-013: A locally saved record and a cloud-synced record are distinct, distinguishable states in the UI.
- REQ-STATE-014: Deletion tombstones override stale cache content everywhere (lists, detail, thumbnails, DNA inputs).

### 5.3 Error taxonomy (PRD §7.3)

- REQ-ERR-001: Every API error returns a stable machine code, a safe user message, a correlation ID, and a retry classification.
- REQ-ERR-002: The required error code set is:

| Code | Retry class (working default) |
|---|---|
| AUTH_REQUIRED | Re-authenticate |
| SESSION_EXPIRED | Re-authenticate |
| USERNAME_TAKEN | User must change input |
| IMAGE_TYPE_UNSUPPORTED | Terminal — choose another image |
| IMAGE_TOO_LARGE | Terminal — choose another image |
| IMAGE_DIMENSIONS_UNSUPPORTED | Terminal — choose another image |
| UPLOAD_INCOMPLETE | Retryable (resume) |
| OFFLINE | Retryable (on reconnect) |
| ANALYSIS_RATE_LIMITED | Retryable (after backoff) |
| ANALYSIS_TEMPORARILY_UNAVAILABLE | Retryable |
| ANALYSIS_INVALID_OUTPUT | Retryable (server-side) |
| CONTENT_NOT_VISIBLE | Terminal |
| PERMISSION_DENIED | Terminal |
| ENTITLEMENT_REQUIRED | Terminal (P1 surfaces) |
| ACCOUNT_DELETION_PENDING | Terminal |

- REQ-ERR-003: UI copy for errors is non-blaming, plain-language, and never exposes provider names, stack traces, or raw model output.

## 6. Canonical user journeys (PRD §8)

### 6.1 First-time happy path (PRD §8.1)

- REQ-JRNY-001: Welcome shows the product promise and sign-in options; user creates and verifies an account; user sets a unique username and display name, accepts required policies, and retains private defaults.
- REQ-JRNY-002: Home shows a first-trace empty state with a single primary capture action.
- REQ-JRNY-003: On capture/selection, the app validates, orients, resizes, compresses, strips EXIF/GPS metadata, and durably stores the local file reference before any success indication.
- REQ-JRNY-004: The app uploads directly to private storage, creates one analysis job, and shows truthful progress; the worker stores an immutable result and updates the outfit.
- REQ-JRNY-005: The result screen displays the outfit as the dominant object plus insight, aesthetics, colors, garments, and traits; on confirm, the archive and current Style DNA update.
- REQ-JRNY-006: After force-close and reopen, the authenticated session and the saved trace remain available.

### 6.2 Offline capture (PRD §8.2)

- REQ-JRNY-010: Offline capture saves a durable local record and image reference before showing any success state.
- REQ-JRNY-011: The offline trace is labeled "Waiting for connection" and never claims analysis is complete.
- REQ-JRNY-012: On reconnection, the mutation queue resumes upload exactly once, using the same idempotency key.
- REQ-JRNY-013: The user may cancel and delete a local draft before upload.

### 6.3 Analysis failure and retry (PRD §8.3)

- REQ-JRNY-020: A transient provider failure moves the job to analysis_failed_retryable; the server retries at most three times with capped exponential backoff and jitter.
- REQ-JRNY-021: The UI shows a clear, non-blaming message and the current true state during failure.
- REQ-JRNY-022: Manual retry reuses the same outfit and request contract; it creates no duplicates.
- REQ-JRNY-023: Unsupported media, policy failure, or invalid input is terminal (analysis_failed_terminal) and prompts the user to choose another image.
- REQ-JRNY-024: Production never returns a plausible mock result under any failure condition.

### 6.4 Outfit deletion (PRD §8.4)

- REQ-JRNY-030: Before deletion, the app explains that the image and analysis will be removed and that Style DNA may change.
- REQ-JRNY-031: After confirmation, the server verifies ownership, creates a resumable deletion operation, and the trace is hidden immediately.
- REQ-JRNY-032: Storage objects, analysis jobs, analyses, publication references, and dependent derived state are deleted or anonymized per policy; Style DNA is recomputed without the deleted outfit.
- REQ-JRNY-033: Stale local copies and cached thumbnails are removed; the trace does not reappear after restart.

### 6.5 Account deletion (PRD §8.5)

- REQ-JRNY-040: The account-deletion flow (Settings → Account → Delete account) explains consequences, active subscription handling, the export option, and irreversibility.
- REQ-JRNY-041: The user reauthenticates when required and confirms; sessions are revoked and the account becomes inaccessible immediately.
- REQ-JRNY-042: A resumable server job removes storage objects and user-owned data, anonymizes only where legally/operationally necessary, and records completion without retaining sensitive content.
- REQ-JRNY-043: The app clears secure session state, local database, caches, and image files, then returns to Welcome.

## 7. Screen-by-screen specification — P0 screens (PRD §9.1–§9.10)

Global state requirement applying to every screen below:

- REQ-UI-001: Every screen implements an explicit state for each of: default, loading, empty (where a collection can be empty), error (actionable, with retry classification), offline (cached-content label where applicable), and permission-related states where the screen depends on a permission. No screen may render a blank or misleading intermediate.

### 7.1 Welcome and authentication (PRD §9.1)

Purpose: establish trust, explain value, and create or resume a secure account.

Required controls:
- REQ-AUTH-001: Create account, Sign in, Continue with Apple (only if configured), Terms link, Privacy Policy link, recovery path, and accessible close/back behavior.

States (complete list):
- REQ-AUTH-002: Default, submitting (loading), validation error, incorrect credentials, verification pending, expired link/code, network error/offline, rate-limited, account disabled, and existing-authenticated-session (skip to app).

Rules:
- REQ-AUTH-003: Guest mode is allowed only in an explicitly labeled demo build and cannot upload real user images.
- REQ-AUTH-004: Auth tokens use platform secure storage, never plain AsyncStorage.
- REQ-AUTH-005: Apple Sign In tokens are exchanged and verified server-side.
- REQ-AUTH-006: Terms and privacy text link to real, published documents.
- REQ-AUTH-007: Sessions persist across app restart; sign-out and password/account recovery are available.

### 7.2 Profile onboarding (PRD §9.2)

Purpose: create the minimal profile required to use the app, with private defaults.

Required controls/fields:
- REQ-PROF-001: Username, display name, optional avatar, optional short bio, required age/eligibility confirmation (once policy is decided — see §9 defaults), policy acceptance (versioned), and profile visibility defaulting to private.

Username rules:
- REQ-PROF-002: 3–24 characters; lowercase letters, numbers, periods, underscores; case-insensitive uniqueness; reserved-name list enforced; clear inline availability status; the server is authoritative for availability.
- REQ-PROF-003: A duplicate username returns USERNAME_TAKEN without losing entered form data.

States:
- REQ-PROF-004: Default, checking-availability (loading), validation error, username taken, submitting, network error/offline (submission blocked with truthful message), success.

Completion:
- REQ-PROF-005: Onboarding is complete only when a profile row exists, required consent versions are recorded, and the server confirms completion.

### 7.3 Home (PRD §9.3)

Purpose: entry point to capture and to the archive; truthful status of pending work.

Required controls (P0):
- REQ-HOME-001: New user: first-trace empty state with concise explanation and a single primary capture CTA; permissions education appears only when relevant.
- REQ-HOME-002: Returning user: latest trace, current DNA summary, archive shortcut, pending upload/analysis states, and capture CTA.
- REQ-HOME-003: Pull-to-refresh, skeleton/loading state, offline cached-content label, actionable error state, and pagination where needed.

States:
- REQ-HOME-004: Default (returning), empty (new user), loading/skeleton, error, offline (cached with label), pending-work (visible upload/analysis progress surfaced from the lifecycle model).

Rules:
- REQ-HOME-005: No hard-coded date, count, streak, weather, or insight anywhere on Home.
- REQ-HOME-006: No navigation from a live capture into any mock post or demo content.
- REQ-HOME-007: P1 modules (feed, friend traces, social activity, premium prompts) are excluded from P0 and, when added, must be server-driven with visibility filters.

### 7.4 Capture (PRD §9.4)

Purpose: capture or select one outfit image safely and privately.

Required controls:
- REQ-CAPT-001: Two modes: camera and photo library. The initial implementation may use the system camera.
- REQ-CAPT-002: No decorative fake viewfinder implying an embedded camera; a flip-camera control appears only if it actually changes the lens.
- REQ-CAPT-003: Optional category selector — Daily, Night out, Work, Gym, Travel, Event — editable before save.

Validation:
- REQ-CAPT-004: Accepted formats: JPEG, PNG, HEIC/HEIF (after normalization), WebP where supported. GIF is excluded from P0.
- REQ-CAPT-005: Maximum original size 20 MB; normalized upload at most 6 MB and at most 3072 px on the longest edge; minimum useful dimension 512 px.
- REQ-CAPT-006: Actual magic bytes and decoded dimensions are validated server-side (client validation is advisory only).

Privacy:
- REQ-CAPT-007: GPS and nonessential EXIF are stripped before upload.
- REQ-CAPT-008: Photo use is explained before the first upload; private storage is the default.
- REQ-CAPT-009: Image bytes, persistent signed URLs, and raw EXIF are never logged.

States:
- REQ-CAPT-010: Default (mode choice), permission-not-determined (education), permission-denied (settings deep link and library alternative), capturing/selecting, validating/normalizing (loading), validation error (typed: IMAGE_TYPE_UNSUPPORTED / IMAGE_TOO_LARGE / IMAGE_DIMENSIONS_UNSUPPORTED), offline (durable local draft per REQ-JRNY-010), success (durable local record exists before navigation).

### 7.5 Upload and analysis progress (PRD §9.5)

Purpose: truthful, persistent progress from capture to result.

Required controls and visible stages:
- REQ-UPLD-001: Visible stages: Preparing, Waiting for connection, Uploading, In queue, Analyzing, Finalizing, Ready, Retry required. These map 1:1 onto the lifecycle states in §5.1.
- REQ-UPLD-002: A manual retry control appears in Retry required (upload_failed / analysis_failed_retryable) and honors idempotency (REQ-STATE-004).

Behavior:
- REQ-UPLD-003: The user may leave the screen; progress persists and reappears on Home and History.
- REQ-UPLD-004: Background execution uses supported platform capabilities and never promises indefinite background processing.
- REQ-UPLD-005: Completion is observed via polling with exponential backoff; Realtime may accelerate updates but is never the only completion mechanism.

States:
- REQ-UPLD-006: One state per visible stage in REQ-UPLD-001, plus error (typed per §5.3), offline (Waiting for connection), and terminal failure (choose another image per REQ-JRNY-023). There is no separate empty state; the screen only exists for an in-flight trace.

### 7.6 Analysis result receipt (PRD §9.6)

Purpose: present the analysis as a collectible receipt with the outfit dominant.

Hierarchy and required content:
- REQ-RSLT-001: In order: outfit image (dominant), one-sentence insight, four aesthetic scores, signature colors, detected garments, concise style traits, category/date, and phase-appropriate save/share actions.
- REQ-RSLT-002: Aesthetic scores are normalized to 100.
- REQ-RSLT-003: Confidence is stored but shown only if research confirms it helps users (default: not shown).
- REQ-RSLT-004: Model metadata (model/prompt/schema versions) is stored but hidden from normal UI.

Required controls:
- REQ-RSLT-005: Save/confirm, retake, delete draft, edit category/caption. Publish/share is P1; a native-share affordance must not be represented by a button that only navigates Home.

States:
- REQ-RSLT-006: Loading (awaiting result), default (ready), low-confidence ("This look was harder to read" gentle state with retry or feedback option), error (retryable vs terminal per §5.3), offline (cached result viewable; mutations queued or blocked truthfully). No empty state; the screen requires a result or an explicit failure state.

Rules:
- REQ-RSLT-007: Language must avoid attractiveness, body value, wealth, gender correctness, and identity certainty.

### 7.7 Style DNA (PRD §9.7)

Purpose: show the versioned aggregate identity derived from ready, nondeleted analyses.

Definition and rules:
- REQ-DNA-001: Style DNA is a versioned aggregate over the user's ready, nondeleted outfit analyses. A single result is an outfit analysis, never presented as the full identity.
- REQ-DNA-002: Evidence thresholds: 1 trace = Early DNA, explicitly labeled as based on one outfit; 5 traces unlock a stable summary; trends require at least 5 traces across 2 distinct weeks.
- REQ-DNA-003: P0 aggregation: normalize each eligible analysis's aesthetic scores to 100; weight each trace equally; arithmetic mean by taxonomy label; retain top four; renormalize to 100.
- REQ-DNA-004: Signature colors use clustered normalized color values with frequency and recency only after the simple baseline is validated.
- REQ-DNA-005: Traits require occurrence in at least 2 traces or 25% of the evidence window.
- REQ-DNA-006: Each snapshot stores outfit count, window dates, algorithm version, and generated time.
- REQ-DNA-007: A new model or aggregation behavior creates a new snapshot version; historical analyses remain immutable and are never silently rewritten.
- REQ-DNA-008: Deletion of an outfit recomputes current DNA.

States (complete list):
- REQ-DNA-009: No traces (empty), Early DNA, Stable DNA, stale/recomputing (loading variant), insufficient data for trend, calculation failure (error), offline (last cached snapshot with label).

### 7.8 History and trace detail (PRD §9.8)

Purpose: the private archive — browse, revisit, manage, and delete traces.

History list — required behavior and controls:
- REQ-HIST-001: Reverse chronological, cursor-paginated, grouped by month.
- REQ-HIST-002: Each item shows thumbnail, category, date, dominant aesthetic, and pending/failure status where applicable.
- REQ-HIST-003: Refresh (pull-to-refresh) is supported.

History states:
- REQ-HIST-004: Default, loading (initial + pagination), empty, error, offline-cache (labeled), and per-item pending/failed badges.

Trace detail — required content and controls:
- REQ-HIST-005: Original/processed image, full analysis, model-independent explanation, category/caption edit, delete, and retry if failed. Publication controls are P1.
- REQ-HIST-006: Re-analysis after a model update creates a new analysis version and requires explicit user action or policy approval; it never overwrites the immutable prior analysis.

Trace detail states:
- REQ-HIST-007: Default, loading, error, offline (cached, with mutations queued or truthfully blocked), pending/failed (mirrors lifecycle state with retry per REQ-UPLD-002), deleting, and not-found/tombstoned (deleted content never resurrects per REQ-STATE-014).

### 7.9 Profile (PRD §9.9)

Purpose: the user's own identity surface and navigation hub (private in P0).

Required content and controls (P0):
- REQ-PRFL-001: Avatar, display name, username, optional bio, private archive statistics derived from real data, Edit profile, Style DNA shortcut, History shortcut, Settings entry, and Sign out.

Rules:
- REQ-PRFL-002: Seed/demo counts are never combined with real counts.
- REQ-PRFL-003: An unknown profile route returns a not-found state rather than crashing.
- REQ-PRFL-004: P1 elements (public/private toggle surfaces, followers/following, published traces, collections, badges, block/report on other profiles) are excluded from P0.

States:
- REQ-PRFL-005: Default, loading, error, offline (cached with label), not-found (REQ-PRFL-003). Empty state applies to statistics (zero traces shows truthful zeros/first-trace prompt, never placeholder numbers).

### 7.10 Settings and privacy (PRD §9.10)

Purpose: account control, privacy, data rights, and legal transparency.

Required sections:
- REQ-SET-001: Account, Privacy, Data and photos, Notifications, Subscription (P0: informational/inactive only), Accessibility, Support, Legal, and About.

Required actions (P0):
- REQ-SET-002: Edit profile, change credentials, sign out, request data export, delete outfit data, delete account, open privacy policy/terms/support, manage analytics consent where required, and view app/build version. (Manage blocked users and restore purchases are P1.)
- REQ-SET-003: Account deletion follows the journey in §6.5 (REQ-JRNY-040…043), including reauthentication when required.
- REQ-SET-004: Export requests create a tracked server-side request; the UI reflects requested/processing/ready/failed truthfully.

States:
- REQ-SET-005: Default, loading (for server-backed rows such as export status), error, offline (settings render from cache; server-dependent actions are disabled with a truthful offline message), destructive-confirmation (sign-out, delete outfit data, delete account), and deletion-pending (ACCOUNT_DELETION_PENDING blocks further mutation).

### 7.11 P1-gated screens (noted, not specified for P0)

- REQ-GATE-001: §9.11 Premium and paywall is P1-GATED. Nothing from it ships in P0; the local isPremium toggle is prohibited in production; prices, entitlements, and paywall states are specified at P1 kickoff from PRD §9.11.
- REQ-GATE-002: §9.12 Social surfaces are P1-GATED. No publishing, feed, likes, comments, saves, twins, or notifications ship in P0; visibility/safety rules are specified at P1 kickoff from PRD §9.12.

## 8. Cross-cutting P0 requirements referenced by screens

- REQ-XCUT-001: Every mutation from the client carries an idempotency key generated before the first network operation.
- REQ-XCUT-002: Every screen honors accessibility acceptance criteria (WCAG 2.1 AA contrast, 44×44 pt targets, VoiceOver semantics, Dynamic Type without clipping, Reduced Motion, color never the sole indicator) per PRD §16.
- REQ-XCUT-003: All P0 product events in PRD §17.2 fire from the corresponding screens (signup_started … account_deleted) with no image content, analysis free text, email, exact username, auth token, or signed URL in analytics.
- REQ-XCUT-004: No screen displays demo/mock data in production builds; demo builds are visibly labeled (per REQ-PRIN-006, REQ-AUTH-003).

## 9. Working-default founder decisions (PRD §22)

Each item below is a DEFAULT — awaiting founder confirmation. Implementation proceeds on the default; a founder decision may change it before its dependent workstream ships.

- REQ-DEC-001: Platform scope — iOS-first; Android excluded from first store release. DEFAULT — awaiting founder confirmation.
- REQ-DEC-002: Privacy posture — private profiles and private outfits by default. DEFAULT — awaiting founder confirmation.
- REQ-DEC-003: Authentication method — email-based auth (password or one-time code); Apple Sign In optional for first beta. DEFAULT — awaiting founder confirmation.
- REQ-DEC-004: DNA aggregation — equal-weight aggregation per REQ-DNA-003. DEFAULT — awaiting founder confirmation.
- REQ-DEC-005: Photo retention — saved normalized images retained until user deletion. DEFAULT — awaiting founder confirmation.
- REQ-DEC-006: Sequencing — social and payments ship only after P0 gates pass. DEFAULT — awaiting founder confirmation.
- REQ-DEC-007: Analysis runtime — hosted server-side analysis via provider adapter (proprietary algorithm decision pending). DEFAULT — awaiting founder confirmation.
- REQ-DEC-008: Mock policy — no production mock analysis under any circumstance. DEFAULT — awaiting founder confirmation (note: also a hard principle, REQ-PRIN-006).

Open founder decisions with no working default (block only their dependent workstream, not Wave 0): target customer/positioning, age policy (REQ-PROF-001's eligibility field is spec'd but policy values are pending), style taxonomy and insight tone, premium matrix, social model, and legal/release identity (entity, Apple team, bundle ID, support URL, policies).

---

End of frozen P0 specification. Requirement IDs REQ-VISION-001 … REQ-DEC-008 are stable; do not renumber.
