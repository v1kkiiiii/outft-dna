# OUTFT Live Security Verification

Date: 2026-07-15
Project: Supabase `ddqexxgjhouaujqiervh` (live)
Method: Read-only SQL via Supabase Management API (`POST /v1/projects/ddqexxgjhouaujqiervh/database/query`) plus anon-key requests against the live PostgREST endpoint.

## Summary

| # | Check | Result |
|---|-------|--------|
| 1 | RLS enabled + forced on all 8 public tables | PASS |
| 2 | Policy counts: public >= 13, storage >= 3 | PASS (13 / 3) |
| 3 | Anon REST reads return no rows (`outfits`, `profiles`) | PASS |
| 4 | Worker RPC `lease_next_analysis_job` denied for anon | PASS |

All checks passed.

## 1. RLS enabled on all public tables

Query:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by relname;
```

Observed (live):

| Table | rowsecurity | forcerowsecurity |
|---|---|---|
| analysis_jobs | true | true |
| audit_events | true | true |
| data_requests | true | true |
| outfits | true | true |
| profiles | true | true |
| style_analyses | true | true |
| style_dna_snapshots | true | true |
| user_blocks | true | true |

All 8 tables have RLS enabled and FORCED (applies even to table owner). **PASS**

## 2. Policy counts

```sql
select count(*) from pg_policies where schemaname = 'public';   -- observed: 13 (expect >= 13)
select count(*) from pg_policies where schemaname = 'storage';  -- observed: 3  (expect >= 3)
```

**PASS**

## 3. Anon-key REST reads are filtered by RLS

Command:

```
curl "https://ddqexxgjhouaujqiervh.supabase.co/rest/v1/outfits?select=id" \
  -H "apikey: <publishable key>" -H "Authorization: Bearer <publishable key>"
```

Observed: HTTP 200, body `[]` — RLS filters all rows for the anon role; no data leaked. **PASS**

Same for profiles (note: `profiles` has no `id` column; a first attempt with `select=id` returned HTTP 400 `column profiles.id does not exist` — a schema error, not a data leak):

```
curl "https://ddqexxgjhouaujqiervh.supabase.co/rest/v1/profiles?select=user_id" ...
```

Observed: HTTP 200, body `[]`. **PASS**

## 4. Worker RPC not executable by anon

Command:

```
curl -X POST "https://ddqexxgjhouaujqiervh.supabase.co/rest/v1/rpc/lease_next_analysis_job" \
  -H "apikey: <publishable key>" -H "Authorization: Bearer <publishable key>" \
  -H "Content-Type: application/json" -d '{}'
```

Observed: HTTP 401, body:

```json
{"code":"42501","details":null,"hint":null,"message":"permission denied for function lease_next_analysis_job"}
```

EXECUTE is not granted to `anon`. **PASS**

## CI

`.github/workflows/ci.yml` added: on push/PR to main —
- `app`: Node 20 (npm cache on `app/package-lock.json`), `npm ci`, `npx tsc --noEmit`
- `worker`: same for `worker/`
- `secret-scan`: fails if `git grep -nE "sk-ant-api03|sbp_[A-Za-z0-9]|sb_secret_" -- ':!*.md'` matches any tracked non-markdown file.
