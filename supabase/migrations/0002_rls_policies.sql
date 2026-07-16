-- 0002_rls_policies.sql
-- OUTFT — Row Level Security per docs/DATABASE_SCHEMA.md §4 RLS matrix and
-- docs/SECURITY.md §3 RLS test matrix. Deny-by-default: RLS enabled on every
-- table, only explicit ✅ cells from the matrix get a policy. service_role
-- bypasses RLS by design (Supabase built-in behavior) and is the only writer
-- of style_analyses, style_dna_snapshots, analysis_jobs writes, and audit_events.

-- =========================================================================
-- profiles
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No DELETE policy for authenticated: account deletion is server/service_role only.

-- =========================================================================
-- outfits
-- =========================================================================
alter table public.outfits enable row level security;
alter table public.outfits force row level security;

create policy outfits_select_own
  on public.outfits for select
  to authenticated
  using (auth.uid() = owner_id and deleted_at is null);

create policy outfits_insert_own
  on public.outfits for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy outfits_update_own
  on public.outfits for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- No DELETE policy for authenticated: deletion goes through the privileged
-- deletion job (service_role), which bypasses RLS.

-- =========================================================================
-- analysis_jobs — client SELECT own only; all writes server-only
-- =========================================================================
alter table public.analysis_jobs enable row level security;
alter table public.analysis_jobs force row level security;

create policy analysis_jobs_select_own
  on public.analysis_jobs for select
  to authenticated
  using (auth.uid() = owner_id);

-- No INSERT/UPDATE/DELETE policies for authenticated or anon:
-- job creation and worker updates happen exclusively via service_role,
-- which bypasses RLS. Deny-by-default holds for all client roles.

-- =========================================================================
-- style_analyses — client SELECT via outfit ownership; server-only writes
-- =========================================================================
alter table public.style_analyses enable row level security;
alter table public.style_analyses force row level security;

create policy style_analyses_select_own
  on public.style_analyses for select
  to authenticated
  using (
    exists (
      select 1
      from public.outfits o
      where o.id = style_analyses.outfit_id
        and o.owner_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for any client role: immutable, worker-only
-- via service_role.

-- =========================================================================
-- style_dna_snapshots — client SELECT own; server-only writes
-- =========================================================================
alter table public.style_dna_snapshots enable row level security;
alter table public.style_dna_snapshots force row level security;

create policy style_dna_snapshots_select_own
  on public.style_dna_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for any client role: server recompute only.

-- =========================================================================
-- data_requests — client SELECT own; server-only writes
-- =========================================================================
alter table public.data_requests enable row level security;
alter table public.data_requests force row level security;

create policy data_requests_select_own
  on public.data_requests for select
  to authenticated
  using (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for any client role: created and progressed
-- only via privileged endpoints (service_role).

-- =========================================================================
-- user_blocks — owner can select/insert/delete own blocker rows
-- =========================================================================
alter table public.user_blocks enable row level security;
alter table public.user_blocks force row level security;

create policy user_blocks_select_own
  on public.user_blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy user_blocks_insert_own
  on public.user_blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy user_blocks_delete_own
  on public.user_blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- No UPDATE policy: block rows are set/delete semantics only, never mutated.

-- =========================================================================
-- audit_events — no client access whatsoever; server-only append
-- =========================================================================
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

-- Intentionally zero policies for authenticated/anon roles: deny-by-default
-- means no SELECT/INSERT/UPDATE/DELETE is possible for any client role.
-- Only service_role (which bypasses RLS) may write; moderator/support reads
-- happen through a privileged endpoint using service_role, never direct
-- table grants to a client-facing role.

-- =========================================================================
-- Explicit anon denial note
-- =========================================================================
-- No policies are created for the `anon` role on any table above. Because
-- RLS is enabled + forced with no matching policy, anon requests are denied
-- by default on every table (SELECT/INSERT/UPDATE/DELETE all fail closed).

-- Added post-launch: authenticated owners must be able to enqueue an analysis
-- job for their own outfit (the app inserts the job directly; there is no
-- privileged endpoint in this build). Owner-scoped and outfit-ownership-checked.
create policy "owner enqueues own analysis job"
on public.analysis_jobs for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.outfits o
    where o.id = analysis_jobs.outfit_id and o.owner_id = auth.uid()
  )
);
