-- 0004_worker_rpcs.sql
-- Server-only RPCs the analysis worker (worker/src/worker.ts) calls with the
-- service_role key. Each RPC does its multi-row work atomically so a job
-- can never be leased twice or left in an inconsistent state (ML.md §10.4).

-- ---------------------------------------------------------------------
-- lease_next_analysis_job()
-- Atomically claims one queued job: analysis_jobs.status queued -> leased
-- and the parent outfit's status analysis_queued -> analyzing. Skips jobs
-- whose outfit already has another active job (one-active-job-per-outfit).
-- Returns the leased job joined with the info the worker needs to fetch
-- the image (storage path + media type), or no rows if the queue is empty.
-- ---------------------------------------------------------------------
create or replace function public.lease_next_analysis_job()
returns table (
  id uuid,
  outfit_id uuid,
  owner_id uuid,
  status text,
  attempt_count integer,
  storage_object_path text,
  media_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  select j.id into v_job_id
  from public.analysis_jobs j
  join public.outfits o on o.id = j.outfit_id
  where j.status = 'queued'
    and (j.next_attempt_at is null or j.next_attempt_at <= now())
    and o.deleted_at is null
    and o.status = 'analysis_queued'
    -- one-active-job-per-outfit: no other job for this outfit already leased/running
    and not exists (
      select 1 from public.analysis_jobs j2
      where j2.outfit_id = j.outfit_id
        and j2.id <> j.id
        and j2.status in ('leased', 'running')
    )
  order by j.queued_at asc
  limit 1
  for update of j skip locked;

  if v_job_id is null then
    return;
  end if;

  update public.analysis_jobs
  set status = 'leased',
      started_at = now(),
      attempt_count = attempt_count + 1
  where public.analysis_jobs.id = v_job_id;

  update public.outfits
  set status = 'analyzing', updated_at = now()
  where public.outfits.id = (select j.outfit_id from public.analysis_jobs j where j.id = v_job_id);

  return query
  select j.id, j.outfit_id, j.owner_id, j.status, j.attempt_count,
         coalesce(o.processed_object_path, o.original_object_path) as storage_object_path,
         'image/jpeg'::text as media_type
  from public.analysis_jobs j
  join public.outfits o on o.id = j.outfit_id
  where j.id = v_job_id;
end;
$$;

revoke all on function public.lease_next_analysis_job() from public, anon, authenticated;
grant execute on function public.lease_next_analysis_job() to service_role;

-- ---------------------------------------------------------------------
-- complete_analysis_job_success(job_id, outfit_id, analysis jsonb)
-- Inserts the immutable style_analyses row, marks the job succeeded, marks
-- the outfit ready + points latest_analysis_id at the new row. Does not
-- perform DNA recomputation itself (kept out-of-transaction / async); it
-- only flags the outfit table so a downstream job/trigger can pick it up.
-- ---------------------------------------------------------------------
create or replace function public.complete_analysis_job_success(
  p_job_id uuid,
  p_outfit_id uuid,
  p_analysis jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_analysis_id uuid;
begin
  insert into public.style_analyses (
    outfit_id, job_id, schema_version, model_version, prompt_version,
    garments, colors, traits, scores, confidence, insight
  )
  values (
    p_outfit_id,
    p_job_id,
    p_analysis->>'schemaVersion',
    p_analysis->>'modelVersion',
    p_analysis->>'promptVersion',
    coalesce(p_analysis->'garments', '[]'::jsonb),
    coalesce(p_analysis->'colors', '[]'::jsonb),
    coalesce(p_analysis->'styleTraits', '[]'::jsonb),
    coalesce(p_analysis->'styleScores', '{}'::jsonb),
    (p_analysis->>'confidence')::numeric,
    p_analysis->>'insight'
  )
  returning id into v_analysis_id;

  update public.analysis_jobs
  set status = 'succeeded', completed_at = now()
  where id = p_job_id;

  update public.outfits
  set status = 'ready',
      latest_analysis_id = v_analysis_id,
      updated_at = now()
  where id = p_outfit_id;
end;
$$;

revoke all on function public.complete_analysis_job_success(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_analysis_job_success(uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- fail_analysis_job_terminal(job_id, outfit_id, error_code, error_message)
-- Marks the job and outfit permanently failed. No retry.
-- ---------------------------------------------------------------------
create or replace function public.fail_analysis_job_terminal(
  p_job_id uuid,
  p_outfit_id uuid,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.analysis_jobs
  set status = 'failed_terminal',
      error_code = p_error_code,
      error_safe_message = p_error_message,
      completed_at = now()
  where id = p_job_id;

  update public.outfits
  set status = 'analysis_failed_terminal', updated_at = now()
  where id = p_outfit_id;
end;
$$;

revoke all on function public.fail_analysis_job_terminal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.fail_analysis_job_terminal(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------
-- fail_analysis_job_retryable(job_id, outfit_id, error_code, error_message, next_attempt_at)
-- Marks the job retryable and schedules the next attempt. If attempts are
-- exhausted (>= 3, per analysis_jobs_attempt_count_check), converts to a
-- terminal failure instead so the job never retries past the cap.
-- ---------------------------------------------------------------------
create or replace function public.fail_analysis_job_retryable(
  p_job_id uuid,
  p_outfit_id uuid,
  p_error_code text,
  p_error_message text,
  p_next_attempt_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_count integer;
begin
  select attempt_count into v_attempt_count
  from public.analysis_jobs
  where id = p_job_id;

  if v_attempt_count >= 3 then
    perform public.fail_analysis_job_terminal(p_job_id, p_outfit_id, p_error_code, p_error_message);
    return;
  end if;

  update public.analysis_jobs
  set status = 'queued',
      next_attempt_at = p_next_attempt_at,
      error_code = p_error_code,
      error_safe_message = p_error_message
  where id = p_job_id;

  update public.outfits
  set status = 'analysis_queued', updated_at = now()
  where id = p_outfit_id;
end;
$$;

revoke all on function public.fail_analysis_job_retryable(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.fail_analysis_job_retryable(uuid, uuid, text, text, timestamptz) to service_role;
