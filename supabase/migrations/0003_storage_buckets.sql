-- 0003_storage_buckets.sql
-- OUTFT — Private storage buckets per docs/DATABASE_SCHEMA.md §5 and
-- docs/SECURITY.md (private buckets, signed-URL-only access, path-prefix
-- ownership). No public buckets, ever.

-- =========================================================================
-- Buckets
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('outfits', 'outfits', false, 20971520)   -- 20 MB original cap per §15
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', false, 20971520)
on conflict (id) do nothing;

-- =========================================================================
-- Storage RLS: object path convention is {owner_id}/{object}.jpg
-- storage.foldername(name) returns an array of path segments; segment [1]
-- is the top-level folder, which must equal the authenticated user's uid.
-- =========================================================================

alter table storage.objects enable row level security;

-- ---- outfits bucket -----------------------------------------------------

create policy outfits_owner_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'outfits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy outfits_owner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'outfits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy outfits_owner_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'outfits'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'outfits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy outfits_owner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'outfits'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---- avatars bucket -------------------------------------------------------

create policy avatars_owner_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_owner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_owner_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_owner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No policies exist for the `anon` role on storage.objects: with RLS enabled
-- and no matching policy, anonymous reads/writes on both buckets are denied
-- by default. Client access is signed-URL-only in practice (short-lived,
-- minted server-side after an ownership check), but these policies are the
-- hard backstop against object-path guessing even if a raw client request
-- were attempted (§15.2 threat model).
