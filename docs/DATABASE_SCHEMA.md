# OUTFT — Database Schema

> **CONTRACT — FROZEN v1, changes require lead approval.**
>
> Source: Master PRD v1.0 (2026-07-13), §12 (data model), §12.4 (indexes/constraints), §15 (storage & security).
> Conventions: all primary IDs are `uuid`; all timestamps are `timestamptz` in UTC; every owner-scoped table has an explicit owner/author FK and tested RLS; deny-by-default RLS on every table. Soft deletion only where recovery, moderation, or legal requirements justify it. **No SQL migrations in this document — migrations are Wave 2, authored solely by the Backend agent in one sequential queue.**

---

## 1. Core P0 tables (§12.1)

### 1.1 `profiles`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | PK; FK → `auth.users(id)` |
| `username` | `citext` (case-insensitive) | UNIQUE (case-insensitive); 3–24 chars; `[a-z0-9._]`; reserved-name list enforced server-side |
| `display_name` | `text` | required |
| `bio` | `text` | nullable, short |
| `avatar_path` | `text` | nullable; storage object path in private `avatars` bucket |
| `profile_visibility` | `text` | CHECK in (`private`,`public`); default `private` |
| `onboarding_completed_at` | `timestamptz` | nullable until onboarding done |
| `terms_version` | `text` | accepted policy version |
| `privacy_version` | `text` | accepted policy version |
| `created_at` | `timestamptz` | default now(), UTC |
| `updated_at` | `timestamptz` | default now(), UTC |

### 1.2 `outfits`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `owner_id` | `uuid` | FK → `profiles(user_id)`; NOT NULL |
| `client_idempotency_key` | `uuid` | NOT NULL; device-generated before first network op |
| `category` | `text` | nullable; CHECK in (`daily`,`night_out`,`work`,`gym`,`travel`,`event`) |
| `caption` | `text` | nullable; editable (LWW acceptable) |
| `captured_at` | `timestamptz` | NOT NULL |
| `status` | `text` | CHECK in (`local_draft`,`queued_offline`,`uploading`,`uploaded`,`analysis_queued`,`analyzing`,`ready`,`upload_failed`,`analysis_failed_retryable`,`analysis_failed_terminal`,`deleting`,`deleted`) |
| `visibility` | `text` | CHECK in (`private`,`published`); default `private`; publish is P1 |
| `original_object_path` | `text` | nullable; private `outfits` bucket path |
| `processed_object_path` | `text` | nullable; private `outfits` bucket path |
| `latest_analysis_id` | `uuid` | nullable; FK → `style_analyses(id)` |
| `deleted_at` | `timestamptz` | nullable; tombstone marker |
| `created_at` | `timestamptz` | default now() |
| `updated_at` | `timestamptz` | default now(); sync watermark |

UNIQUE `(owner_id, client_idempotency_key)`.

### 1.3 `analysis_jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `outfit_id` | `uuid` | FK → `outfits(id)`; NOT NULL |
| `owner_id` | `uuid` | FK → `profiles(user_id)`; NOT NULL |
| `status` | `text` | CHECK in (`queued`,`leased`,`running`,`succeeded`,`failed_retryable`,`failed_terminal`,`canceled`) |
| `attempt_count` | `integer` | default 0; max 3 attempts (capped exponential backoff + jitter) |
| `next_attempt_at` | `timestamptz` | nullable; retry scheduling |
| `provider` | `text` | provider adapter identifier |
| `model_version` | `text` | recorded per attempt/result |
| `prompt_version` | `text` | e.g. `outft-analysis-v1` |
| `request_hash` | `text` | for request-hash deduplication |
| `error_code` | `text` | nullable; stable machine code (§7.3 taxonomy) |
| `error_safe_message` | `text` | nullable; user-safe message only |
| `queued_at` | `timestamptz` | NOT NULL |
| `started_at` | `timestamptz` | nullable |
| `completed_at` | `timestamptz` | nullable |

Constraint: at most one active job per outfit (partial unique index, §3 below).

### 1.4 `style_analyses` — immutable after insert

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `outfit_id` | `uuid` | FK → `outfits(id)`; NOT NULL |
| `job_id` | `uuid` | FK → `analysis_jobs(id)`; NOT NULL |
| `schema_version` | `text` | required (e.g. `1.0`) |
| `model_version` | `text` | required |
| `prompt_version` | `text` | required |
| `garments` | `jsonb` | versioned schema; bounded list; `{category,label,confidence}` |
| `colors` | `jsonb` | bounded list; `{hex,label,weight}` |
| `traits` | `jsonb` | bounded list; `{label,confidence}` |
| `scores` | `jsonb` | style scores 0–100, sum to 100 (±0.5 pre-normalization) |
| `confidence` | `numeric` | CHECK `confidence >= 0 AND confidence <= 1` |
| `insight` | `text` | ≤ 140 chars; safe language only |
| `created_at` | `timestamptz` | default now() |

No UPDATE or client INSERT ever; server (worker via service role) writes once. Raw model output is not stored here.

### 1.5 `style_dna_snapshots`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles(user_id)`; NOT NULL |
| `algorithm_version` | `text` | NOT NULL; new algorithm ⇒ new snapshot, history immutable |
| `window_start` | `timestamptz` | evidence window |
| `window_end` | `timestamptz` | evidence window |
| `outfit_count` | `integer` | evidence count (1 = Early DNA, ≥5 = Stable) |
| `scores` | `jsonb` | top-4 aesthetics normalized to 100 |
| `colors` | `jsonb` | signature colors |
| `traits` | `jsonb` | traits meeting the ≥2-traces / 25% rule |
| `generated_at` | `timestamptz` | default now() |

### 1.6 `data_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `profiles(user_id)`; NOT NULL |
| `type` | `text` | CHECK in (`export`,`deletion`) |
| `status` | `text` | CHECK in (`requested`,`in_progress`,`completed`,`failed`) |
| `requested_at` | `timestamptz` | NOT NULL |
| `completed_at` | `timestamptz` | nullable; deletion SLA 24h, monitored exception queue |
| `error_code` | `text` | nullable |
| `expires_at` | `timestamptz` | nullable; export packages expire ≤ 7 days |

### 1.7 `user_blocks`

| Column | Type | Notes |
|---|---|---|
| `blocker_id` | `uuid` | FK → `profiles(user_id)`; NOT NULL |
| `blocked_id` | `uuid` | FK → `profiles(user_id)`; NOT NULL |
| `created_at` | `timestamptz` | default now() |

PK/UNIQUE `(blocker_id, blocked_id)`; CHECK `blocker_id <> blocked_id`. Block overrides all social visibility and interaction.

### 1.8 `audit_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `actor_id` | `uuid` | nullable (system events); FK → `auth.users(id)` |
| `event_type` | `text` | privileged security, account-lifecycle, payment-webhook, moderation |
| `subject_type` | `text` | entity type acted upon |
| `subject_id` | `uuid` | nullable |
| `metadata` | `jsonb` | **allowlisted keys only** — never images, auth tokens, raw prompts, raw model output, emails, or signed URLs |
| `correlation_id` | `uuid` | links mobile op → API → job → worker → provider call |
| `created_at` | `timestamptz` | default now(); append-only, immutable |

## 2. P1 / P2 tables (named stubs — schemas frozen in a later contract revision)

**P1 (§12.2):** `follows`, `posts`, `likes`, `comments`, `collections`, `collection_items`, `notifications`, `device_push_tokens`, `reports`, `moderation_actions`, `subscription_entitlements`, `webhook_events`.

**P2 (§12.3):** `conversations`, `conversation_members`, `messages`, `message_receipts`, `circles`, `circle_members`, `polls`, `votes`.

## 3. Indexes and constraints (§12.4)

Indexes:

- `outfits (owner_id, captured_at DESC)` — **partial**, `WHERE deleted_at IS NULL` (excludes deleted rows).
- `analysis_jobs (status, next_attempt_at)` — worker lease/retry scan.
- `style_analyses (outfit_id, created_at DESC)`.
- `style_dna_snapshots (user_id, generated_at DESC)`.
- P1: `posts (author_id, published_at DESC)` plus a visibility-eligible feed access-pattern index.
- P1: `notifications (user_id, read_at, created_at DESC)`.
- P1: `comments (post_id, created_at)`.

Unique constraints:

- `outfits (owner_id, client_idempotency_key)` — client idempotency.
- One active `analysis_jobs` row per outfit (partial unique on `outfit_id` where status in active set).
- P1: `follows (follower_id, followee_id)`, `likes (user_id, post_id)`, `collection_items (collection_id, post_id)`, `webhook_events (provider_event_id)`; P2: `votes (poll_id, voter_id)`.

Checks:

- No self-follow (P1) and no self-block (`blocker_id <> blocked_id`).
- `confidence` in [0, 1].
- Allowed `status` values on `outfits`, `analysis_jobs`, `data_requests`.
- Required visibility/state combinations (e.g., an outfit cannot be `published` while `deleted_at` is set or status ≠ `ready`).

## 4. RLS policy matrix

Roles: **Owner** = authenticated user matching the row's owner/user FK. **Other** = a different authenticated user. **Anon** = anonymous client. **Moderator** = internal operator role (separate role, server-side authorization, all actions audit-logged). The **service role** (worker/Edge Functions) bypasses RLS by design and is the *only* writer of analyses, DNA snapshots, entitlements, moderation state, and notifications (§15.1). Every allow AND deny cell below must have a policy test (user A, user B, moderator, anonymous — §15.1, AC-P0-008).

Legend: ✅ allow · ❌ deny · 🔒 server-only (deny for all client roles; performed via privileged endpoint/service role).

| Table | Op | Owner | Other | Anon | Moderator |
|---|---|---|---|---|---|
| `profiles` | SELECT | ✅ | ❌ (P0; P1: public profiles only) | ❌ | ✅ (support scope) |
| | INSERT | ✅ (own row, once) | ❌ | ❌ | ❌ |
| | UPDATE | ✅ (own, non-privileged fields) | ❌ | ❌ | 🔒 (moderation fields via privileged endpoint) |
| | DELETE | 🔒 (account-deletion job only) | ❌ | ❌ | ❌ |
| `outfits` | SELECT | ✅ (excl. tombstoned) | ❌ (P0; P1: `published` + visibility-eligible + not blocked) | ❌ | ✅ (report investigation) |
| | INSERT | ✅ (own_id = auth.uid()) | ❌ | ❌ | ❌ |
| | UPDATE | ✅ (category/caption/status-safe fields only) | ❌ | ❌ | 🔒 (moderation state) |
| | DELETE | 🔒 (via `DELETE /v1/outfits/{id}` deletion job; owner-verified) | ❌ | ❌ | 🔒 |
| `analysis_jobs` | SELECT | ✅ (own jobs, status only) | ❌ | ❌ | ✅ (support) |
| | INSERT | 🔒 (privileged endpoint after JWT/ownership/quota checks) | ❌ | ❌ | ❌ |
| | UPDATE | 🔒 (worker only) | ❌ | ❌ | ❌ |
| | DELETE | ❌ | ❌ | ❌ | ❌ |
| `style_analyses` | SELECT | ✅ (own, via outfit ownership) | ❌ (P0) | ❌ | ✅ (report investigation) |
| | INSERT | 🔒 (worker only, immutable) | ❌ | ❌ | ❌ |
| | UPDATE | ❌ (immutable — nobody) | ❌ | ❌ | ❌ |
| | DELETE | 🔒 (deletion job only) | ❌ | ❌ | ❌ |
| `style_dna_snapshots` | SELECT | ✅ (own) | ❌ | ❌ | ❌ |
| | INSERT | 🔒 (server recompute only) | ❌ | ❌ | ❌ |
| | UPDATE | ❌ | ❌ | ❌ | ❌ |
| | DELETE | 🔒 (deletion job only) | ❌ | ❌ | ❌ |
| `data_requests` | SELECT | ✅ (own) | ❌ | ❌ | ✅ (failure handling) |
| | INSERT | 🔒 (via `POST /v1/account/export` / `/delete`) | ❌ | ❌ | ❌ |
| | UPDATE | 🔒 (job runner only) | ❌ | ❌ | 🔒 (retry failed jobs) |
| | DELETE | ❌ | ❌ | ❌ | ❌ |
| `user_blocks` | SELECT | ✅ (rows where blocker_id = self) | ❌ | ❌ | ✅ (report context) |
| | INSERT | ✅ (blocker_id = self) | ❌ | ❌ | ❌ |
| | UPDATE | ❌ (set/delete semantics only) | ❌ | ❌ | ❌ |
| | DELETE | ✅ (own block rows — unblock) | ❌ | ❌ | ❌ |
| `audit_events` | SELECT | ❌ | ❌ | ❌ | ✅ (least-privilege, scoped) |
| | INSERT | 🔒 (server only, append-only) | ❌ | ❌ | 🔒 |
| | UPDATE | ❌ | ❌ | ❌ | ❌ |
| | DELETE | ❌ | ❌ | ❌ | ❌ |

Default posture: RLS **enabled with deny-by-default on every table**; each ✅ is an explicit policy. Cross-user private data access failures: zero accepted events (§5.4 guardrail).

## 5. Storage bucket layout (§15)

Two **private** buckets — no public buckets, ever:

| Bucket | Contents | Path convention |
|---|---|---|
| `outfits` | Original and processed outfit images | `{owner_id}/{outfit_id}.jpg` (processed derivative variants suffix the same stem, e.g. `{owner_id}/{outfit_id}_processed.jpg`) |
| `avatars` | Profile avatars | `{owner_id}/{avatar_object}.jpg` |

Access rules:

- **Signed-URL-only access.** Upload via short-lived signed upload intents; download via short-lived signed URLs (lifetime measured in minutes; never persisted, never logged).
- Storage policies mirror table RLS: only the owner (or service role) may create/read objects under their `{owner_id}/` prefix; object-path guessing must fail (threat model §15.2).
- Server validates magic bytes, decoded dimensions, and size; GPS/EXIF stripped before upload; max original 20 MB, normalized upload ≤ 6 MB and ≤ 3072 px longest edge, min useful dimension 512 px.
- Retention: failed/orphaned uploads and unused temporary derivatives purged within 24 h; originals/processed retained while the user keeps the trace; outfit deletion and account deletion remove storage objects via resumable monitored jobs.
