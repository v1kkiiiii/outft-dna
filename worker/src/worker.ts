/**
 * Main analysis worker loop (ML.md §4.1 pipeline steps 7-8, §4.2 retry
 * policy, §4.3 kill switch; SECURITY.md release blocker #2/#6/#7).
 *
 * Responsibilities:
 *  - Lease one queued analysis_job at a time (status analysis_queued ->
 *    analyzing), respecting one-active-job-per-outfit.
 *  - Fetch a short-lived signed URL for the outfit image from the private
 *    `outfits` storage bucket, download it, and base64-encode it (never
 *    persisted, never logged).
 *  - Call analyze.ts (Claude vision + validation + retry policy).
 *  - On success: in one transaction, insert the immutable style_analyses
 *    row, mark the outfit `ready` (latest_analysis_id), and enqueue Style
 *    DNA recomputation (ML.md §7).
 *  - On unsupported-content classification: terminal failure, no analysis
 *    row saved (ML.md §5.1).
 *  - On exhausted retryable failure or non-retryable failure: set
 *    analysis_failed_retryable / analysis_failed_terminal with the mapped
 *    error_code.
 *  - Respect the global kill switch (ANALYSIS_ENABLED) — when disabled the
 *    worker does not lease jobs at all; job creation truthfully surfacing
 *    ANALYSIS_TEMPORARILY_UNAVAILABLE happens at the API layer, not here.
 *
 * This process holds SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY. Both
 * must remain server-only per SECURITY.md §7 — never in mobile code.
 */

import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { analyzeImage, type SupportedMediaType } from './analyze.js';
import { ValidationError } from './schema.js';

const POLL_INTERVAL_MS = 3_000;
const POLL_BACKOFF_MAX_MS = 30_000;
const EMPTY_QUEUE_BACKOFF_FACTOR = 1.5;
const OUTFITS_BUCKET = 'outfits';
const SIGNED_URL_TTL_SECONDS = 120; // minutes-scale TTL per SECURITY.md §1 item 3
const MAX_ATTEMPTS = 3;

interface AnalysisJobRow {
  id: string;
  outfit_id: string;
  owner_id: string;
  status: string;
  attempt_count: number;
  storage_object_path: string;
  media_type: SupportedMediaType;
}

function isAnalysisEnabled(): boolean {
  // Global kill switch (ML.md §4.3). Defaults to enabled only if explicitly
  // set to "true"; any other value (or unset) disables the worker safely.
  return (process.env.ANALYSIS_ENABLED || '').toLowerCase() === 'true';
}

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the worker environment');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Leases exactly one queued job, respecting one-active-job-per-outfit, by
 * atomically flipping analysis_queued -> analyzing via an RPC. The RPC is
 * expected to perform the row selection + update + one-active-job-per-outfit
 * check inside a single Postgres function to avoid races between multiple
 * worker instances (ML.md §4.1 step 5-7). See supabase/ for the migration
 * that defines `lease_next_analysis_job`.
 */
async function leaseNextJob(supabase: SupabaseClient): Promise<AnalysisJobRow | null> {
  const { data, error } = await supabase.rpc('lease_next_analysis_job');
  if (error) {
    console.error('[worker] lease_next_analysis_job RPC failed', {
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;
  // RPC may return a single row or an array depending on function definition.
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

async function fetchImageAsBase64(
  supabase: SupabaseClient,
  storageObjectPath: string,
): Promise<string> {
  const { data: signed, error: signError } = await supabase.storage
    .from(OUTFITS_BUCKET)
    .createSignedUrl(storageObjectPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl) {
    throw new Error(`Failed to create signed URL for outfit image: ${signError?.message ?? 'unknown error'}`);
  }

  const response = await fetch(signed.signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download outfit image (status ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
  // Note: the signed URL and image bytes are never logged or persisted,
  // per SECURITY.md §5 (logging redaction rules).
}

/**
 * Terminal/retryable outcome recording. Both paths are expected to be
 * implemented as RPCs so the multi-row effects (job status + outfit status +
 * style_analyses insert + DNA recompute enqueue) happen transactionally.
 */
async function completeJobSuccess(
  supabase: SupabaseClient,
  job: AnalysisJobRow,
  analysis: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc('complete_analysis_job_success', {
    p_job_id: job.id,
    p_outfit_id: job.outfit_id,
    p_analysis: analysis,
  });
  if (error) {
    throw new Error(`complete_analysis_job_success RPC failed: ${error.message}`);
  }
}

async function completeJobUnsupported(
  supabase: SupabaseClient,
  job: AnalysisJobRow,
  reason: 'multi_person' | 'no_outfit',
): Promise<void> {
  const errorCode = 'ANALYSIS_INVALID_OUTPUT';
  const { error } = await supabase.rpc('fail_analysis_job_terminal', {
    p_job_id: job.id,
    p_outfit_id: job.outfit_id,
    p_error_code: errorCode,
    p_error_message: `Unsupported content: ${reason}`,
  });
  if (error) {
    throw new Error(`fail_analysis_job_terminal RPC failed: ${error.message}`);
  }
}

async function failJobTerminal(
  supabase: SupabaseClient,
  job: AnalysisJobRow,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase.rpc('fail_analysis_job_terminal', {
    p_job_id: job.id,
    p_outfit_id: job.outfit_id,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
  if (error) {
    throw new Error(`fail_analysis_job_terminal RPC failed: ${error.message}`);
  }
}

async function failJobRetryable(
  supabase: SupabaseClient,
  job: AnalysisJobRow,
  errorCode: string,
  errorMessage: string,
  nextAttemptAt: Date,
): Promise<void> {
  const { error } = await supabase.rpc('fail_analysis_job_retryable', {
    p_job_id: job.id,
    p_outfit_id: job.outfit_id,
    p_error_code: errorCode,
    p_error_message: errorMessage,
    p_next_attempt_at: nextAttemptAt.toISOString(),
  });
  if (error) {
    throw new Error(`fail_analysis_job_retryable RPC failed: ${error.message}`);
  }
}

function classifyProviderErrorCode(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/429/.test(message)) return 'ANALYSIS_RATE_LIMITED';
  return 'ANALYSIS_PROVIDER_ERROR';
}

async function processJob(supabase: SupabaseClient, job: AnalysisJobRow): Promise<void> {
  console.log('[worker] processing job', { jobId: job.id, attemptCount: job.attempt_count });

  let base64: string;
  try {
    base64 = await fetchImageAsBase64(supabase, job.storage_object_path);
  } catch (err) {
    console.error('[worker] failed to fetch outfit image', { jobId: job.id });
    await failJobTerminal(
      supabase,
      job,
      'IMAGE_TYPE_UNSUPPORTED',
      err instanceof Error ? err.message : 'Failed to fetch outfit image',
    );
    return;
  }

  try {
    const outcome = await analyzeImage(base64, job.media_type);
    if (outcome.unsupported) {
      await completeJobUnsupported(supabase, job, outcome.reason);
      console.log('[worker] job resolved unsupported', { jobId: job.id, reason: outcome.reason });
      return;
    }
    await completeJobSuccess(supabase, job, outcome.analysis);
    console.log('[worker] job succeeded', { jobId: job.id });
  } catch (err) {
    if (err instanceof ValidationError) {
      // Non-retryable: invalid media / policy refusal / schema validation.
      await failJobTerminal(supabase, job, err.code, err.message);
      console.error('[worker] job failed terminal (validation)', { jobId: job.id, code: err.code });
      return;
    }

    // Retryable provider/network failure (timeout, 429, 5xx) or exhausted
    // retries bubbled up from analyze.ts.
    const nextAttempt = job.attempt_count + 1;
    const errorCode = classifyProviderErrorCode(err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown provider error';

    if (nextAttempt >= MAX_ATTEMPTS) {
      await failJobTerminal(supabase, job, errorCode, errorMessage);
      console.error('[worker] job failed terminal (retries exhausted)', { jobId: job.id, errorCode });
    } else {
      const delayMs = Math.min(POLL_BACKOFF_MAX_MS, 1000 * 2 ** nextAttempt) * (0.5 + Math.random() * 0.5);
      const nextAttemptAt = new Date(Date.now() + delayMs);
      await failJobRetryable(supabase, job, errorCode, errorMessage, nextAttemptAt);
      console.warn('[worker] job failed retryable', { jobId: job.id, errorCode, nextAttemptAt });
    }
  }
}

async function mainLoop(): Promise<void> {
  const supabase = getSupabaseClient();
  let emptyPolls = 0;

  console.log('[worker] outft analysis worker starting', {
    model: process.env.ANALYSIS_MODEL || 'claude-sonnet-4-6',
    analysisEnabled: isAnalysisEnabled(),
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!isAnalysisEnabled()) {
      // Global kill switch engaged: do not lease or process any jobs.
      // Truthful ANALYSIS_TEMPORARILY_UNAVAILABLE is surfaced at job-creation
      // time by the API layer, not fabricated here.
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    let job: AnalysisJobRow | null = null;
    try {
      job = await leaseNextJob(supabase);
    } catch (err) {
      console.error('[worker] error leasing job', err);
    }

    if (!job) {
      emptyPolls += 1;
      const backoff = Math.min(
        POLL_BACKOFF_MAX_MS,
        POLL_INTERVAL_MS * EMPTY_QUEUE_BACKOFF_FACTOR ** Math.min(emptyPolls, 6),
      );
      await sleep(backoff);
      continue;
    }

    emptyPolls = 0;
    try {
      await processJob(supabase, job);
    } catch (err) {
      // Should be rare: processJob handles its own error paths. A failure
      // here means an RPC call itself failed; log and continue polling
      // rather than crashing the worker process.
      console.error('[worker] unhandled error processing job', { jobId: job.id, err });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

mainLoop().catch((err) => {
  console.error('[worker] fatal error, exiting', err);
  process.exit(1);
});
