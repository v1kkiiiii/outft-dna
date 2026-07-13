# OUTFT Supabase Backend

This directory contains the frozen-contract P0 backend: SQL migrations, RLS
policies, storage bucket config, and RLS test assertions. Source of truth for
schema/RLS/storage decisions: `docs/DATABASE_SCHEMA.md`, `docs/SECURITY.md`,
`docs/ARCHITECTURE.md`. Do not change schema/policy shape here without a doc
version bump and lead approval.

## Layout

```
supabase/
  migrations/
    0001_core_tables.sql      -- P0 tables, constraints, indexes
    0002_rls_policies.sql     -- RLS enable + policies (deny-by-default)
    0003_storage_buckets.sql  -- private buckets + storage RLS
  tests/
    rls_test.sql              -- RLS matrix assertions (allow + deny cases)
  README.md
```

## Required environment variables

These are expected to already exist as GitHub Actions / CI secrets and local
`.env` (never committed):

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | mobile app (anon), CI, scripts | Public project URL, safe to ship in mobile bundle. |
| `SUPABASE_ANON_KEY` | mobile app, CI integration tests | Public/publishable key, safe to ship in mobile bundle. |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions, worker, RLS test harness (service_role assertions), CI | **Server-only.** Never in mobile code, `EXPO_PUBLIC_*` vars, or logs. |
| `SUPABASE_DB_URL` / `SUPABASE_ACCESS_TOKEN` | `supabase` CLI, `psql` test runs | Used to apply migrations and run `rls_test.sql` against the target database. |

Environment separation per `docs/ARCHITECTURE.md` §6: local, staging, and
production are **separate Supabase projects** with separate keys/buckets.
Never point CI or local test runs at production credentials.

## Applying migrations

Using the Supabase CLI (recommended, keeps `supabase_migrations` history in
sync):

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Or, applying explicit migration files in order via CLI migration runner:

```bash
supabase migration up
```

Or directly with `psql` against an empty/target database (useful for CI or a
throwaway local Postgres with the `auth` schema mocked/available):

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_core_tables.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_rls_policies.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_storage_buckets.sql
```

Migrations are written to run in order on a **fresh, empty database** and are
idempotent where reasonably possible (`on conflict do nothing` for bucket
inserts). They assume the `auth` schema and `auth.uid()` already exist, which
is true on any real Supabase project.

## Running the RLS tests

`supabase/tests/rls_test.sql` is plain PL/pgSQL (no pgTAP extension assumed).
It creates two throwaway `auth.users`/`profiles` rows and one outfit, then
asserts the full RLS matrix (User A owner, User B non-owner, anon, and
service_role) with `RAISE EXCEPTION` on any failure. The whole run is wrapped
in `begin; ... rollback;` so it leaves no residue and can be re-run freely.

Run it against a migrated database:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
```

A clean run prints a series of `NOTICE: PASS: ...` lines ending in:

```
NOTICE:  === ALL RLS MATRIX ASSERTIONS PASSED ===
```

Any RLS regression raises an `EXCEPTION` with a `FAIL: ...` message and a
non-zero `psql` exit code, so this is safe to wire into CI as a gate on every
PR against a freshly migrated empty database (per `docs/SECURITY.md` §3).

## Notes

- All tables use `uuid` PKs via `gen_random_uuid()` (from the `pgcrypto`
  extension) and `timestamptz` UTC timestamps defaulting to `now()`.
- RLS is enabled **and forced** (`force row level security`) on every
  owner-scoped table, and storage RLS is enabled on `storage.objects`. Tables
  and buckets with no matching policy for a role deny that role by default.
- `style_analyses`, `style_dna_snapshots`, `analysis_jobs` writes, and
  `audit_events` are writable only by `service_role` (which bypasses RLS by
  Supabase design) — there are intentionally no client-facing INSERT/UPDATE
  policies for those tables/operations.
- Storage buckets `outfits` and `avatars` are private (`public = false`);
  access is signed-URL-only in practice, and storage RLS policies key off the
  `{owner_id}/...` path prefix as a hard backstop against object-path
  guessing.
