-- 0005_account_lifecycle.sql
-- Account lifecycle RPCs (PRD Wave E / AC-P0-010): data export request and
-- account deletion, callable by the authenticated user for their own account.
--
-- NOTE on status values: docs say "pending" but the frozen data_requests
-- contract (0001) only allows ('requested','in_progress','completed','failed');
-- 'requested' is the pending state.

-- ---------------------------------------------------------------------
-- request_account_export()
-- Inserts a data_requests row of type 'export' for the calling user and
-- returns the request id. A server job picks up 'requested' rows, builds
-- the export bundle, and emails the user.
-- ---------------------------------------------------------------------
create or replace function public.request_account_export()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.data_requests (user_id, type, status)
  values (v_user_id, 'export', 'requested')
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_account_export() from public, anon;
grant execute on function public.request_account_export() to authenticated;

-- ---------------------------------------------------------------------
-- delete_my_account()
-- For the calling user, atomically:
--   1. tombstones all their outfits (deleted_at = now(), status 'deleting',
--      visibility back to 'private' to satisfy outfits_publish_state_check),
--   2. records a data_requests row (type 'deletion', status 'requested').
--
-- The profiles row and auth.users row are intentionally NOT deleted here:
--   * auth.admin deletion is a GoTrue server API, not callable from SQL;
--   * deleting the profiles row would FK-cascade away the data_requests row
--     the server job needs to finish the deletion.
-- Per PRD, a resumable server job (service_role + GoTrue admin API) scans
-- 'deletion'/'requested' rows, purges storage objects, deletes the profile
-- (cascading all owned rows) and the auth user, then marks the request
-- 'completed'. The function returns true; the app then signs the user out,
-- so the account is unusable immediately.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- 1. Tombstone every outfit owned by the user.
  update public.outfits
  set deleted_at = coalesce(deleted_at, now()),
      status = 'deleting',
      visibility = 'private',
      updated_at = now()
  where owner_id = v_user_id
    and status not in ('deleted');

  -- 2. Record the deletion request for the resumable server job.
  insert into public.data_requests (user_id, type, status)
  values (v_user_id, 'deletion', 'requested');

  -- 3. Profile + auth.users deletion is finalized by the server job
  --    (service_role + GoTrue admin API); deleting the profile here would
  --    cascade-delete the data_requests row the job needs. The account is
  --    unusable immediately: the app signs the user out after this call.
  return true;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
