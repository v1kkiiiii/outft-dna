# OUTFT — Backend Architecture

> **CONTRACT — FROZEN v1, changes require lead approval.**
>
> Source: Master PRD v1.0 (2026-07-13), §7.2, §11, §14, §19. Requirement IDs reference PRD sections.

---

## 1. System topology (PRD §11.1)

OUTFT v1 is a **managed modular monolith** built on Supabase, with a single analysis worker. Component diagram (text form):

```
Expo mobile client (iOS-first, React Native, TypeScript)
  │
  ├──> Supabase Auth
  │       (email auth, session tokens; Apple Sign In token exchange verified server-side)
  │
  ├──> Supabase PostgreSQL
  │       (direct client reads/writes ONLY through tested Row Level Security)
  │
  ├──> Private Supabase Storage
  │       (signed upload/download operations only; no public buckets)
  │
  ├──> Privileged Edge Functions / API
  │       ├── analysis job creation
  │       ├── account export / deletion
  │       ├── RevenueCat webhook (P1)
  │       ├── moderation / admin actions
  │       └── notification fan-out
  │
  └──> Analysis worker (leases jobs from DB queue)
          ├── private image access (short-lived signed object URL)
          ├── vision/model provider (server-side only — no provider key on mobile)
          └── validated immutable analysis written back in one transaction
```

Data-flow summary for the core loop: mobile normalizes the image → requests an upload intent → server creates the outfit row with owner + client idempotency key → mobile uploads directly to a short-lived signed private destination → mobile requests an analysis job → server verifies JWT, ownership, object existence, quota, type, size, and active-job uniqueness → a transaction creates the job and an outbox/queue record → the worker leases the job, calls the provider, validates the result → one transaction inserts the immutable analysis, marks the outfit ready, and schedules DNA recomputation → mobile observes completion via polling with optional Realtime acceleration (PRD §10.4).

## 2. Technology decisions (PRD §11.2)

| Technology | Rationale (one line) |
|---|---|
| Expo + React Native + TypeScript + Expo Router | iOS-first mobile platform with managed build tooling and typed shared contracts. |
| Supabase Auth | Managed authentication with session persistence; no custom auth service in v1. |
| Supabase PostgreSQL + RLS | Relational source of truth; authorization enforced at the database layer with tested policies. |
| Supabase Storage (private) | Private image buckets with short-lived signed upload/download URLs. |
| Supabase Realtime (selective) | Used only where it provides clear value (e.g., accelerating analysis completion); never the sole completion mechanism. |
| Supabase Edge Functions / privileged API | Server-side authority for sensitive mutations (jobs, deletion, webhooks, moderation, fan-out). |
| TanStack Query | Server-state caching and invalidation on the client. |
| Expo SQLite | Durable local mutation queue, local index, and sync metadata. |
| TypeScript worker on Railway / Render / Fly | Simple single analysis worker; Python only if the proprietary algorithm requires Python-native libraries. |
| RevenueCat (P1) | Subscription entitlement over raw Apple IAP; server-authoritative via webhook. |
| Sentry | Error and performance telemetry with release context. |
| PostHog | Privacy-filtered product analytics events. |
| GitHub Actions + Supabase CLI + EAS Build | CI, migration tooling, and mobile preview/release builds. |

## 3. Architectural constraints — modular monolith (PRD §11.3)

These are hard constraints for v1:

1. **Use a modular monolith.** One deployable backend surface (Supabase + one worker).
2. **Do not add** microservices.
3. **Do not add** Kafka.
4. **Do not add** Kubernetes.
5. **Do not add** a vector database.
6. **Do not add** GraphQL.
7. **Do not add** a custom authentication service.
8. **Authorization-critical fields remain relational** (never inside JSONB).
9. **Evolving ML payloads may use JSONB**, but only with versioned schemas (`schema_version` recorded on every payload).
10. **External provider adapters are isolated behind interfaces** and covered by contract tests; the mobile app never knows the model provider.

Related P0 exclusions (PRD §6.4): no vector DBs, custom recommendation infrastructure, on-device ML (unless proven superior), or realtime messaging infrastructure.

## 4. Source-of-truth rules (PRD §7.2)

- **Device is authoritative** for: an unuploaded local draft and the pending mutation queue.
- **Server is authoritative** for: authentication, ownership, analysis results, Style DNA snapshots, entitlements, moderation, counts, and deletion completion.
- Optimistic display is permitted only for **reversible social mutations in P1**, and failures must be reconciled visibly.
- A **locally saved record and a cloud-synced record are distinct UI states** — the UI never claims cloud success before the server confirms it.
- **Deletion tombstones override stale cache content** — a deleted trace must never resurrect from cache.

## 5. Offline, local persistence, and synchronization (PRD §14)

P0 offline scope: durable capture, viewing cached profile/history/results, and reliable upload/delete retry. It does **not** promise offline analysis or full social mutation behavior.

### 5.1 Local persistence rules

- **Auth tokens** live in platform secure storage (Keychain via expo-secure-store) — never plain AsyncStorage.
- **SQLite** stores: normalized app records, mutation-queue entries, server IDs, sync watermarks, and tombstones.
- **Images** are stored in app-owned durable file storage until cloud sync and retention rules permit cleanup (no reliance on temporary URIs or in-memory base64).

### 5.2 Sync and mutation-queue rules

- **UUIDs and idempotency keys are generated on-device before the first network operation** so retries never duplicate outfits or analyses (unique `(owner_id, client_idempotency_key)` on outfits).
- **Uploads resume** on connectivity return and on safe app relaunch; a queued upload runs exactly once per idempotency key.
- **Cursor pagination** and `updated_at` watermarks drive incremental sync (History is reverse-chronological cursor-paginated).
- **Conflict policy:** last-write-wins is acceptable only for low-risk profile text and captions; server authority wins for analysis, entitlement, moderation, counts, and deletion.
- **Likes/follows/saves (P1)** use idempotent set/delete semantics — never counter increments.
- **Tombstones:** deletions write tombstones locally and server-side; tombstones override any stale cached content and survive restart.
- **Write failures are never swallowed** — every failed mutation enters an observable retry or failure state in the UI.

### 5.3 Outfit lifecycle states (PRD §7.1)

```
local_draft → queued_offline → uploading → uploaded → analysis_queued → analyzing → ready
```

Failure branches: `upload_failed`, `analysis_failed_retryable`, `analysis_failed_terminal`. Deletion: `deleting → deleted`. Retries are idempotent and never create duplicate outfit or analysis records.

## 6. Environment separation (PRD §19)

- **Three fully separate environments: local, staging, production** — each with its own Supabase project, secrets, storage buckets, analytics project, and model credentials.
- **Production data never populates local tests.**
- Every PR runs: format/lint, TypeScript checks, unit/component tests, schema-generation drift, empty-database migration, RLS integration tests, API/worker integration with provider mocked, Expo config validation, secret scan, and dependency audit.
- Every verified milestone produces an EAS preview build; staging migrations apply and smoke-test before production.
- Database changes follow **expand → deploy → migrate → contract**; prefer roll-forward migrations; rollback via tagged releases. OTA updates require a documented runtime-version compatibility policy.
- **Human-approval gates:** no agent or CI job automatically submits to the App Store, changes billing, creates paid products, deletes production data, sends external communications, or rotates credentials.
