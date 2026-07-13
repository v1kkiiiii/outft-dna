-- 0001_core_tables.sql
-- OUTFT — P0 core tables per docs/DATABASE_SCHEMA.md §12.1 (FROZEN CONTRACT v1).
-- Do not alter column names/types/defaults without lead approval + doc version bump.

-- Required extensions
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive username

-- =========================================================================
-- 1.1 profiles
-- =========================================================================
create table public.profiles (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  username                  citext not null,
  display_name              text not null,
  bio                       text,
  avatar_path               text,
  profile_visibility        text not null default 'private',
  onboarding_completed_at   timestamptz,
  terms_version             text,
  privacy_version           text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint profiles_username_unique unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9._]{3,24}$'),
  constraint profiles_visibility_check check (profile_visibility in ('private','public'))
);

comment on table public.profiles is 'One row per auth.users; owner-scoped, RLS enforced.';

-- =========================================================================
-- 1.2 outfits
-- =========================================================================
create table public.outfits (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references public.profiles(user_id) on delete cascade,
  client_idempotency_key    uuid not null,
  category                  text,
  caption                   text,
  captured_at               timestamptz not null,
  status                    text not null,
  visibility                text not null default 'private',
  original_object_path      text,
  processed_object_path     text,
  latest_analysis_id        uuid,
  deleted_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint outfits_owner_idempotency_unique unique (owner_id, client_idempotency_key),
  constraint outfits_category_check check (
    category is null or category in ('daily','night_out','work','gym','travel','event')
  ),
  constraint outfits_status_check check (
    status in (
      'local_draft','queued_offline','uploading','uploaded',
      'analysis_queued','analyzing','ready',
      'upload_failed','analysis_failed_retryable','analysis_failed_terminal',
      'deleting','deleted'
    )
  ),
  constraint outfits_visibility_check check (visibility in ('private','published')),
  -- Required visibility/state combination: cannot be published while deleted or not ready.
  constraint outfits_publish_state_check check (
    visibility <> 'published' or (deleted_at is null and status = 'ready')
  )
);

comment on table public.outfits is 'Owner-scoped outfit records; soft-deleted via deleted_at tombstone.';

-- FK from outfits.latest_analysis_id -> style_analyses.id is added in 0001 after style_analyses
-- exists (see bottom of file) to avoid forward-reference ordering issues.

-- =========================================================================
-- 1.3 analysis_jobs
-- =========================================================================
create table public.analysis_jobs (
  id                        uuid primary key default gen_random_uuid(),
  outfit_id                 uuid not null references public.outfits(id) on delete cascade,
  owner_id                  uuid not null references public.profiles(user_id) on delete cascade,
  status                    text not null,
  attempt_count             integer not null default 0,
  next_attempt_at           timestamptz,
  provider                  text,
  model_version             text,
  prompt_version            text,
  request_hash              text,
  error_code                text,
  error_safe_message        text,
  queued_at                 timestamptz not null,
  started_at                timestamptz,
  completed_at              timestamptz,
  constraint analysis_jobs_status_check check (
    status in ('queued','leased','running','succeeded','failed_retryable','failed_terminal','canceled')
  ),
  constraint analysis_jobs_attempt_count_check check (attempt_count >= 0 and attempt_count <= 3)
);

comment on table public.analysis_jobs is 'Server/worker-owned job queue rows; clients read-only.';

-- =========================================================================
-- 1.4 style_analyses — immutable after insert
-- =========================================================================
create table public.style_analyses (
  id                        uuid primary key default gen_random_uuid(),
  outfit_id                 uuid not null references public.outfits(id) on delete cascade,
  job_id                    uuid not null references public.analysis_jobs(id) on delete cascade,
  schema_version            text not null,
  model_version             text not null,
  prompt_version            text not null,
  garments                  jsonb not null default '[]'::jsonb,
  colors                    jsonb not null default '[]'::jsonb,
  traits                    jsonb not null default '[]'::jsonb,
  scores                    jsonb not null default '{}'::jsonb,
  confidence                numeric not null,
  insight                   text,
  created_at                timestamptz not null default now(),
  constraint style_analyses_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint style_analyses_insight_length_check check (insight is null or char_length(insight) <= 140)
);

comment on table public.style_analyses is 'Immutable analysis results; server (service_role/worker) writes once, never updated.';

-- Now that style_analyses exists, add the deferred FK from outfits.
alter table public.outfits
  add constraint outfits_latest_analysis_fk
  foreign key (latest_analysis_id) references public.style_analyses(id) on delete set null;

-- =========================================================================
-- 1.5 style_dna_snapshots
-- =========================================================================
create table public.style_dna_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(user_id) on delete cascade,
  algorithm_version         text not null,
  window_start              timestamptz,
  window_end                timestamptz,
  outfit_count              integer not null default 0,
  scores                    jsonb not null default '{}'::jsonb,
  colors                    jsonb not null default '[]'::jsonb,
  traits                    jsonb not null default '[]'::jsonb,
  generated_at              timestamptz not null default now(),
  constraint style_dna_outfit_count_check check (outfit_count >= 0)
);

comment on table public.style_dna_snapshots is 'Immutable history of Style DNA recomputations; server-written only.';

-- =========================================================================
-- 1.6 data_requests
-- =========================================================================
create table public.data_requests (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(user_id) on delete cascade,
  type                      text not null,
  status                    text not null default 'requested',
  requested_at              timestamptz not null default now(),
  completed_at              timestamptz,
  error_code                text,
  expires_at                timestamptz,
  constraint data_requests_type_check check (type in ('export','deletion')),
  constraint data_requests_status_check check (status in ('requested','in_progress','completed','failed'))
);

comment on table public.data_requests is 'Account export/deletion request lifecycle; server-written only.';

-- =========================================================================
-- 1.7 user_blocks
-- =========================================================================
create table public.user_blocks (
  blocker_id                uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id                uuid not null references public.profiles(user_id) on delete cascade,
  created_at                timestamptz not null default now(),
  constraint user_blocks_pk primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

comment on table public.user_blocks is 'Block overrides all social visibility/interaction; owner = blocker_id.';

-- =========================================================================
-- 1.8 audit_events — append-only, immutable
-- =========================================================================
create table public.audit_events (
  id                        uuid primary key default gen_random_uuid(),
  actor_id                  uuid references auth.users(id) on delete set null,
  event_type                text not null,
  subject_type              text not null,
  subject_id                uuid,
  metadata                  jsonb not null default '{}'::jsonb,
  correlation_id            uuid,
  created_at                timestamptz not null default now()
);

comment on table public.audit_events is 'Append-only privileged audit log; allowlisted metadata keys only; server-written only.';

-- =========================================================================
-- Indexes (§12.4)
-- =========================================================================

-- outfits: partial index excluding tombstoned rows, owner history scan
create index outfits_owner_captured_at_idx
  on public.outfits (owner_id, captured_at desc)
  where deleted_at is null;

-- analysis_jobs: worker lease/retry scan
create index analysis_jobs_status_next_attempt_idx
  on public.analysis_jobs (status, next_attempt_at);

-- one active job per outfit (partial unique index on active status set)
create unique index analysis_jobs_one_active_per_outfit_idx
  on public.analysis_jobs (outfit_id)
  where status in ('queued','leased','running');

-- style_analyses: outfit history, most recent first
create index style_analyses_outfit_created_at_idx
  on public.style_analyses (outfit_id, created_at desc);

-- style_dna_snapshots: user history, most recent first
create index style_dna_snapshots_user_generated_at_idx
  on public.style_dna_snapshots (user_id, generated_at desc);

-- supporting lookup indexes (not in §12.4 explicitly but required for FK scan patterns)
create index analysis_jobs_owner_id_idx on public.analysis_jobs (owner_id);
create index data_requests_user_id_idx on public.data_requests (user_id);
create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);
create index audit_events_actor_id_idx on public.audit_events (actor_id);
create index audit_events_subject_idx on public.audit_events (subject_type, subject_id);
