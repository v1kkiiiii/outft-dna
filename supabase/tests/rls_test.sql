-- rls_test.sql
-- OUTFT — RLS matrix assertions per docs/SECURITY.md §3 and
-- docs/DATABASE_SCHEMA.md §4. Plain runnable psql/plpgsql assertions
-- (pgTAP is NOT assumed to be installed). Each check RAISEs EXCEPTION
-- on failure so the script can be wired into CI via a non-zero exit code.
--
-- Usage (see supabase/README.md for full instructions):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
--
-- This script must run against a freshly migrated, otherwise-empty database
-- (0001 + 0002 + 0003 applied). It creates two throwaway auth users (A, B),
-- exercises the RLS matrix as A, B, anon, and service_role, then rolls back
-- everything it created so the run is repeatable and leaves no residue.

begin;

-- -------------------------------------------------------------------------
-- Fixtures: two auth users + profiles + one outfit owned by A
-- -------------------------------------------------------------------------
do $$
declare
  user_a uuid := '11111111-1111-1111-1111-111111111111';
  user_b uuid := '22222222-2222-2222-2222-222222222222';
begin
  -- Minimal auth.users rows (Supabase auth schema requires these columns
  -- to exist; adjust if your local auth schema mock differs).
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values
    (user_a, 'a@test.outft.dev', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (user_b, 'b@test.outft.dev', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into public.profiles (user_id, username, display_name)
  values
    (user_a, 'usera_rlstest', 'User A'),
    (user_b, 'userb_rlstest', 'User B')
  on conflict (user_id) do nothing;

  insert into public.outfits (id, owner_id, client_idempotency_key, captured_at, status, visibility)
  values (
    '33333333-3333-3333-3333-333333333333',
    user_a,
    gen_random_uuid(),
    now(),
    'ready',
    'private'
  )
  on conflict do nothing;
end $$;

-- -------------------------------------------------------------------------
-- Helper: switch role/JWT claims to simulate a given principal.
-- Supabase's PostgREST maps JWT `sub` -> auth.uid() via the `request.jwt.claims`
-- GUC. We simulate that here with set_config, matching how Supabase's local
-- RLS test harness operates.
-- -------------------------------------------------------------------------

-- ===== ALLOW: User A (owner) can read own outfit =========================
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from public.outfits where id = '33333333-3333-3333-3333-333333333333';
  if cnt <> 1 then
    raise exception 'FAIL: User A should read own outfit (got % rows)', cnt;
  end if;
  raise notice 'PASS: User A can read own outfit';

  reset role;
end $$;

-- ===== DENY: User B (non-owner) cannot read A's outfit ====================
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from public.outfits where id = '33333333-3333-3333-3333-333333333333';
  if cnt <> 0 then
    raise exception 'FAIL: User B must not read A''s outfit (got % rows)', cnt;
  end if;
  raise notice 'PASS: User B cannot read A''s outfit';

  reset role;
end $$;

-- ===== DENY: anon cannot read any outfit ===================================
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;

  select count(*) into cnt from public.outfits where id = '33333333-3333-3333-3333-333333333333';
  if cnt <> 0 then
    raise exception 'FAIL: anon must not read any outfit (got % rows)', cnt;
  end if;
  raise notice 'PASS: anon cannot read outfits';

  reset role;
end $$;

-- ===== DENY: User B cannot read A's profile (P0 private) ==================
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from public.profiles where user_id = '11111111-1111-1111-1111-111111111111';
  if cnt <> 0 then
    raise exception 'FAIL: User B must not read A''s profile (got % rows)', cnt;
  end if;
  raise notice 'PASS: User B cannot read A''s profile';

  reset role;
end $$;

-- ===== DENY: User A cannot INSERT into style_analyses (client write) =======
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.style_analyses (
      outfit_id, job_id, schema_version, model_version, prompt_version, confidence
    ) values (
      '33333333-3333-3333-3333-333333333333',
      gen_random_uuid(),
      '1.0', 'test-model', 'outft-analysis-v1', 0.9
    );
    raise exception 'FAIL: User A must not be able to INSERT into style_analyses directly';
  exception
    when insufficient_privilege then
      raise notice 'PASS: User A cannot INSERT into style_analyses';
    when others then
      -- job_id FK violation or RLS denial both indicate the insert did not
      -- silently succeed as an authenticated client; re-raise anything
      -- unexpected so real regressions are still caught.
      if sqlstate = '42501' then
        raise notice 'PASS: User A cannot INSERT into style_analyses';
      else
        raise;
      end if;
  end;

  reset role;
end $$;

-- ===== DENY: User A cannot INSERT into audit_events ========================
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.audit_events (event_type, subject_type)
    values ('test.event', 'outfit');
    raise exception 'FAIL: User A must not be able to INSERT into audit_events';
  exception
    when insufficient_privilege then
      raise notice 'PASS: User A cannot INSERT into audit_events';
  end;

  reset role;
end $$;

-- ===== DENY: anon cannot INSERT an outfit ==================================
do $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;

  begin
    insert into public.outfits (owner_id, client_idempotency_key, captured_at, status)
    values ('11111111-1111-1111-1111-111111111111', gen_random_uuid(), now(), 'local_draft');
    raise exception 'FAIL: anon must not be able to INSERT an outfit';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon cannot INSERT an outfit';
  end;

  reset role;
end $$;

-- ===== ALLOW: service_role can write style_analyses (worker path) =========
do $$
declare
  job_id uuid := gen_random_uuid();
  cnt int;
begin
  set local role service_role;

  insert into public.analysis_jobs (id, outfit_id, owner_id, status, queued_at)
  values (job_id, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'succeeded', now());

  insert into public.style_analyses (
    outfit_id, job_id, schema_version, model_version, prompt_version, confidence, insight
  ) values (
    '33333333-3333-3333-3333-333333333333',
    job_id,
    '1.0', 'test-model', 'outft-analysis-v1', 0.87, 'Test insight.'
  );

  select count(*) into cnt from public.style_analyses where job_id = job_id;
  if cnt <> 1 then
    raise exception 'FAIL: service_role should be able to write style_analyses';
  end if;
  raise notice 'PASS: service_role can write style_analyses';

  reset role;
end $$;

-- ===== ALLOW: User A can read the analysis service_role just wrote =========
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt
  from public.style_analyses
  where outfit_id = '33333333-3333-3333-3333-333333333333';

  if cnt <> 1 then
    raise exception 'FAIL: User A should read own style_analyses row (got % rows)', cnt;
  end if;
  raise notice 'PASS: User A can read own style_analyses';

  reset role;
end $$;

-- ===== DENY: User B cannot read A's style_analyses =========================
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt
  from public.style_analyses
  where outfit_id = '33333333-3333-3333-3333-333333333333';

  if cnt <> 0 then
    raise exception 'FAIL: User B must not read A''s style_analyses (got % rows)', cnt;
  end if;
  raise notice 'PASS: User B cannot read A''s style_analyses';

  reset role;
end $$;

-- ===== DENY: no one (incl. service_role via table policy path) can UPDATE
-- style_analyses as a client role — immutability check for authenticated ===
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  begin
    update public.style_analyses set insight = 'tampered' where outfit_id = '33333333-3333-3333-3333-333333333333';
    raise exception 'FAIL: authenticated must not be able to UPDATE style_analyses';
  exception
    when insufficient_privilege then
      raise notice 'PASS: authenticated cannot UPDATE style_analyses (immutable)';
  end;

  reset role;
end $$;

-- ===== DENY: self-block is rejected by CHECK constraint ====================
do $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  begin
    insert into public.user_blocks (blocker_id, blocked_id)
    values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
    raise exception 'FAIL: self-block must be rejected by CHECK constraint';
  exception
    when check_violation then
      raise notice 'PASS: self-block rejected by CHECK constraint';
  end;

  reset role;
end $$;

-- ===== ALLOW: User A can block User B (own blocker_id) =====================
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  set local role authenticated;

  insert into public.user_blocks (blocker_id, blocked_id)
  values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

  select count(*) into cnt from public.user_blocks
  where blocker_id = '11111111-1111-1111-1111-111111111111'
    and blocked_id = '22222222-2222-2222-2222-222222222222';

  if cnt <> 1 then
    raise exception 'FAIL: User A should be able to create own block row';
  end if;
  raise notice 'PASS: User A can create own user_blocks row';

  reset role;
end $$;

-- ===== DENY: User B cannot see A's block row (blocker_id = A, not B) =======
do $$
declare
  cnt int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated')::text, true);
  set local role authenticated;

  select count(*) into cnt from public.user_blocks
  where blocker_id = '11111111-1111-1111-1111-111111111111';

  if cnt <> 0 then
    raise exception 'FAIL: User B must not read A''s user_blocks rows (got % rows)', cnt;
  end if;
  raise notice 'PASS: User B cannot read A''s user_blocks rows';

  reset role;
end $$;

raise notice '=== ALL RLS MATRIX ASSERTIONS PASSED ===';

-- Roll back all fixtures/writes so the test is idempotent and leaves the
-- database in its pre-test state.
rollback;
